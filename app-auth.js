// ═══════════════════════════════════════════
//  AUTH — АВТОРИЗАЦИЯ
// ═══════════════════════════════════════════
let currentUser = null;

async function initAuth() {
  // Офлайн режим — используем сохранённые данные
  if(!navigator.onLine) {
    const savedLogin = localStorage.getItem('mc_login');
    const savedName = localStorage.getItem('mc_display_name');
    if(savedLogin && savedName) {
      currentUser = { display_name: savedName, login: savedLogin, id: localStorage.getItem('mc_user_id')||'' };
      hideAuthScreen();
      initSpaces();
      return;
    }
    showLoginScreen(savedLogin);
    return;
  }
  // Check for existing Supabase session
  const {data:{session}} = await sb.auth.getSession();
  if(session) {
    currentUser = session.user;
    // Load display name from profiles
    try {
      const {data} = await sb.from('profiles').select('display_name,login').eq('id', session.user.id).single();
      if(data) {
        currentUser.display_name = data.display_name;
        currentUser.login = data.login;
      }
    } catch(e) {}
    if(!currentUser.display_name) currentUser.display_name = localStorage.getItem('mc_display_name') || '';
    hideAuthScreen();
    initSpaces();
    return;
  }

  // No session — show auth screen
  const savedLogin = localStorage.getItem('mc_login');
  if(savedLogin) {
    showLoginScreen(savedLogin);
  } else {
    showRegisterScreen();
  }
}

// ─── SCREENS ────────────────────────────────
function showRegisterScreen() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('auth-reg').style.display = 'flex';
  document.getElementById('auth-log').style.display = 'none';
  setTimeout(()=>document.getElementById('auth-name').focus(), 300);
}

function showLoginScreen(login) {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('auth-reg').style.display = 'none';
  document.getElementById('auth-log').style.display = 'flex';
  if(login) document.getElementById('auth-log-login').value = login;
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
  const name     = document.getElementById('auth-name').value.trim();
  const login    = document.getElementById('auth-login').value.trim().toLowerCase().replace(/\s+/g,'_');
  const pwd      = document.getElementById('auth-pwd').value;
  const pwd2     = document.getElementById('auth-pwd2').value;
  const remember = document.getElementById('auth-remember').checked;

  if(!name)  { authShowErr('auth-reg-err','Введи имя'); return; }
  if(!login) { authShowErr('auth-reg-err','Введи логин'); return; }
  if(pwd.length < 4) { authShowErr('auth-reg-err','Пароль минимум 4 символа'); return; }
  if(pwd !== pwd2)   { authShowErr('auth-reg-err','Пароли не совпадают'); return; }

  const btn = document.getElementById('auth-reg-btn');
  btn.disabled = true; btn.textContent = 'Создаём...';

  // Check login uniqueness
  try {
    const {data:existing} = await sb.from('profiles').select('id').eq('login', login).maybeSingle();
    if(existing) { authShowErr('auth-reg-err','Логин занят — придумай другой'); btn.disabled=false; btn.textContent='Создать аккаунт'; return; }
  } catch(e) {}

  // Generate hidden email
  const email = `user_${uid().slice(0,10)}@mycards.app`;

  try {
    const {data, error} = await sb.auth.signUp({email, password:pwd});
    if(error) throw error;

    // Save profile with login and email
    await sb.from('profiles').insert({
      id: data.user.id,
      display_name: name,
      login: login,
      email: email
    });

    currentUser = data.user;
    currentUser.display_name = name;
    currentUser.login = login;

    if(remember) {
      localStorage.setItem('mc_login',        login);
      localStorage.setItem('mc_display_name', name);
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
  const login    = document.getElementById('auth-log-login').value.trim().toLowerCase();
  const pwd      = document.getElementById('auth-log-pwd').value;
  const remember = document.getElementById('auth-log-remember').checked;

  if(!login) { authShowErr('auth-log-err','Введи логин'); return; }
  if(!pwd)   { authShowErr('auth-log-err','Введи пароль'); return; }

  const btn = document.getElementById('auth-log-btn');
  btn.disabled = true; btn.textContent = 'Входим...';

  try {
    // Find email by login
    const {data:profile, error:pe} = await sb.from('profiles').select('email,display_name').eq('login', login).maybeSingle();
    if(pe || !profile) { authShowErr('auth-log-err','❌ Логин не найден'); btn.disabled=false; btn.textContent='Войти'; return; }

    const {data, error} = await sb.auth.signInWithPassword({email: profile.email, password: pwd});
    if(error) throw error;

    currentUser = data.user;
    currentUser.display_name = profile.display_name;
    currentUser.login = login;

    if(remember) {
      localStorage.setItem('mc_login',        login);
	  localStorage.setItem('mc_user_id', data.user.id);
      localStorage.setItem('mc_display_name', profile.display_name);
    } else {
      localStorage.removeItem('mc_login');
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
  localStorage.removeItem('mc_current_space');
  showRegisterScreen();
}

// ─── SWITCH ──────────────────────────────────
function switchToRegister() {
  document.getElementById('auth-reg').style.display = 'flex';
  document.getElementById('auth-log').style.display = 'none';
  setTimeout(()=>document.getElementById('auth-name').focus(), 100);
}

function switchToLogin() {
  document.getElementById('auth-reg').style.display = 'none';
  document.getElementById('auth-log').style.display = 'flex';
  setTimeout(()=>document.getElementById('auth-log-login').focus(), 100);
}
