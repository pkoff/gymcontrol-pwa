// ─────────────────────────────────────────────
// auth.js — Autenticação local offline
// ─────────────────────────────────────────────

const SESSION_KEY = 'gymcontrol_session';

function isLoggedIn() {
  try {
    const s = sessionStorage.getItem(SESSION_KEY);
    return s !== null;
  } catch { return false; }
}

function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY));
  } catch { return null; }
}

function setSession(user) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    id: user.id,
    username: user.username,
    loginAt: new Date().toISOString()
  }));
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

async function doLogin(username, password) {
  await openDB();
  const users = await dbGetAll('usuarios');
  const user = users.find(u => u.username === username && u.password === password);
  if (user) {
    setSession(user);
    return { ok: true, user };
  }
  return { ok: false, error: 'Usuário ou senha incorretos.' };
}

function requireLogin() {
  if (!isLoggedIn()) {
    showPage('login');
    return false;
  }
  return true;
}
