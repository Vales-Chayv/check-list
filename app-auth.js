// ═══════════════════════════════════════════
//  AUTH — АВТОРИЗАЦИЯ
// ═══════════════════════════════════════════
let currentUser = null;

async function initAuth() {
  // Check for existing Supabase session
  const {data:{session}} = await sb.auth.getSession();
  if(session) {
    currentUser = session.user;
    currentUser.display_name = localStorage.getItem('mc_display_name') || 'Пользователь';
    hideAuthScreen();
    initSpaces();
    return;
  }

  // Check saved credentials
  const savedEmail = localStorage.getItem('mc_auth_email');
  const savedName  = localStorage.getItem('mc_display_name');
  if(savedEmail && savedName) {
    showLoginScreen(savedName);
  } else {
    showRegisterScreen();
  }
}

// ─── SCREENS ────────────────────────────────
function showRegisterScreen() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('auth-reg').style.display   = 'flex';
  document.getElementById('auth-log').style.display   = 'none';
  setTimeout(()=>document.getElementById('auth-name').focus(), 300);
}

function showLoginScreen(name) {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('auth-reg').style.display   = 'none';
  document.getElementById('auth-log').style.display   = 'flex';
  document.getElementById('auth-log-name').textContent = name || '';
  setTimeout(()=>document.getElementById('auth-log-pwd').focus(), 300);
}

function hideAuthScreen() {
  document.getElementById('auth-screen').style.display = 'none';
}

function authShowErr(id, msg) {
  document.getElementById(id).textContent = msg;
}

// ─── REGISTER ───────────────────────────────
async function doRegister() {
  const name = document.getElementById('auth-name').value.trim();
  const pwd  = document.getElementById('auth-pwd').value;
  const pwd2 = document.getElementById('auth-pwd2').value;
  const remember = document.getElementById('auth-remember').checked;

  if(!name) { authShowErr('auth-reg-err','Введи имя'); return; }
  if(pwd.length < 4) { authShowErr('auth-reg-err','Пароль минимум 4 символа'); return; }
  if(pwd !== pwd2) { authShowErr('auth-reg-err','Пароли не совпадают'); return; }

  const btn = document.getElementById('auth-reg-btn');
  btn.disabled = true; btn.textContent = 'Создаём...';

  // Generate unique email (hidden from user)
  const email = `user_${uid()}@mycards.app`;

  try {
    const {data, error} = await sb.auth.signUp({email, password:pwd});
    if(error) throw error;

    // Save profile
    await sb.from('profiles').insert({id:data.user.id, display_name:name});

    currentUser = data.user;
    currentUser.display_name = name;

    if(remember) {
      localStorage.setItem('mc_auth_email',    email);
      localStorage.setItem('mc_display_name',  name);
    }

    hideAuthScreen();
    initSpaces();
  } catch(e) {
    authShowErr('auth-reg-err', 'Ошибка: ' + e.message);
    btn.disabled = false; btn.textContent = 'Создать аккаунт';
  }
}

// ─── LOGIN ───────────────────────────────────
async function doLoginAuth() {
  const pwd   = document.getElementById('auth-log-pwd').value;
  const email = localStorage.getItem('mc_auth_email');
  const name  = localStorage.getItem('mc_display_name');
  const remember = document.getElementById('auth-log-remember').checked;

  if(!pwd) { authShowErr('auth-log-err','Введи пароль'); return; }
  if(!email){ authShowErr('auth-log-err','Аккаунт не найден'); return; }

  const btn = document.getElementById('auth-log-btn');
  btn.disabled = true; btn.textContent = 'Входим...';

  try {
    const {data, error} = await sb.auth.signInWithPassword({email, password:pwd});
    if(error) throw error;

    currentUser = data.user;
    currentUser.display_name = name;

    if(!remember) {
      localStorage.removeItem('mc_auth_email');
      localStorage.removeItem('mc_display_name');
    }

    hideAuthScreen();
    initSpaces();
  } catch(e) {
    authShowErr('auth-log-err','❌ Неверный пароль');
    btn.disabled = false; btn.textContent = 'Войти';
  }
}

// ─── LOGOUT ─────────────────────────────────
async function logoutUser() {
  if(!confirm('Выйти из аккаунта?')) return;
  await sb.auth.signOut();
  currentUser = null;
  currentSpaceId = null; currentSpace = null;
  cards = []; cats = [];
  showRegisterScreen();
}

// ─── SWITCH to register/login ────────────────
function switchToRegister() {
  document.getElementById('auth-reg').style.display = 'flex';
  document.getElementById('auth-log').style.display = 'none';
  setTimeout(()=>document.getElementById('auth-name').focus(), 100);
}
function switchToLogin() {
  const name = localStorage.getItem('mc_display_name');
  if(name) { showLoginScreen(name); }
  else {
    document.getElementById('auth-reg').style.display = 'none';
    document.getElementById('auth-log').style.display = 'flex';
    setTimeout(()=>document.getElementById('auth-log-pwd').focus(), 100);
  }
}
