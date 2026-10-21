/* ==========================================================================
   ArenaX · ui.js
   Reusable presentation components: icons, toasts, modals, badges,
   progress, skeletons, empty/error states, navbar, admin shell,
   state-machine timeline, DB-lens panel and small animation helpers.
   Pure rendering — no data fetching lives here (that's api.js).
   ========================================================================== */
'use strict';

const UI = (() => {

  /* ---------------------------------------------------------------- icons */
  const P = {
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    userPlus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>',
    userMinus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="22" y1="11" x2="16" y2="11"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    checkCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    xCircle: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    chevronDown: '<polyline points="6 9 12 15 18 9"/>',
    chevronRight: '<polyline points="9 18 15 12 9 6"/>',
    arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    arrowLeft: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    play: '<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
    menu: '<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    crown: '<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
    gitBranch: '<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    ban: '<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
    award: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
    sword: '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    spinner: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
    history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    eyeOff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/>',
  };

  function icon(name, cls = 'w-5 h-5') {
    const d = P[name] || P.info;
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  }

  /* ------------------------------------------------------------- helpers */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const AVATAR_COLORS = ['#38BDF8', '#8B5CF6', '#34D399', '#FBBF24', '#F87171', '#F472B6', '#22D3EE', '#A3E635', '#FB923C', '#818CF8'];
  function colorFor(str) {
    let h = 0; const s = String(str || 'x');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }
  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  }
  function avatar(name, { size = '', square = false, color = null, title = '' } = {}) {
    const c = color || colorFor(name);
    const cls = `avatar ${size} ${square ? 'sq' : ''}`;
    return `<span class="${cls}" style="background:${c}1f;color:${c};border:1px solid ${c}55" ${title ? `title="${esc(title)}"` : ''} aria-hidden="true">${esc(initials(name))}</span>`;
  }

  function fmtDate(iso, opts) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-US', opts || { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return '—'; }
  }
  function fmtDateTime(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch { return '—'; }
  }
  function timeAgo(iso) {
    if (!iso) return '';
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`;
    return fmtDate(iso);
  }

  /* -------------------------------------------------------------- toasts */
  const TOAST_ICONS = { success: 'checkCircle', error: 'xCircle', info: 'info', warn: 'alert' };
  function toast({ type = 'info', title = '', message = '', duration = 4200 } = {}) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = `toast t-${type}`;
    el.setAttribute('role', 'status');
    el.innerHTML = `
      <span class="t-ico">${icon(TOAST_ICONS[type] || 'info')}</span>
      <div style="flex:1;min-width:0">
        <div class="t-title">${esc(title)}</div>
        ${message ? `<div class="t-msg">${esc(message)}</div>` : ''}
      </div>
      <button class="t-close" aria-label="Dismiss notification">${icon('x', 'w-3.5 h-3.5')}</button>
      <span class="t-prog" style="animation-duration:${duration}ms"></span>`;
    const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 260); };
    el.querySelector('.t-close').addEventListener('click', kill);
    root.appendChild(el);
    setTimeout(kill, duration);
    while (root.children.length > 4) root.firstElementChild.remove();
  }

  /* -------------------------------------------------------------- modals */
  function modal({ title = '', subtitle = '', body = '', footer = '', size = 'md', onClose = null } = {}) {
    const root = document.getElementById('modal-root') || document.body;
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `
      <div class="modal-backdrop" data-close></div>
      <div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title) || 'Dialog'}">
        ${title ? `<div class="modal-head">
            <div><h3>${esc(title)}</h3>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
            <button class="icon-btn" data-close aria-label="Close dialog">${icon('x')}</button>
          </div>` : ''}
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
      </div>`;
    root.appendChild(wrap);
    document.body.style.overflow = 'hidden';
    const close = () => {
      wrap.remove();
      if (!document.querySelector('.modal-wrap')) document.body.style.overflow = '';
      onClose && onClose();
    };
    wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
    const onKey = e => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
    const focusable = wrap.querySelector('input, textarea, select, .btn');
    focusable && setTimeout(() => focusable.focus(), 60);
    return { el: wrap, close };
  }

  /**
   * Confirmation dialog used before every destructive / transactional action.
   * onConfirm may return a Promise — the confirm button shows a spinner and
   * the dialog stays open on failure.
   */
  function confirmDialog({
    title = 'Are you sure?', message = '', warning = '', confirmLabel = 'Confirm',
    cancelLabel = 'Cancel', danger = false, onConfirm = async () => { }, dbNote = '',
  } = {}) {
    const m = modal({
      title, size: 'sm',
      body: `
        <p style="font-size:13.5px;color:var(--muted);line-height:1.6">${esc(message)}</p>
        ${warning ? `<div class="warn-strip ${danger ? 'danger-strip' : ''}" style="margin-top:14px">${icon('alert')}<span>${esc(warning)}</span></div>` : ''}
        ${dbNote ? `<div class="tx-stmt" style="margin-top:12px;border-left:2px solid rgba(56,189,248,.35);padding-left:10px">${dbNote}</div>` : ''}`,
      footer: `
        <button class="btn btn-ghost" data-close>${esc(cancelLabel)}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm>${esc(confirmLabel)}</button>`,
    });
    const btn = m.el.querySelector('[data-confirm]');
    btn.addEventListener('click', async () => {
      btn.classList.add('loading'); btn.disabled = true;
      try {
        const keepOpen = await onConfirm();
        if (!keepOpen) m.close();
        else { btn.classList.remove('loading'); btn.disabled = false; }
      } catch (err) {
        btn.classList.remove('loading'); btn.disabled = false;
        toast({ type: 'error', title: 'Action failed', message: err.message });
      }
    });
    return m;
  }

  /* --------------------------------------------------- status vocabulary */
  const TOURNAMENT_STATUS = {
    REGISTRATION_OPEN: { label: 'Registration Open', cls: 'badge-accent', pulse: true },
    LOCKED:            { label: 'Locked',            cls: 'badge-warn' },
    IN_PROGRESS:       { label: 'In Progress',       cls: 'badge-violet', pulse: true },
    COMPLETED:         { label: 'Completed',         cls: 'badge-win' },
  };
  const MATCH_STATUS = {
    PENDING:   { label: 'Pending',   cls: 'badge-slate' },
    WAITING:   { label: 'Waiting',   cls: 'badge-slate' },
    READY:     { label: 'Ready',     cls: 'badge-accent', pulse: true },
    COMPLETED: { label: 'Completed', cls: 'badge-win' },
  };
  function statusBadge(status, map = TOURNAMENT_STATUS) {
    const s = map[status] || { label: status || '—', cls: 'badge-slate' };
    return `<span class="badge ${s.cls}"><span class="badge-dot ${s.pulse ? 'pulse' : ''}"></span>${esc(s.label)}</span>`;
  }
  const matchBadge = (st) => statusBadge(st, MATCH_STATUS);
  const roleBadge = (role) => role === 'ADMIN'
    ? `<span class="badge badge-violet">${icon('shield', 'w-3 h-3')}Admin</span>`
    : `<span class="badge badge-accent">${icon('user', 'w-3 h-3')}Player</span>`;

  function dbChip(sql) {
    return `<span class="db-chip" title="Database rule behind this UI element">${icon('database')}${esc(sql)}</span>`;
  }

  /* ----------------------------------------------------------- progress */
  function progress(pct, { tone = 'accent', large = false } = {}) {
    const p = Math.max(0, Math.min(100, pct));
    const fill = tone === 'win' ? 'fill-win' : tone === 'warn' ? 'fill-warn' : tone === 'danger' ? 'fill-danger' : '';
    return `<div class="progress ${large ? 'progress-lg' : ''}" role="progressbar" aria-valuenow="${Math.round(p)}" aria-valuemin="0" aria-valuemax="100">
      <div class="progress-fill ${fill}" data-pct="${p}"></div></div>`;
  }
  /** Animate all progress bars inside a container after render. */
  function hydrateProgress(root = document) {
    requestAnimationFrame(() => {
      root.querySelectorAll('.progress-fill[data-pct]').forEach(el => { el.style.width = el.dataset.pct + '%'; });
    });
  }

  /* ------------------------------------------------------------ skeleton */
  const skelCard = () => `
    <div class="card card-pad" style="display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;gap:12px;align-items:center">
        <div class="skel skel-circle" style="width:42px;height:42px"></div>
        <div style="flex:1"><div class="skel skel-line" style="width:55%"></div>
        <div class="skel skel-line" style="width:35%;height:9px;margin-top:8px"></div></div>
      </div>
      <div class="skel skel-line" style="width:100%"></div>
      <div class="skel skel-line" style="width:80%"></div>
    </div>`;
  const skelGrid = (n = 3, cols = 'repeat(auto-fill,minmax(300px,1fr))') =>
    `<div style="display:grid;grid-template-columns:${cols};gap:16px">${Array.from({ length: n }, skelCard).join('')}</div>`;
  const skelTable = (rows = 5) => `
    <div class="tbl-wrap"><table class="tbl"><tbody>
      ${Array.from({ length: rows }, () => `<tr><td><div class="skel skel-line" style="width:${40 + Math.random() * 45}%"></div></td>
      <td><div class="skel skel-line" style="width:${40 + Math.random() * 40}%"></div></td>
      <td><div class="skel skel-line" style="width:${30 + Math.random() * 40}%"></div></td></tr>`).join('')}
    </tbody></table></div>`;
  const skelBracket = () => `
    <div style="display:flex;gap:48px;padding:20px;overflow:hidden">
      ${[0, 1, 2].map(r => `<div style="flex:1;display:flex;flex-direction:column;justify-content:space-around;gap:${20 + r * 30}px">
        ${Array.from({ length: 4 >> r }, () => `<div class="skel" style="height:86px;border-radius:12px"></div>`).join('')}
      </div>`).join('')}
    </div>`;

  /* ------------------------------------------------- empty / error states */
  function emptyState({ icon: ic = 'layers', title = 'Nothing here yet', message = '', action = '', tone = '' } = {}) {
    return `<div class="state card">
      <div class="state-icon ${tone}">${icon(ic)}</div>
      <h3>${esc(title)}</h3>
      ${message ? `<p>${esc(message)}</p>` : ''}
      ${action ? `<div class="state-action">${action}</div>` : ''}
    </div>`;
  }
  function errorState(err, retryFnName = 'location.reload()') {
    const offline = err && (err.status === 0 || err.code === 'NETWORK_ERROR');
    if (err && (err.status === 401 || err.code === 'UNAUTHORIZED' || (err.message && err.message.toLowerCase().includes('session')))) {
      if (window.Auth && typeof Auth.clearSession === 'function') Auth.clearSession();
      location.replace('index.html');
      return '';
    }
    return `<div class="state card">
      <div class="state-icon dgr">${icon(offline ? 'zap' : 'alert')}</div>
      <h3>${offline ? 'Server unavailable' : 'Something went wrong'}</h3>
      <p>${esc((err && err.message) || 'Unexpected error. Please try again.')}</p>
      ${offline ? '<p style="font-size:12px" class="mono">GET ' + esc((err && err.url) || API_BASE_URL) + ' → network error</p>' : ''}
      <div class="state-action"><button class="btn btn-outline" onclick="${retryFnName}">${icon('refresh')}Retry</button></div>
    </div>`;
  }

  /* ------------------------------------------- tournament state timeline */
  const TL_STEPS = [
    { key: 'REGISTRATION_OPEN', label: 'Registration Open', sub: 'Teams can register', ic: 'unlock' },
    { key: 'LOCKED', label: 'Locked', sub: 'Capacity reached · bracket generated', ic: 'lock' },
    { key: 'IN_PROGRESS', label: 'In Progress', sub: 'Matches underway', ic: 'play' },
    { key: 'COMPLETED', label: 'Completed', sub: 'Champion declared', ic: 'trophy' },
  ];
  function timeline(current) {
    const idx = TL_STEPS.findIndex(s => s.key === current);
    return `<div class="timeline" aria-label="Tournament lifecycle: ${TL_STEPS.map(s => s.label).join(' → ')}">
      ${TL_STEPS.map((s, i) => {
        const state = i < idx ? 'done' : i === idx ? 'current' : '';
        return `<div class="tl-step ${state}">
          <div class="tl-node" aria-hidden="true">${i < idx ? icon('check') : icon(s.ic)}</div>
          <div class="tl-meta"><div class="tl-label">${s.label}</div><div class="tl-sub">${s.sub}</div></div>
          ${i < TL_STEPS.length - 1 ? '<div class="tl-bar"><span class="fill"></span></div>' : ''}
        </div>`;
      }).join('')}
    </div>`;
  }

  /* ---------------------------------------------------------- DB lens */
  function dbLens() {
    return '';
  }
  function highlightSql(s) {
    return esc(s).replace(/\b(INSERT INTO|UPDATE|DELETE FROM|SELECT|SET|WHERE|VALUES|BEGIN|COMMIT|ROLLBACK|AND|ON)\b/g, '<span class="kw">$1</span>');
  }

  /* --------------------------------------------------------- animations */
  function flyChip(fromRect, toRect, label) {
    if (!fromRect || !toRect) return;
    const chip = document.createElement('div');
    chip.className = 'fly-chip';
    chip.innerHTML = `${icon('trophy', 'w-3.5 h-3.5')} ${esc(label)}`;
    document.body.appendChild(chip);
    const fx = fromRect.left + fromRect.width / 2 - 60, fy = fromRect.top + fromRect.height / 2 - 15;
    const tx = toRect.left + toRect.width / 2 - 60, ty = toRect.top + toRect.height / 2 - 15;
    const arc = Math.min(fy, ty) - 70;
    chip.animate([
      { transform: `translate(${fx}px, ${fy}px) scale(0.7)`, opacity: 0 },
      { transform: `translate(${fx}px, ${fy}px) scale(1)`, opacity: 1, offset: 0.12 },
      { transform: `translate(${(fx + tx) / 2}px, ${arc}px) scale(1.06)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${tx}px, ${ty}px) scale(0.85)`, opacity: 0.15 },
    ], { duration: 900, easing: 'cubic-bezier(.4,0,.2,1)' }).onfinish = () => chip.remove();
  }

  function confetti(count = 70) {
    const colors = ['#38BDF8', '#34D399', '#FBBF24', '#8B5CF6', '#F472B6', '#F87171'];
    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'confetti-piece';
      p.style.left = Math.random() * 100 + 'vw';
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = 2.4 + Math.random() * 2.2 + 's';
      p.style.animationDelay = Math.random() * 0.8 + 's';
      p.style.transform = `rotate(${Math.random() * 360}deg)`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 5200);
    }
  }

  /* ------------------------------------------------------------- navbar */
  const PLAYER_LINKS = [
    { key: 'dashboard', href: 'dashboard.html', label: 'Dashboard', ic: 'home' },
    { key: 'team', href: 'team.html', label: 'My Team', ic: 'users' },
    { key: 'tournaments', href: 'tournament.html', label: 'Tournaments', ic: 'trophy' },
    { key: 'history', href: 'history.html', label: 'History', ic: 'history' },
  ];

  function logoMark(size = 30) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs><linearGradient id="arx-lg" x1="0" y1="0" x2="32" y2="32">
        <stop offset="0" stop-color="#38BDF8"/><stop offset="1" stop-color="#8B5CF6"/></linearGradient></defs>
      <path d="M16 2 28 9v14L16 30 4 23V9z" stroke="url(#arx-lg)" stroke-width="2" fill="rgba(56,189,248,.06)"/>
      <path d="M11.5 11.5 20.5 20.5M20.5 11.5 11.5 20.5" stroke="url(#arx-lg)" stroke-width="2.6" stroke-linecap="round"/>
    </svg>`;
  }
  const logo = (href = 'dashboard.html', size = 30) =>
    `<a class="logo" href="${href}" aria-label="ArenaX home">${logoMark(size)}<span class="logo-text">ARENA<span class="x">X</span></span></a>`;

  function mockChip() {
    const mock = (typeof USE_MOCK !== 'undefined') && USE_MOCK;
    return mock
      ? `<span class="mock-chip" title="Running against the built-in mock backend (localStorage). Point API_BASE_URL / USE_MOCK in js/api.js to your FastAPI server to go live."><span class="badge-dot"></span>Demo Data</span>`
      : `<span class="mock-chip" style="color:var(--win);border-color:rgba(52,211,153,.35);background:rgba(52,211,153,.08)" title="Connected to ${esc(typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '')}"><span class="badge-dot"></span>Live API</span>`;
  }

  /**
   * Render the player top navigation into #nav-root.
   * active: one of dashboard | team | tournaments | history
   */
  async function renderPlayerNav(active = 'dashboard', user = null) {
    const root = document.getElementById('nav-root');
    if (!root) return;
    user = user || (window.Auth && Auth.current() && Auth.current().user) || {};
    const isAdminUser = user.role === 'ADMIN';

    const ADMIN_TOP_LINKS = [
      { key: 'admin', href: 'admin.html', label: 'Control Center', ic: 'grid' },
      { key: 'create', href: 'admin.html?view=create', label: 'Create Tournament', ic: 'plus' },
      { key: 'tournaments', href: 'tournament.html', label: 'Tournaments', ic: 'trophy' },
      { key: 'history', href: 'history.html', label: 'History', ic: 'history' },
    ];

    const currentLinks = isAdminUser ? ADMIN_TOP_LINKS : PLAYER_LINKS;

    const isActive = (l) => {
      const here = location.pathname.split('/').pop() + location.search;
      if (l.key === 'admin') return here.startsWith('admin.html') && (!here.includes('view=') || here.includes('view=overview') || here.includes('view=manage'));
      if (l.key === 'create') return here.includes('view=create');
      if (l.key === 'dashboard') return here.startsWith('dashboard.html') && !here.includes('tab=tournaments');
      if (l.key === 'tournaments') return (here.startsWith('dashboard.html') && here.includes('tab=tournaments')) || here.startsWith('tournament.html') || here.includes('view=tournaments');
      return here.startsWith(l.key + '.html');
    };

    root.innerHTML = `
      <header class="nav">
        <div class="nav-inner">
          ${logo(isAdminUser ? 'admin.html' : 'dashboard.html')}
          <nav class="nav-links" aria-label="Primary" id="nav-links-desktop">
            ${currentLinks.map(l => `<a class="nav-link ${isActive(l) ? 'active' : ''}" href="${l.href}">${icon(l.ic)}${l.label}</a>`).join('')}
          </nav>
          <div class="nav-right">
            <span class="hidden md:inline-flex">${mockChip()}</span>
            <div class="bell-wrap">
              <button class="icon-btn" id="bell-btn" aria-label="Notifications" aria-haspopup="true">${icon('bell')}<span id="bell-count"></span></button>
              <div class="dropdown" id="bell-dd" style="width:340px;max-width:88vw" role="menu">
                <div class="dd-head" style="display:flex;align-items:center;justify-content:space-between">
                  <b style="font-size:13px">Notifications</b>
                  <button class="btn btn-ghost btn-sm" id="mark-read">Mark all read</button>
                </div>
                <div class="notif-list" id="notif-list"><div style="padding:22px;text-align:center;color:var(--faint);font-size:12.5px">Loading…</div></div>
              </div>
            </div>
            <div style="position:relative">
              <button class="user-btn" id="user-btn" aria-label="Account menu" aria-haspopup="true">
                ${avatar(user.full_name || user.username, { size: 'sm' })}
                <span class="uname hidden sm:block">${esc(user.username || '')}</span>
                ${icon('chevronDown', 'w-4 h-4 text-slate-500')}
              </button>
              <div class="dropdown" id="user-dd" role="menu">
                <div class="dd-head">
                  <div style="display:flex;align-items:center;gap:10px">
                    ${avatar(user.full_name || user.username)}
                    <div>
                      <div style="font-size:13.5px;font-weight:700;color:#fff">${esc(user.full_name || user.username || '')}</div>
                      <div style="margin-top:3px">${roleBadge(user.role)}</div>
                    </div>
                  </div>
                </div>
                ${isAdminUser ? `
                  <a class="dd-item" href="admin.html">${icon('grid')}Admin Control Center</a>
                  <a class="dd-item" href="admin.html?view=create">${icon('plus')}Create Tournament</a>
                  <a class="dd-item" href="history.html">${icon('history')}Tournament History</a>
                ` : `
                  <a class="dd-item" href="team.html">${icon('users')}My Team</a>
                  <a class="dd-item" href="history.html">${icon('history')}Tournament History</a>
                `}
                <div class="dd-sep"></div>
                <button class="dd-item danger" id="logout-btn">${icon('logout')}Log out</button>
              </div>
            </div>
            <button class="icon-btn lg:hidden" id="nav-burger" aria-label="Open menu" aria-expanded="false">${icon('menu')}</button>
          </div>
        </div>
      </header>
      <div class="nav-spacer"></div>
      <div id="mobile-menu" class="lg:hidden" style="display:none;position:fixed;top:var(--nav-h);left:0;right:0;z-index:45;background:#0d1524f2;border-bottom:1px solid var(--edge);padding:10px 16px;backdrop-filter:blur(12px)">
        ${currentLinks.map(l => `<a class="nav-link" style="width:100%;padding:12px" href="${l.href}">${icon(l.ic)}${l.label}</a>`).join('')}
      </div>`;

    /* dropdown behaviour */
    const bindDD = (btnId, ddId) => {
      const btn = document.getElementById(btnId), dd = document.getElementById(ddId);
      if (!btn || !dd) return;
      btn.addEventListener('click', e => {
        e.stopPropagation();
        document.querySelectorAll('.dropdown.open').forEach(d => { if (d !== dd) d.classList.remove('open'); });
        dd.classList.toggle('open');
      });
    };
    bindDD('user-btn', 'user-dd');
    bindDD('bell-btn', 'bell-dd');
    document.addEventListener('click', () => document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open')));
    document.querySelectorAll('.dropdown').forEach(d => d.addEventListener('click', e => e.stopPropagation()));

    const burger = document.getElementById('nav-burger');
    burger && burger.addEventListener('click', () => {
      const mm = document.getElementById('mobile-menu');
      const open = mm.style.display === 'none';
      mm.style.display = open ? 'block' : 'none';
      burger.setAttribute('aria-expanded', String(open));
    });

    document.getElementById('logout-btn').addEventListener('click', () => Auth.logout());
    document.getElementById('mark-read').addEventListener('click', async () => {
      try { await API.markNotificationsRead(); loadBell(true); } catch { /* ignore */ }
    });
    loadBell();
  }

  async function loadBell(force = false) {
    const list = document.getElementById('notif-list');
    if (!list) return;
    try {
      const notes = await API.getNotifications();
      const unread = notes.filter(n => !n.read).length;
      const badge = document.getElementById('bell-count');
      badge.innerHTML = unread ? `<span class="bell-dot">${unread > 9 ? '9+' : unread}</span>` : '';
      list.innerHTML = notes.length ? notes.slice(0, 12).map(n => `
        <div class="notif-item ${n.read ? '' : 'unread'}">
          <span style="color:${n.type === 'win' ? 'var(--warn)' : n.type === 'champion' ? 'var(--win)' : 'var(--accent)'};margin-top:2px">${icon(n.type === 'champion' ? 'trophy' : n.type === 'win' ? 'award' : n.type === 'lose' ? 'flag' : 'info', 'w-4 h-4')}</span>
          <div style="min-width:0">
            <div class="n-title">${esc(n.title)}</div>
            <div class="n-body">${esc(n.body)}</div>
            <div class="n-time">${timeAgo(n.created_at)}</div>
          </div>
        </div>`).join('')
        : `<div style="padding:26px;text-align:center;color:var(--faint);font-size:12.5px">${icon('bell', 'w-6 h-6 mx-auto mb-2 opacity-50')}<br>No notifications yet</div>`;
      if (force) toast({ type: 'success', title: 'All caught up', message: 'Notifications marked as read.' });
    } catch {
      list.innerHTML = `<div style="padding:20px;text-align:center;color:var(--faint);font-size:12.5px">Could not load notifications.</div>`;
    }
  }

  /* ---------------------------------------------------- admin shell */
  const ADMIN_LINKS = [
    { view: 'overview', label: 'Overview', ic: 'grid' },
    { view: 'create', label: 'Create Tournament', ic: 'plus' },
    { view: 'tournaments', label: 'Tournaments', ic: 'trophy' },
    { view: 'users', label: 'Users', ic: 'users' },
    { view: 'teams', label: 'Teams', ic: 'shield' },
  ];
  function renderAdminShell(activeView, user) {
    document.body.innerHTML = `
      <div class="admin-shell">
        <div class="sidebar-backdrop" id="sb-backdrop"></div>
        <aside class="sidebar" id="sidebar" aria-label="Admin navigation">
          <div class="side-head">${logo('admin.html', 26)}</div>
          <nav class="side-nav">
            <div class="side-label">Control Center</div>
            ${ADMIN_LINKS.map(l => `
              <a class="side-link ${l.view === activeView ? 'active' : ''}" href="admin.html?view=${l.view}">${icon(l.ic)}${l.label}</a>`).join('')}
          </nav>
          <div class="side-foot">
            <div class="card" style="padding:11px 12px;background:rgba(7,11,18,.5)">
              <div style="display:flex;align-items:center;gap:9px">
                ${avatar(user.full_name || user.username, { size: 'sm' })}
                <div style="min-width:0">
                  <div style="font-size:12.5px;font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis">${esc(user.full_name || user.username)}</div>
                  <div style="margin-top:2px">${roleBadge('ADMIN')}</div>
                </div>
              </div>
              <button class="btn btn-ghost btn-sm btn-block" style="margin-top:9px" id="admin-logout">${icon('logout')}Log out</button>
            </div>
          </div>
        </aside>
        <div class="admin-main">
          <header class="admin-topbar">
            <button class="icon-btn lg:hidden" id="sb-toggle" aria-label="Toggle sidebar" aria-expanded="false">${icon('menu')}</button>
            <h1 id="admin-title">Admin Control Center</h1>
            <div class="nav-right">
              <span class="hidden md:inline-flex">${mockChip()}</span>
              <div class="bell-wrap">
                <button class="icon-btn" id="bell-btn" aria-label="Notifications">${icon('bell')}<span id="bell-count"></span></button>
                <div class="dropdown" id="bell-dd" style="width:340px;max-width:88vw">
                  <div class="dd-head" style="display:flex;align-items:center;justify-content:space-between">
                    <b style="font-size:13px">Notifications</b>
                    <button class="btn btn-ghost btn-sm" id="mark-read">Mark all read</button>
                  </div>
                  <div class="notif-list" id="notif-list"><div style="padding:22px;text-align:center;color:var(--faint);font-size:12.5px">Loading…</div></div>
                </div>
              </div>
              ${avatar(user.full_name || user.username, { size: 'sm' })}
            </div>
          </header>
          <main class="admin-view" id="admin-view"></main>
        </div>
      </div>
      <div id="toast-root" class="fixed z-[90] top-4 right-4 flex flex-col gap-2 w-[360px] max-w-[92vw]" aria-live="polite"></div>
      <div id="modal-root"></div>`;

    const sb = document.getElementById('sidebar'), bd = document.getElementById('sb-backdrop');
    const toggle = () => { sb.classList.toggle('open'); bd.classList.toggle('open'); };
    document.getElementById('sb-toggle').addEventListener('click', toggle);
    bd.addEventListener('click', toggle);
    document.getElementById('admin-logout').addEventListener('click', () => Auth.logout());
    const bindDD = (btnId, ddId) => {
      const btn = document.getElementById(btnId), dd = document.getElementById(ddId);
      btn && dd && btn.addEventListener('click', e => { e.stopPropagation(); dd.classList.toggle('open'); });
    };
    bindDD('bell-btn', 'bell-dd');
    document.addEventListener('click', () => document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open')));
    document.querySelectorAll('.dropdown').forEach(d => d.addEventListener('click', e => e.stopPropagation()));
    document.getElementById('mark-read').addEventListener('click', async () => {
      try { await API.markNotificationsRead(); loadBell(true); } catch { /* ignore */ }
    });
    loadBell();
  }

  function setAdminTitle(title) {
    const el = document.getElementById('admin-title');
    if (el) el.textContent = title;
  }

  /* ------------------------------------------------ small shared pieces */
  function searchInput(placeholder, id, value = '') {
    return `<div class="search-wrap" style="min-width:220px">
      ${icon('search')}
      <input class="input" id="${id}" type="search" placeholder="${esc(placeholder)}" value="${esc(value)}" aria-label="${esc(placeholder)}">
    </div>`;
  }

  function pageHeader({ title, sub = '', actions = '' }) {
    return `<div class="section-head">
      <div><h2 style="font-size:22px;font-weight:800;letter-spacing:-0.02em;color:#fff">${esc(title)}</h2>
      ${sub ? `<p class="section-sub">${sub}</p>` : ''}</div>
      ${actions ? `<div style="display:flex;gap:9px;flex-wrap:wrap">${actions}</div>` : ''}
    </div>`;
  }

  /* replace <span data-icon="name"> placeholders in static HTML */
  function hydrateIcons(root = document) {
    root.querySelectorAll('[data-icon]').forEach(el => {
      el.outerHTML = icon(el.dataset.icon, el.dataset.size || 'w-4 h-4');
    });
  }

  return {
    icon, esc, avatar, colorFor, initials, hydrateIcons,
    fmtDate, fmtDateTime, timeAgo,
    toast, modal, confirmDialog,
    statusBadge, matchBadge, roleBadge, dbChip,
    progress, hydrateProgress,
    skelCard, skelGrid, skelTable, skelBracket,
    emptyState, errorState,
    timeline, dbLens, highlightSql,
    flyChip, confetti,
    renderPlayerNav, renderAdminShell, setAdminTitle, loadBell,
    logo, logoMark, mockChip,
    searchInput, pageHeader,
    TOURNAMENT_STATUS, MATCH_STATUS, TL_STEPS,
  };
})();

if (typeof window !== 'undefined') {
  window.UI = UI;
}
