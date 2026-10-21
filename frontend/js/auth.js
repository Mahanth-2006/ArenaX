/* ==========================================================================
   ArenaX · auth.js — session, roles & route guards (+ landing page logic)
   --------------------------------------------------------------------------
   NOTE ON SECURITY: this is *UI-level* role handling for the demo. The real
   authorization boundary is the FastAPI backend, which validates the Bearer
   token and role on every request. Frontend guards only prevent users from
   wandering into screens they can't use.
   ========================================================================== */
'use strict';

const Auth = (() => {
  const LS_KEY = 'arenax.session';       // "remember me" → localStorage
  const SS_KEY = 'arenax.session';       // otherwise     → sessionStorage
  const ALIAS_KEY = 'aremax.session';

  /* --------------------------------------------------------- session I/O */
  function readSession() {
    try {
      const raw = localStorage.getItem(LS_KEY) || sessionStorage.getItem(SS_KEY) ||
                  localStorage.getItem(ALIAS_KEY) || sessionStorage.getItem(ALIAS_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.token || !s.user) return null;
      return s;
    } catch { return null; }
  }
  function writeSession(session, remember) {
    const raw = JSON.stringify(session);
    if (remember) {
      localStorage.setItem(LS_KEY, raw);
      localStorage.setItem(ALIAS_KEY, raw);
      sessionStorage.removeItem(SS_KEY);
      sessionStorage.removeItem(ALIAS_KEY);
    } else {
      sessionStorage.setItem(SS_KEY, raw);
      sessionStorage.setItem(ALIAS_KEY, raw);
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(ALIAS_KEY);
    }
  }
  function clearSession() {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(ALIAS_KEY);
    sessionStorage.removeItem(SS_KEY);
    sessionStorage.removeItem(ALIAS_KEY);
  }

  const session = () => readSession();
  const current = () => readSession();                    // { token, user }
  const user = () => { const s = readSession(); return s ? s.user : null; };
  const token = () => { const s = readSession(); return s ? s.token : null; };
  const isLoggedIn = () => !!token();
  const isAdmin = () => { const u = user(); return !!u && u.role === 'ADMIN'; };

  const BUILD_V = 'v31';
  const homeFor = (role) => (role === 'ADMIN' ? `admin.html?_b=${BUILD_V}` : `dashboard.html?_b=${BUILD_V}`);

  /* ------------------------------------------------------- auth actions */
  async function login({ username, password, role, remember }) {
    clearSession();
    const res = await API.login({ username, password, role });
    writeSession({ token: res.token, user: res.user }, !!remember);
    return res.user;
  }
  async function register(payload) {
    clearSession();
    const res = await API.register(payload);
    writeSession({ token: res.token, user: res.user }, true);
    return res.user;
  }
  function logout() {
    clearSession();
    location.href = `index.html?logout=1&_b=${BUILD_V}`;
  }
  function goHome() {
    const u = user();
    location.replace(u ? homeFor(u.role) : `index.html?_b=${BUILD_V}`);
  }

  /* ------------------------------------------------------- route guards */
  /**
   * Require a logged-in user (optionally of a specific role).
   * Returns the user object, or null after triggering a redirect /
   * an "Access Restricted" screen.
   */
  async function requireAuth({ role = null } = {}) {
    const s = readSession();
    if (!s) {
      const next = encodeURIComponent(location.pathname.split('/').pop() + location.search);
      location.replace(`index.html?next=${next}&_b=${BUILD_V}`);
      return null;
    }
    if (role && s.user.role !== role) {
      accessRestricted(s.user);
      return null;
    }
    return s.user;
  }

  const requirePlayer = () => requireAuth({ role: 'PLAYER' });
  const requireAdmin = () => requireAuth({ role: 'ADMIN' });

  /** Spec screen: player tries to open an admin page (or vice-versa). */
  function accessRestricted(u) {
    const host = document.getElementById('page') || document.body;
    const wrap = document.createElement('div');
    wrap.className = 'restrict-screen';
    wrap.innerHTML = `
      <div class="card" style="max-width:460px;padding:40px 34px;text-align:center" role="alert">
        <div class="state-icon warn" style="margin:0 auto 16px;width:74px;height:74px">
          ${UI.icon('lock', 'w-8 h-8')}
        </div>
        <h2 style="font-size:21px;font-weight:800;color:#fff">Access Restricted</h2>
        <p style="font-size:13.5px;color:var(--muted);margin-top:8px;line-height:1.6">
          ${u.role === 'ADMIN'
            ? 'This screen is for players. Admins get the full Control Center instead.'
            : "You don't have administrator permissions."}
        </p>
        <p class="mono" style="font-size:11px;color:var(--faint);margin-top:12px">
          403 · role CHECK failed: session role = '${u.role}'
        </p>
        <p style="font-size:12.5px;color:var(--muted);margin-top:14px">Redirecting to your <span id="rs-count">3</span>…</p>
        <button class="btn btn-primary" style="margin-top:18px" id="rs-go">Go to my ${u.role === 'ADMIN' ? 'Control Center' : 'dashboard'}</button>
      </div>`;
    document.body.appendChild(wrap);
    let n = 3;
    const el = wrap.querySelector('#rs-count');
    const tick = setInterval(() => {
      n -= 1;
      if (el) el.textContent = n > 0 ? `${homeFor(u.role)} in ${n}` : homeFor(u.role);
      if (n <= 0) { clearInterval(tick); location.replace(homeFor(u.role)); }
    }, 1000);
    wrap.querySelector('#rs-go').addEventListener('click', () => { clearInterval(tick); location.replace(homeFor(u.role)); });
  }

  /* ------------------------------------------------- landing page (index) */
  function initLanding() {
    UI.hydrateIcons(document);
    const params = new URLSearchParams(location.search);
    if (params.get('logout')) {
      clearSession();
    } else if (isLoggedIn() && !params.get('next')) {
      API.getCurrentUser().then(() => {
        goHome();
      }).catch(() => {
        clearSession();
      });
    }

    const card = document.getElementById('auth-card');

    /* ---------- mode switching: sign-in ↔ create account ---------- */
    const signin = document.getElementById('view-signin');
    const signup = document.getElementById('view-signup');
    const setMode = (mode, presetRole) => {
      const isSignup = mode === 'signup';
      signin.style.display = isSignup ? 'none' : 'block';
      signup.style.display = isSignup ? 'block' : 'none';
      const role = presetRole || segValue(isSignup ? 'signup-role-seg' : 'login-role-seg');
      setSegRole(role);
      card.classList.remove('shake');
    };
    document.querySelectorAll('[data-mode]').forEach(b =>
      b.addEventListener('click', () => setMode(b.dataset.mode, b.dataset.role || null)));

    function updateRoleUI(role) {
      const isAdm = role === 'ADMIN';
      const isSignup = signup && signup.style.display !== 'none';
      const title = document.getElementById('auth-title');
      const sub = document.getElementById('auth-sub');
      const uname = document.getElementById('login-username');
      const sbtn = document.getElementById('login-submit-btn');
      const regBtn = document.getElementById('signup-submit-btn');

      if (isSignup) {
        if (title) title.textContent = isAdm ? 'Admin Registration' : 'Player Registration';
        if (sub) sub.textContent = isAdm
          ? 'Enter admin credentials to configure tournaments, brackets, and matches'
          : 'Enter player credentials to create teams, manage rosters, and compete';
        if (regBtn) regBtn.innerHTML = `${isAdm ? 'Register as Admin' : 'Create Player Account'} ${UI.icon('arrowRight')}`;
      } else {
        if (title) title.textContent = isAdm ? 'Admin Control Center Sign In' : 'Player Sign In';
        if (sub) sub.textContent = isAdm ? 'Enter admin username & password to run tournaments' : 'Enter player username & password to manage teams & compete';
        if (uname) uname.placeholder = isAdm ? 'admin username' : 'player username';
        if (sbtn) sbtn.innerHTML = `${isAdm ? 'Sign in as Admin' : 'Sign in as Player'} ${UI.icon('arrowRight')}`;
      }
    }

    /* ---------- role segmented controls ---------- */
    function bindSeg(id, hiddenInputId) {
      const seg = document.getElementById(id);
      if (!seg) return;
      seg.querySelectorAll('.seg-btn').forEach(b => b.addEventListener('click', () => {
        seg.querySelectorAll('.seg-btn').forEach(x => { x.classList.remove('active'); x.setAttribute('aria-pressed', 'false'); });
        b.classList.add('active'); b.setAttribute('aria-pressed', 'true');
        const role = b.dataset.role;
        document.getElementById(hiddenInputId).value = role;
        updateRoleUI(role);
      }));
    }
    function segValue(id) { return document.querySelector(`#${id} .seg-btn.active`)?.dataset.role || 'PLAYER'; }
    function setSegRole(role) {
      ['login-role-seg', 'signup-role-seg'].forEach(id => {
        const seg = document.getElementById(id);
        if (!seg) return;
        seg.querySelectorAll('.seg-btn').forEach(x => {
          const on = x.dataset.role === role;
          x.classList.toggle('active', on); x.setAttribute('aria-pressed', String(on));
        });
      });
      updateRoleUI(role);
    }
    bindSeg('login-role-seg', 'login-role');
    bindSeg('signup-role-seg', 'signup-role');
    updateRoleUI('PLAYER');

    /* ---------- password visibility toggles ---------- */
    document.querySelectorAll('.pw-toggle').forEach(btn => btn.addEventListener('click', () => {
      const input = btn.parentElement.querySelector('input');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = UI.icon(show ? 'eyeOff' : 'eye', 'w-4 h-4');
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    }));

    /* ---------- forgot password (no backend mail service in the demo) ---------- */
    document.getElementById('forgot-link').addEventListener('click', (e) => {
      e.preventDefault();
      UI.toast({ type: 'warn', title: 'Password recovery unavailable', message: 'Recovery requires the backend mail service. Demo accounts are listed below the form.', duration: 5200 });
    });

    /* ---------- inline field error helpers ---------- */
    const showFieldError = (form, fields) => {
      form.querySelectorAll('.field-error').forEach(e => e.remove());
      form.querySelectorAll('.input').forEach(i => i.classList.remove('input-invalid'));
      Object.entries(fields || {}).forEach(([name, msg]) => {
        const input = form.querySelector(`[name="${name}"]`);
        if (!input) return;
        input.classList.add('input-invalid');
        const p = document.createElement('span');
        p.className = 'field-error';
        p.innerHTML = `${UI.icon('alert', 'w-3.5 h-3.5')} ${UI.esc(msg)}`;
        input.closest('.field').appendChild(p);
      });
    };
    const withLoading = (btn, fn) => async (e) => {
      e.preventDefault();
      btn.classList.add('loading'); btn.disabled = true;
      try { await fn(); }
      finally { btn.classList.remove('loading'); btn.disabled = false; }
    };

    /* ---------- LOGIN ---------- */
    const loginUsernameInput = document.getElementById('login-username');
    if (loginUsernameInput) {
      loginUsernameInput.addEventListener('input', (e) => {
        const val = e.target.value.trim().toLowerCase();
        if (val === 'admin' && segValue('login-role-seg') !== 'ADMIN') {
          setSegRole('ADMIN');
        }
      });
    }

    const loginForm = document.getElementById('login-form');
    loginForm.addEventListener('submit', withLoading(loginForm.querySelector('[type=submit]'), async () => {
      const formErr = document.getElementById('login-form-error');
      formErr.innerHTML = '';
      showFieldError(loginForm, {});
      const uname = document.getElementById('login-username').value.trim();
      let roleToUse = segValue('login-role-seg');
      if (uname.toLowerCase() === 'admin' && roleToUse !== 'ADMIN') {
        roleToUse = 'ADMIN';
        setSegRole('ADMIN');
      }

      try {
        const u = await Auth.login({
          username: uname,
          password: document.getElementById('login-password').value,
          role: roleToUse,
          remember: document.getElementById('remember-me').checked,
        });
        UI.toast({ type: 'success', title: `Welcome back, ${u.username}!`, message: `Signed in as ${u.role.toLowerCase()}.` });
        const next = params.get('next');
        setTimeout(() => { location.href = next ? decodeURIComponent(next) : homeFor(u.role); }, 350);
      } catch (err) {
        card.classList.add('shake');
        setTimeout(() => card.classList.remove('shake'), 600);
        if (err.code === 'ROLE_MISMATCH') {
          const suggested = (err.message && err.message.toUpperCase().includes('ADMIN')) ? 'ADMIN' : 'PLAYER';
          setSegRole(suggested);
          formErr.innerHTML = `<div class="warn-strip" style="background:rgba(56,189,248,0.1);border-color:#38BDF8;color:#38BDF8">${UI.icon('shield')}<span>Switched account type to <b>${suggested}</b>. Click Sign In to proceed.</span></div>`;
          UI.toast({ type: 'info', title: 'Role adjusted', message: `Switched account type to ${suggested}. Please click Sign In again.` });
          return;
        }
        if (err.fields) showFieldError(loginForm, err.fields);
        formErr.innerHTML = `<div class="warn-strip danger-strip">${UI.icon('xCircle')}<span>${UI.esc(err.message)}</span></div>`;
        UI.toast({ type: 'error', title: 'Login failed', message: err.message });
      }
    }));

    /* ---------- REGISTER ---------- */
    const signupForm = document.getElementById('signup-form');
    signupForm.addEventListener('submit', withLoading(signupForm.querySelector('[type=submit]'), async () => {
      const formErr = document.getElementById('signup-form-error');
      formErr.innerHTML = '';
      showFieldError(signupForm, {});
      const pw = document.getElementById('signup-password').value;
      const pw2 = document.getElementById('signup-confirm').value;
      if (pw !== pw2) { showFieldError(signupForm, { confirm: 'Passwords do not match.' }); return; }
      try {
        const u = await Auth.register({
          username: document.getElementById('signup-username').value.trim(),
          email: document.getElementById('signup-email').value.trim(),
          full_name: document.getElementById('signup-name').value.trim(),
          password: pw,
          role: segValue('signup-role-seg'),
        });
        UI.toast({ type: 'success', title: 'Account created 🎉', message: u.role === 'PLAYER' ? 'Create your team to start competing.' : 'Welcome, administrator.' });
        setTimeout(() => { location.href = homeFor(u.role); }, 500);
      } catch (err) {
        if (err.fields) showFieldError(signupForm, err.fields);
        formErr.innerHTML = `<div class="warn-strip danger-strip">${UI.icon('xCircle')}<span>${UI.esc(err.message)}</span></div>`;
        UI.toast({ type: 'error', title: 'Registration failed', message: err.message });
      }
    }));

    const resetBtn = document.getElementById('reset-demo');
    if (resetBtn) resetBtn.remove();

    /* mode from query (?mode=signup&role=ADMIN for "Admin Registration") */
    if (params.get('mode') === 'signup') setMode('signup', params.get('role') || null);
  }

  return {
    session, current, user, token, isLoggedIn, isAdmin,
    login, register, logout, goHome, homeFor,
    requireAuth, requirePlayer, requireAdmin, accessRestricted,
    initLanding, clearSession,
  };
})();

if (typeof window !== 'undefined') {
  window.Auth = Auth;
}

/* The landing page is the only page without a dedicated script file. */
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('auth-card')) Auth.initLanding();
});
