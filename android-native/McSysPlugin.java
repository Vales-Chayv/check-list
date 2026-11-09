package app.mycards.mobile;

import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * McSys — системные мелочи для сайта внутри приложения:
 *  keepAlive    — служба переднего плана на время больших загрузок;
 *  pickFolder   — выбор папки на телефоне (запоминается навсегда);
 *  hasFolder    — доступ к ранее выбранной папке ещё действует?
 *  mkdirs       — создать (или найти) вложенные папки внутри выбранной;
 *  openWrite / writeChunk / closeWrite — запись большого файла в папку кусками;
 *  copyToFolder — копирование готового файла из кэша приложения в папку.
 */
@CapacitorPlugin(name = "McSys")
public class McSysPlugin extends Plugin {

    private static class Out {
        OutputStream os;
        Uri doc;
    }

    private final Map<String, Out> outs = new HashMap<>();

    // ---------- служба загрузок ----------

    @PluginMethod
    public void keepAlive(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        if (on) {
            McUpService.start(getContext(), call.getString("text", ""));
        } else {
            McUpService.stop(getContext());
        }
        call.resolve();
    }

    // ---------- выбор папки ----------

    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(call, i, "onFolderPicked");
    }

    @ActivityCallback
    private void onFolderPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result == null ? null : result.getData();
        if (result == null || result.getResultCode() != android.app.Activity.RESULT_OK
                || data == null || data.getData() == null) {
            JSObject r = new JSObject();
            r.put("cancelled", true);
            call.resolve(r);
            return;
        }
        Uri tree = data.getData();
        try {
            int fl = data.getFlags()
                    & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            getContext().getContentResolver().takePersistableUriPermission(tree, fl);
        } catch (Exception e) {
            call.reject("Не удалось сохранить доступ к папке");
            return;
        }
        JSObject r = new JSObject();
        r.put("cancelled", false);
        r.put("uri", tree.toString());
        r.put("name", folderName(tree));
        call.resolve(r);
    }

    @PluginMethod
    public void hasFolder(PluginCall call) {
        String u = call.getString("uri");
        boolean ok = false;
        if (u != null) {
            try {
                for (android.content.UriPermission p : getContext().getContentResolver().getPersistedUriPermissions()) {
                    if (p.getUri().toString().equals(u) && p.isWritePermission()) {
                        ok = true;
                        break;
                    }
                }
            } catch (Exception e) {
                ok = false;
            }
        }
        JSObject r = new JSObject();
        r.put("ok", ok);
        if (ok) r.put("name", folderName(Uri.parse(u)));
        call.resolve(r);
    }

    private String folderName(Uri tree) {
        Cursor c = null;
        try {
            Uri doc = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
            c = getContext().getContentResolver().query(doc,
                    new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME}, null, null, null);
            if (c != null && c.moveToFirst()) {
                String n = c.getString(0);
                if (n != null && n.length() > 0) return n;
            }
        } catch (Exception e) {
            // ignore
        } finally {
            if (c != null) c.close();
        }
        return "Папка";
    }

    // ---------- запись в папку ----------

    private static String safeName(String n) {
        if (n == null) n = "";
        n = n.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
        if (n.length() > 120) n = n.substring(n.length() - 120);
        if (n.length() == 0 || n.equals(".") || n.equals("..")) n = "file";
        return n;
    }

    /** Папка-адресат: вложенная (dir — адрес из mkdirs) или корень выбранной папки. */
    private Uri parentOf(String folder, String dir) throws IOException {
        if (folder == null) throw new IOException("Папка не выбрана");
        if (dir != null && dir.length() > 0) return Uri.parse(dir);
        Uri tree = Uri.parse(folder);
        return DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
    }

    /** Ищет подпапку с таким именем, иначе создаёт. */
    private Uri childDir(Uri tree, Uri parent, String name) throws IOException {
        String pid = DocumentsContract.getDocumentId(parent);
        Uri kids = DocumentsContract.buildChildDocumentsUriUsingTree(tree, pid);
        Cursor c = null;
        try {
            c = getContext().getContentResolver().query(kids, new String[]{
                    DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                    DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                    DocumentsContract.Document.COLUMN_MIME_TYPE}, null, null, null);
            while (c != null && c.moveToNext()) {
                if (name.equals(c.getString(1)) && DocumentsContract.Document.MIME_TYPE_DIR.equals(c.getString(2))) {
                    return DocumentsContract.buildDocumentUriUsingTree(tree, c.getString(0));
                }
            }
        } catch (Exception e) {
            // не смогли прочитать список — попробуем просто создать
        } finally {
            if (c != null) c.close();
        }
        Uri d = DocumentsContract.createDocument(getContext().getContentResolver(), parent,
                DocumentsContract.Document.MIME_TYPE_DIR, name);
        if (d == null) throw new IOException("Не удалось создать папку «" + name + "»");
        return d;
    }

    @PluginMethod
    public void mkdirs(PluginCall call) {
        try {
            String folder = call.getString("folder");
            String path = call.getString("path", "");
            Uri tree = Uri.parse(folder == null ? "" : folder);
            Uri cur = parentOf(folder, null);
            for (String part : path.split("/")) {
                if (part == null || part.trim().length() == 0) continue;
                cur = childDir(tree, cur, safeName(part));
            }
            JSObject r = new JSObject();
            r.put("dir", cur.toString());
            call.resolve(r);
        } catch (Exception e) {
            call.reject(msg(e));
        }
    }

    private Uri createIn(String folder, String dir, String name, String mime) throws IOException {
        Uri parent = parentOf(folder, dir);
        Uri doc = DocumentsContract.createDocument(getContext().getContentResolver(), parent,
                mime == null || mime.length() == 0 ? "application/octet-stream" : mime, safeName(name));
        if (doc == null) throw new IOException("Не удалось создать файл в папке");
        return doc;
    }

    @PluginMethod
    public void openWrite(PluginCall call) {
        try {
            Uri doc = createIn(call.getString("folder"), call.getString("dir"), call.getString("name"), call.getString("mime"));
            Out o = new Out();
            o.doc = doc;
            o.os = getContext().getContentResolver().openOutputStream(doc, "w");
            if (o.os == null) throw new IOException("Не удалось открыть файл для записи");
            String id = UUID.randomUUID().toString();
            synchronized (outs) {
                outs.put(id, o);
            }
            JSObject r = new JSObject();
            r.put("id", id);
            call.resolve(r);
        } catch (Exception e) {
            call.reject(msg(e));
        }
    }

    @PluginMethod
    public void writeChunk(PluginCall call) {
        Out o;
        synchronized (outs) {
            o = outs.get(call.getString("id", ""));
        }
        String b64 = call.getString("data");
        if (o == null || b64 == null) {
            call.reject("Запись не открыта");
            return;
        }
        try {
            byte[] b = Base64.decode(b64, Base64.DEFAULT);
            o.os.write(b);
            call.resolve();
        } catch (Exception e) {
            call.reject(msg(e));
        }
    }

    @PluginMethod
    public void closeWrite(PluginCall call) {
        Out o;
        synchronized (outs) {
            o = outs.remove(call.getString("id", ""));
        }
        if (o == null) {
            call.resolve();
            return;
        }
        boolean abort = Boolean.TRUE.equals(call.getBoolean("abort", false));
        String err = null;
        try {
            if (!abort) o.os.flush();
        } catch (Exception e) {
            err = msg(e);
        }
        try {
            o.os.close();
        } catch (Exception e) {
            if (err == null) err = msg(e);
        }
        if (abort || err != null) {
            try {
                DocumentsContract.deleteDocument(getContext().getContentResolver(), o.doc);
            } catch (Exception e) {
                // ignore
            }
        }
        if (err != null && !abort) call.reject(err);
        else call.resolve();
    }

    /** Копирует файл из кэша приложения (имя без путей) в выбранную папку. */
    @PluginMethod
    public void copyToFolder(PluginCall call) {
        String cache = call.getString("cacheName");
        if (cache == null || cache.contains("/") || cache.contains("\\") || cache.contains("..")) {
            call.reject("Некорректное имя файла");
            return;
        }
        File src = new File(getContext().getCacheDir(), cache);
        if (!src.isFile()) {
            call.reject("Файл не найден");
            return;
        }
        String name = call.getString("name");
        if (name == null || name.length() == 0) name = cache;
        Uri doc = null;
        InputStream in = null;
        OutputStream os = null;
        try {
            doc = createIn(call.getString("folder"), call.getString("dir"), name, call.getString("mime"));
            os = getContext().getContentResolver().openOutputStream(doc, "w");
            if (os == null) throw new IOException("Не удалось открыть файл для записи");
            in = new FileInputStream(src);
            byte[] buf = new byte[65536];
            long total = 0;
            int n;
            while ((n = in.read(buf)) > 0) {
                os.write(buf, 0, n);
                total += n;
            }
            os.flush();
            os.close();
            os = null;
            JSObject r = new JSObject();
            r.put("size", total);
            call.resolve(r);
        } catch (Exception e) {
            if (os != null) {
                try {
                    os.close();
                } catch (Exception e2) {
                    // ignore
                }
            }
            if (doc != null) {
                try {
                    DocumentsContract.deleteDocument(getContext().getContentResolver(), doc);
                } catch (Exception e3) {
                    // ignore
                }
            }
            call.reject(msg(e));
        } finally {
            if (in != null) {
                try {
                    in.close();
                } catch (Exception e4) {
                    // ignore
                }
            }
        }
    }

    private static String msg(Exception e) {
        String m = e.getMessage();
        return m == null || m.length() == 0 ? e.getClass().getSimpleName() : m;
    }

    @Override
    protected void handleOnDestroy() {
        McUpService.stop(getContext());
        synchronized (outs) {
            for (Out o : outs.values()) {
                try {
                    o.os.close();
                } catch (Exception e) {
                    // ignore
                }
            }
            outs.clear();
        }
        super.handleOnDestroy();
    }
}
