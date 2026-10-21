/* ==========================================================================
   ArenaX · admin.js — Admin Control Center
   Page: admin.html?view=overview|create|tournaments|manage|matches|users|teams
   Views:
     overview    Admin Control Center stats + active tournaments + tx feed
     create      tournament creation with capacity CHECK cards + live bracket
     tournaments full catalog table with lifecycle filters
     manage      single tournament: state timeline, teams, bracket, DB lens
     matches     cross-tournament match queue with winner selection
     users/teams constrained admin tables
   ========================================================================== */
'use strict';

const Admin = (() => {
  let state = { user: null, view: 'overview', params: new URLSearchParams(location.search) };
  const mount = () => document.getElementById('admin-view');
  const isAdmin = () => true; // guarded before render

  function getTournamentStruct(capacity) {
    const cap = Math.max(2, Number(capacity) || 4);
    let p = 1;
    while (p < cap) p *= 2;
    const rounds = Math.max(1, Math.round(Math.log2(p)));
    const matches = p - 1;
    const byes = p - cap;
    const label = byes > 0
      ? `${cap} Teams Knockout · ${rounds} Rounds · ${matches} Matches (${byes} Byes)`
      : `${cap} Teams Knockout · ${rounds} Rounds · ${matches} Matches`;
    return { rounds, matches, byes, label };
  }

  /* ==================================================================== */
  /* OVERVIEW                                                              */
  /* ==================================================================== */
  async function viewOverview() {
    UI.setAdminTitle('Admin Control Center');
    const m = mount();
    m.innerHTML = `<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">${Array.from({ length: 4 }, UI.skelCard).join('')}</div><div class="mt-6">${UI.skelTable(5)}</div>`;
    try {
      const [stats, tournaments] = await Promise.all([
        API.getAdminStats(), API.getTournaments(),
      ]);
      const list = Array.isArray(tournaments) ? tournaments : (tournaments?.tournaments || []);
      const active = list.filter(t => t.status === 'LIVE' || t.status === 'ONGOING' || t.status === 'OPEN' || t.status === 'REGISTRATION_OPEN' || t.status === 'LOCKED');

      // Fetch bracket data for all active tournaments that have brackets
      const bracketsMap = {};
      await Promise.all(active.map(async (t) => {
        try {
          const b = await API.getBracket(t.id);
          if (b && b.rounds && b.rounds.some(r => r.matches && r.matches.length)) {
            bracketsMap[t.id] = b;
          }
        } catch {
          bracketsMap[t.id] = null;
        }
      }));

      m.innerHTML = `
        <div class="fade-up" style="display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:20px">
          <div>
            <h2 style="font-size:23px;font-weight:800;letter-spacing:-0.02em;color:#fff">Admin Control Center</h2>
            <p class="section-sub">Live tournament management, real-time bracket progression, and database tracking.</p>
          </div>
          <a class="btn btn-primary" href="admin.html?view=create">${UI.icon('plus')}Create Tournament</a>
        </div>

        <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          ${statCard('Total Users', stats.total_users, 'user', `${stats.total_players} players · ${stats.total_admins} admins`)}
          ${statCard('Total Teams', stats.total_teams, 'users', `${stats.total_registrations} registrations all-time`, 'i-violet')}
          ${statCard('Active Tournaments', stats.active_tournaments, 'trophy', `${stats.open_tournaments} open · ${stats.locked_tournaments} locked · ${stats.in_progress_tournaments} in progress`, 'i-warn')}
          ${statCard('Completed', stats.completed_tournaments, 'award', `${stats.ready_matches} matches ready for results`, 'i-win')}
        </section>

        <section class="mt-8">
          <div class="section-head">
            <div>
              <h2 class="section-title">${UI.icon('play')} Current Live Tournaments & Rounds</h2>
              <p class="section-sub">Live match progression — select winners to advance teams through parent matches in real time.</p>
            </div>
            <a class="btn btn-outline btn-sm" href="admin.html?view=tournaments">${UI.icon('list')}View All Tournaments</a>
          </div>

          ${active.length ? `
            <div style="display:flex;flex-direction:column;gap:20px">
              ${active.map(t => {
                const b = bracketsMap[t.id];
                const pct = Math.round((t.registered_count / t.capacity) * 100);
                return `
                <div class="card card-pad fade-up" style="border:1px solid var(--edge)">
                  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px">
                    <div>
                      <div style="display:flex;align-items:center;gap:10px">
                        <span style="font-size:18px;font-weight:800;color:#fff">${UI.esc(t.name)}</span>
                        ${UI.statusBadge(t.status)}
                      </div>
                      <div class="mono" style="font-size:11px;color:var(--faint);margin-top:4px">
                        ${t.capacity}-Team Knockout · ${t.registered_count}/${t.capacity} Teams Registered
                      </div>
                    </div>
                    <div style="display:flex;gap:8px">
                      <a class="btn btn-ghost btn-sm" href="tournament.html?id=${t.id}&tab=bracket">${UI.icon('eye')}Full Bracket</a>
                      <a class="btn btn-outline btn-sm" href="admin.html?view=manage&id=${t.id}">${UI.icon('settings')}Manage</a>
                    </div>
                  </div>

                  ${b && b.rounds && b.rounds.length ? `
                    <div style="margin-top:16px">
                      <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px">
                        Tournament Rounds
                      </div>
                      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-${Math.min(b.rounds.length, 4)}">
                        ${b.rounds.map(r => `
                          <div style="background:rgba(255,255,255,0.02);border:1px solid var(--edge);border-radius:10px;padding:12px">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;border-bottom:1px solid var(--edge);padding-bottom:6px">
                              <span style="font-weight:700;color:#fff;font-size:13px">${UI.esc(r.name)}</span>
                              <span class="mono" style="font-size:10px;color:var(--accent)">Round ${r.number}</span>
                            </div>
                            <div style="display:flex;flex-direction:column;gap:8px">
                              ${r.matches.map(m => `
                                <div style="background:var(--card);border:1px solid var(--edge);border-radius:6px;padding:8px;font-size:12px">
                                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                                    <span class="mono" style="font-size:10px;color:var(--faint)">Match #${m.number}</span>
                                    ${UI.matchBadge(m.status)}
                                  </div>
                                  <div style="display:flex;flex-direction:column;gap:4px">
                                    <div style="display:flex;justify-content:space-between;align-items:center">
                                      <span style="font-weight:${m.winner_id && m.team1 && m.winner_id === m.team1.id ? '700' : '400'};color:${m.winner_id && m.team1 && m.winner_id === m.team1.id ? 'var(--win)' : '#fff'}">
                                        ${m.team1 ? UI.esc(m.team1.name) : '<i style="color:var(--faint)">TBD</i>'}
                                      </span>
                                      ${m.winner_id && m.team1 && m.winner_id === m.team1.id ? '<span style="color:var(--win);font-size:10px">✓ Winner</span>' : (m.status === 'COMPLETED' && m.team1 ? '<span style="color:var(--danger);font-size:10px">Eliminated</span>' : '')}
                                    </div>
                                    <div style="display:flex;justify-content:space-between;align-items:center">
                                      <span style="font-weight:${m.winner_id && m.team2 && m.winner_id === m.team2.id ? '700' : '400'};color:${m.winner_id && m.team2 && m.winner_id === m.team2.id ? 'var(--win)' : '#fff'}">
                                        ${m.team2 ? UI.esc(m.team2.name) : '<i style="color:var(--faint)">TBD</i>'}
                                      </span>
                                      ${m.winner_id && m.team2 && m.winner_id === m.team2.id ? '<span style="color:var(--win);font-size:10px">✓ Winner</span>' : (m.status === 'COMPLETED' && m.team2 ? '<span style="color:var(--danger);font-size:10px">Eliminated</span>' : '')}
                                    </div>
                                  </div>
                                  ${m.status === 'READY' ? `
                                    <div style="margin-top:8px;padding-top:6px;border-top:1px dashed var(--edge)">
                                      <button class="btn btn-primary btn-sm btn-block" style="font-size:11px;padding:4px 8px" data-overview-pick="${t.id}" data-match-id="${m.id}">
                                        ${UI.icon('trophy', 'w-3 h-3')}Select Winner
                                      </button>
                                    </div>
                                  ` : ''}
                                </div>
                              `).join('')}
                            </div>
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  ` : `
                    <div style="margin-top:14px;background:rgba(255,255,255,0.02);border:1px solid var(--edge);border-radius:8px;padding:14px">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                        <span style="font-size:13px;color:var(--muted)">Registration in progress — ${t.remaining_slots} slot${t.remaining_slots === 1 ? '' : 's'} remaining until bracket auto-generation:</span>
                        <span class="mono" style="font-size:12px;font-weight:700">${t.registered_count} / ${t.capacity} teams</span>
                      </div>
                      ${UI.progress(pct, { tone: 'accent' })}
                    </div>
                  `}
                </div>
                `;
              }).join('')}
            </div>
          ` : `
            <div class="card">${UI.emptyState({ icon: 'trophy', title: 'No active tournaments', message: 'Create a tournament to open registration and start live rounds.', action: `<a class="btn btn-primary" href="admin.html?view=create">${UI.icon('plus')}Create Tournament</a>` })}</div>
          `}
        </section>

`;
      UI.hydrateProgress(m);

      // Wire up overview winner selection buttons
      m.querySelectorAll('[data-overview-pick]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const tId = btn.dataset.overviewPick;
          const matchId = parseInt(btn.dataset.matchId, 10);
          const bData = bracketsMap[tId];
          if (!bData) return;
          let targetMatch = null;
          for (const round of bData.rounds) {
            for (const match of round.matches) {
              if (match.id === matchId) {
                targetMatch = match;
                break;
              }
            }
            if (targetMatch) break;
          }
          if (targetMatch) {
            Bracket.openMatchModal(targetMatch, bData, {
              canManage: true,
              onWinner: async () => {
                await viewOverview();
                UI.loadBell();
              }
            });
          }
        });
      });
    } catch (err) { m.innerHTML = UI.errorState(err, 'location.reload()'); }
  }

  const statCard = (label, value, ic, sub, tone = '') => `
    <div class="card card-pad stat-card card-hover fade-up">
      <div style="display:flex;align-items:center;gap:13px">
        <div class="stat-icon ${tone}">${UI.icon(ic)}</div>
        <div><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>
      </div>
      <div style="font-size:11.5px;color:var(--faint);margin-top:11px">${sub}</div>
    </div>`;



  /* ==================================================================== */
  /* CREATE TOURNAMENT                                                     */
  /* ==================================================================== */
  function viewCreate() {
    UI.setAdminTitle('Create Tournament');
    const m = mount();
    let capacity = 8;

    m.innerHTML = `
      <div class="fade-up" style="margin-bottom:20px">
        <h2 style="font-size:23px;font-weight:800;letter-spacing:-0.02em;color:#fff">Create Tournament</h2>
        <p class="section-sub">Single elimination only — the bracket shape is derived from capacity, and capacity is constrained by the database.</p>
      </div>
      <div class="grid gap-6 lg:grid-cols-2" style="align-items:start">
        <form class="card card-pad" id="ct-form" novalidate style="display:flex;flex-direction:column;gap:20px">
          <div class="field">
            <label class="field-label" for="ct-name">Tournament name *</label>
            <input class="input" id="ct-name" name="name" placeholder="e.g. VIT Inter-College Championship" maxlength="60">
            <span class="field-hint">UNIQUE — duplicate names are rejected by the database.</span>
          </div>
          <div class="field">
            <label class="field-label" for="ct-desc">Description</label>
            <textarea class="textarea" id="ct-desc" name="description" placeholder="What makes this tournament special?" maxlength="280"></textarea>
          </div>
          <div class="field">
            <span class="field-label">Maximum teams * <span style="text-transform:none;font-family:'JetBrains Mono',monospace;color:#7DD3FC">— CHECK (capacity &gt;= 2 AND capacity % 2 = 0) · Any Even Number</span></span>
            <div class="cap-grid" id="cap-grid" role="radiogroup" aria-label="Maximum teams" style="grid-template-columns:repeat(auto-fill, minmax(130px, 1fr))">
              ${[2, 4, 6, 8, 10, 12, 16].map(c => {
                const s = getTournamentStruct(c);
                return `
                <button type="button" class="cap-card ${c === capacity ? 'selected' : ''}" data-cap="${c}" role="radio" aria-checked="${c === capacity}">
                  <span class="cc-check">${UI.icon('check', 'w-3 h-3')}</span>
                  <div class="cc-n">${c}</div>
                  <div class="cc-l">Teams</div>
                  <div class="cc-d">${s.rounds} rounds · ${s.matches} matches${s.byes > 0 ? `<br><span style="color:#FBBF24">${s.byes} byes</span>` : ''}</div>
                </button>`;
              }).join('')}
            </div>
            <div style="margin-top:14px;display:flex;align-items:center;gap:12px;background:rgba(15,23,42,0.6);padding:10px 14px;border-radius:8px;border:1px solid var(--edge);flex-wrap:wrap">
              <label for="custom-cap-input" style="font-size:12.5px;font-weight:600;color:#94a3b8;white-space:nowrap">Or custom even capacity:</label>
              <input type="number" id="custom-cap-input" class="input" style="max-width:140px;padding:6px 10px;font-family:'JetBrains Mono',monospace" min="2" max="64" step="2" placeholder="e.g. 6, 14, 20" value="${![2,4,6,8,10,12,16].includes(capacity) ? capacity : ''}">
              <span style="font-size:11.5px;color:var(--faint)">Must be an even integer &ge; 2</span>
            </div>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="field">
              <label class="field-label" for="ct-deadline">Registration deadline</label>
              <input class="input" type="date" id="ct-deadline" name="registration_deadline">
            </div>
            <div class="field">
              <label class="field-label" for="ct-start">Start date</label>
              <input class="input" type="date" id="ct-start" name="start_date">
            </div>
          </div>
          <div class="warn-strip info-strip">${UI.icon('database')}<span>Format is fixed to <b>Single Elimination</b>. On creation the row is inserted with status <code class="mono">REGISTRATION_OPEN</code>; matches are <b>not</b> created yet — the bracket is generated atomically when capacity fills.</span></div>
          <button class="btn btn-primary btn-lg btn-block" type="submit" id="ct-submit">${UI.icon('trophy')}Create Tournament</button>
        </form>

        <div class="card" style="position:sticky;top:84px;padding:18px">
          <div class="section-head" style="margin-bottom:10px">
            <div><h3 class="section-title">${UI.icon('gitBranch')} Live bracket preview</h3>
            <p class="section-sub" id="pv-sub"></p></div>
            <span class="badge badge-slate">PREVIEW</span>
          </div>
          <div id="pv-mount" style="max-height:560px;overflow:auto"></div>
        </div>
      </div>`;

    /* default dates: deadline +7d, start +9d */
    const dl = new Date(Date.now() + 7 * 864e5), st = new Date(Date.now() + 9 * 864e5);
    m.querySelector('#ct-deadline').value = dl.toISOString().slice(0, 10);
    m.querySelector('#ct-start').value = st.toISOString().slice(0, 10);

    const drawPreview = () => {
      const s = getTournamentStruct(capacity);
      m.querySelector('#pv-sub').innerHTML = `${s.label} · <b style="color:#7DD3FC">${s.matches} match rows</b> will be inserted on lock`;
      Bracket.render(m.querySelector('#pv-mount'), Bracket.generatePreview(capacity), { canManage: false });
      m.querySelector('#pv-mount').style.zoom = capacity >= 16 ? '0.72' : capacity >= 8 ? '0.86' : '1';
    };

    const setCap = (newCap) => {
      newCap = Number(newCap);
      if (!newCap || newCap < 2 || newCap % 2 !== 0) return;
      capacity = newCap;
      m.querySelectorAll('[data-cap]').forEach(x => {
        const isMatch = Number(x.dataset.cap) === capacity;
        x.classList.toggle('selected', isMatch);
        x.setAttribute('aria-checked', String(isMatch));
      });
      const customInput = m.querySelector('#custom-cap-input');
      if (customInput && ![2, 4, 6, 8, 10, 12, 16].includes(capacity)) {
        customInput.value = capacity;
      }
      drawPreview();
    };

    m.querySelectorAll('[data-cap]').forEach(b => b.addEventListener('click', () => {
      setCap(b.dataset.cap);
    }));

    const customCapInput = m.querySelector('#custom-cap-input');
    customCapInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (val && val >= 2 && val % 2 === 0) {
        setCap(val);
      }
    });
    drawPreview();

    m.querySelector('#ct-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      form.querySelectorAll('.field-error').forEach(x => x.remove());
      form.querySelectorAll('.input').forEach(x => x.classList.remove('input-invalid'));
      const name = form.querySelector('#ct-name').value.trim();
      const err = (sel, msg) => {
        const input = form.querySelector(sel);
        input.classList.add('input-invalid');
        const p = document.createElement('span'); p.className = 'field-error';
        p.innerHTML = `${UI.icon('alert', 'w-3.5 h-3.5')} ${UI.esc(msg)}`;
        input.closest('.field').appendChild(p);
      };
      let bad = false;
      if (name.length < 3) { err('#ct-name', 'Tournament name must be at least 3 characters.'); bad = true; }
      const deadline = form.querySelector('#ct-deadline').value;
      const start = form.querySelector('#ct-start').value;
      if (deadline && start && start < deadline) { err('#ct-start', 'Start date cannot be before the registration deadline.'); bad = true; }
      if (bad) { UI.toast({ type: 'error', title: 'Validation failed', message: 'Fix the highlighted fields (same rules the server enforces).' }); return; }

      const btn = m.querySelector('#ct-submit');
      btn.classList.add('loading'); btn.disabled = true;
      try {
        const res = await API.createTournament({
          name,
          description: form.querySelector('#ct-desc').value.trim(),
          capacity,
          registration_deadline: deadline ? new Date(deadline + 'T23:59:59').toISOString() : null,
          start_date: start ? new Date(start + 'T00:00:00').toISOString() : null,
        });
        UI.toast({ type: 'success', title: 'Tournament created ✓', message: `${res.tournament.name} is now REGISTRATION OPEN (0/${capacity}).` });
        successModal(res.tournament);
      } catch (e2) {
        btn.classList.remove('loading'); btn.disabled = false;
        UI.toast({ type: 'error', title: 'Could not create tournament', message: e2.message });
        if (e2.fields && e2.fields.name) err('#ct-name', e2.fields.name);
      }
    });
  }

  function successModal(t) {
    const modal = UI.modal({
      title: '🎉 Tournament created',
      subtitle: t.name,
      body: `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${UI.statusBadge('REGISTRATION_OPEN')}
            <span class="chip">${t.capacity}-team knockout</span>
            <span class="chip mono">0 / ${t.capacity} registered</span>
          </div>
          <p style="font-size:13.5px;color:var(--muted);line-height:1.5">
            Registration is now live. Teams can now register to participate in this tournament.
          </p>
        </div>`,
      footer: `
        <a class="btn btn-ghost" href="tournament.html?id=${t.id}">View public page</a>
        <a class="btn btn-primary" href="admin.html?view=manage&id=${t.id}">${UI.icon('settings')}Manage tournament</a>`,
    });
    void modal;
  }

  /* ==================================================================== */
  /* TOURNAMENTS TABLE                                                     */
  /* ==================================================================== */
  async function viewTournaments() {
    UI.setAdminTitle('Tournaments');
    const m = mount();
    m.innerHTML = UI.skelTable(6);
    let all = [];
    let filter = 'ALL', search = '';
    try { all = await API.getTournaments(); } catch (err) { m.innerHTML = UI.errorState(err, 'location.reload()'); return; }

    const draw = () => {
      let list = all;
      if (filter !== 'ALL') list = list.filter(t => t.status === filter);
      if (search) list = list.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
      m.innerHTML = `
        ${UI.pageHeader({
          title: 'All Tournaments',
          sub: `${all.length} rows in <code class="mono" style="font-size:11.5px">tournaments</code> — every lifecycle state.`,
          actions: `<a class="btn btn-primary btn-sm" href="admin.html?view=create">${UI.icon('plus')}New tournament</a>`,
        })}
        <div class="card card-pad" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:18px">
          <div class="filter-pills">
            ${[['ALL', 'All'], ['REGISTRATION_OPEN', 'Open'], ['LOCKED', 'Locked'], ['IN_PROGRESS', 'In Progress'], ['COMPLETED', 'Completed']]
              .map(([k, l]) => `<button class="f-pill ${filter === k ? 'active' : ''}" data-f="${k}">${l}</button>`).join('')}
          </div>
          <div style="margin-left:auto;min-width:220px;flex:1;max-width:340px">${UI.searchInput('Search tournaments...', 'tt-search', search)}</div>
        </div>
        ${list.length ? `
        <div class="tbl-wrap fade-up">
          <table class="tbl">
            <thead><tr><th>Tournament</th><th>Status</th><th>Teams</th><th>Champion</th><th>Created</th><th style="text-align:right">Actions</th></tr></thead>
            <tbody>
              ${list.map(t => `
                <tr>
                  <td><div class="td-strong">${UI.esc(t.name)}</div>
                  <div class="mono" style="font-size:10.5px;color:var(--faint)">${t.capacity}-team · ${t.total_rounds} rounds · ${t.capacity - 1} matches</div></td>
                  <td>${UI.statusBadge(t.status)}</td>
                  <td><span class="capacity-frac mono ${t.registered_count >= t.capacity ? 'full' : ''}" style="font-size:12.5px"><span class="now">${t.registered_count}</span>/${t.capacity}</span></td>
                  <td>${t.champion_team_name ? `<span style="color:#FCD34D;font-weight:600">🏆 ${UI.esc(t.champion_team_name)}</span>` : '<span style="color:var(--faint)">—</span>'}</td>
                  <td>${UI.fmtDate(t.created_at)}</td>
                  <td><div class="tbl-actions">
                    <a class="btn btn-ghost btn-sm" href="tournament.html?id=${t.id}" title="Public View">${UI.icon('eye')}</a>
                    <a class="btn btn-ghost btn-sm" href="admin.html?view=manage&id=${t.id}" title="Manage in Control Center">${UI.icon('settings')}</a>
                    <a class="btn btn-outline btn-sm" href="tournament.html?id=${t.id}&tab=bracket">${UI.icon('gitBranch')}Bracket</a>
                    <button class="btn btn-ghost btn-sm" style="color:var(--danger)" data-del-tourn="${t.id}" data-del-name="${UI.esc(t.name)}" title="Delete Tournament">${UI.icon('trash')}</button>
                  </div></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : `<div class="card">${UI.emptyState({ icon: 'search', title: 'No tournaments found', message: 'Adjust the filter or create a new tournament.' })}</div>`}`;
      m.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { filter = b.dataset.f; draw(); }));
      const s = m.querySelector('#tt-search');
      let deb;
      s.addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(() => { search = s.value; draw(); const el = m.querySelector('#tt-search'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }, 300); });

      m.querySelectorAll('[data-del-tourn]').forEach(btn => {
        btn.addEventListener('click', () => {
          const tId = btn.dataset.delTourn;
          const tName = btn.dataset.delName;
          UI.confirmDialog({
            title: `Delete "${tName}"?`,
            message: `Are you sure you want to permanently delete "${tName}"? All matches, registrations, and bracket state will be deleted via ON DELETE CASCADE. This cannot be undone.`,
            confirmLabel: 'Delete Tournament',
            danger: true,
            onConfirm: async () => {
              try {
                await API.deleteTournament(tId);
                UI.toast({ type: 'success', title: 'Tournament deleted', message: `"${tName}" was deleted.` });
                all = all.filter(x => String(x.id) !== String(tId));
                draw();
                return true;
              } catch (err) {
                UI.toast({ type: 'error', title: 'Failed to delete tournament', message: err.message });
                return false;
              }
            }
          });
        });
      });
    };
    draw();
  }

  /* ==================================================================== */
  /* MANAGE ONE TOURNAMENT                                                 */
  /* ==================================================================== */
  async function viewManage() {
    const id = state.params.get('id') || 'latest';
    UI.setAdminTitle('Manage Tournament');
    const m = mount();
    m.innerHTML = `<div class="skel skel-line" style="height:40px;width:40%;margin-bottom:20px"></div>${UI.skelTable(4)}`;
    let detail, bracket;
    try {
      [detail, bracket] = await Promise.all([API.getTournament(id), API.getBracket(id)]);
    } catch (err) { m.innerHTML = UI.errorState(err, 'location.reload()'); return; }
    const t = detail.tournament;
    UI.setAdminTitle(t.name);
    const full = t.registered_count >= t.capacity;

    m.innerHTML = `
      <div class="fade-up" style="margin-bottom:18px">
        <a href="admin.html?view=tournaments" class="btn btn-ghost btn-sm" style="padding-left:8px;margin-bottom:12px">${UI.icon('arrowLeft', 'w-4 h-4')} All tournaments</a>
        <div style="display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;align-items:flex-start">
          <div>
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
              <h2 style="font-size:23px;font-weight:800;letter-spacing:-0.02em;color:#fff">${UI.esc(t.name)}</h2>
              ${UI.statusBadge(t.status)}
            </div>
            <p class="section-sub" style="margin-top:6px">Managed lifecycle — the state machine is stored in <code class="mono" style="font-size:11px">tournaments.status</code> and only the engine advances it.</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <a class="btn btn-outline btn-sm" href="tournament.html?id=${t.id}">${UI.icon('eye')}Public view</a>
            <a class="btn btn-primary btn-sm" href="tournament.html?id=${t.id}&tab=bracket">${UI.icon('gitBranch')}Open Bracket</a>
            <button class="btn btn-danger btn-sm" id="manage-del-tourn-btn">${UI.icon('trash')}Delete Tournament</button>
          </div>
        </div>
      </div>

      <section class="card card-pad fade-up" style="margin-bottom:18px">
        ${UI.timeline(t.status)}
      </section>

      <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 fade-up fade-up-1" style="margin-bottom:18px">
        ${statCard('Registered Teams', t.registered_count, 'users', `<span class="mono">${t.registered_count} rows in registrations</span>`)}
        ${statCard('Capacity', t.capacity, 'target', 'CHECK capacity IN (4,8,16)', 'i-warn')}
        ${statCard('Remaining Slots', t.remaining_slots, 'unlock', full ? 'capacity reached → LOCKED' : 'open for registration', 'i-violet')}
        ${statCard('Current Round', t.status === 'REGISTRATION_OPEN' ? '—' : `${t.current_round}/${t.total_rounds}`, 'sword', `${t.matches_completed}/${t.matches_total} matches completed`, 'i-win')}
      </section>

      ${t.status === 'REGISTRATION_OPEN' ? `
        <div class="warn-strip info-strip fade-up" style="margin-bottom:18px">${UI.icon('info')}
          <span>Waiting for capacity — at <b>${t.capacity}/${t.capacity}</b> the engine will automatically run:
          <code class="mono" style="font-size:11px">UPDATE tournaments SET status='LOCKED'</code> +
          <code class="mono" style="font-size:11px">INSERT ${t.capacity - 1} match rows</code> + wire every
          <code class="mono" style="font-size:11px">next_match_id</code> — all in ONE transaction.</span>
        </div>` : ''}

      <section class="card fade-up fade-up-2" style="margin-bottom:18px">
        <div class="section-head" style="padding:16px 18px 0;margin-bottom:12px">
          <div><h3 class="section-title">${UI.icon('users')} Registered teams</h3>
          <p class="section-sub">registrations JOIN teams JOIN users — seed order = registration order.</p></div>
          <span class="chip mono">${t.registered_count}/${t.capacity}</span>
        </div>
        ${detail.registrations.length ? `
        <div class="tbl-wrap" style="border:none;border-radius:0">
          <table class="tbl">
            <thead><tr><th>Seed</th><th>Team</th><th>Captain</th><th>Members</th><th>Registered</th></tr></thead>
            <tbody>
              ${detail.registrations.map(r => r.team ? `
                <tr>
                  <td><span class="seed-pill">#${r.seed}</span></td>
                  <td><div style="display:flex;align-items:center;gap:10px">${UI.avatar(r.team.name, { size: 'sm', square: true })}<span class="td-strong">${UI.esc(r.team.name)}</span><span class="mono" style="font-size:10.5px;color:var(--faint)">[${UI.esc(r.team.tag || '')}]</span></div></td>
                  <td>@${UI.esc(r.team.captain ? r.team.captain.username : '—')}</td>
                  <td><span class="mono" style="font-size:12px">${r.team.member_count}/${r.team.max_members}</span></td>
                  <td>${UI.fmtDateTime(r.registered_at)}</td>
                </tr>` : '').join('')}
            </tbody>
          </table>
        </div>` : `<div style="padding:0 18px 18px">${UI.emptyState({ icon: 'users', title: 'No teams registered yet', message: 'Captains will appear here as they register. Share the tournament page with players.' })}</div>`}
      </section>

      <section class="card fade-up fade-up-3" style="padding:18px 14px;margin-bottom:18px">
        <div class="section-head" style="padding:0 8px">
          <div><h3 class="section-title">${UI.icon('gitBranch')} Bracket</h3>
          <p class="section-sub">${t.status === 'REGISTRATION_OPEN' ? 'Generated automatically when the tournament locks.' : 'Click READY matches to declare winners — propagation is atomic.'}</p></div>
        </div>
        <div id="mg-bracket"></div>
      </section>`;

    Bracket.render(m.querySelector('#mg-bracket'), bracket, {
      canManage: t.status !== 'COMPLETED',
      onWinner: async () => { viewManage(); },
    });
    UI.hydrateProgress(m);

    const delBtn = m.querySelector('#manage-del-tourn-btn');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        UI.confirmDialog({
          title: `Delete "${t.name}"?`,
          message: `Are you sure you want to permanently delete "${t.name}"? All matches, registrations, and bracket progress will be removed via ON DELETE CASCADE. This cannot be undone.`,
          confirmLabel: 'Permanently Delete',
          danger: true,
          onConfirm: async () => {
            try {
              await API.deleteTournament(t.id);
              UI.toast({ type: 'success', title: 'Tournament deleted', message: `"${t.name}" deleted successfully.` });
              location.href = 'admin.html?view=tournaments';
              return true;
            } catch (err) {
              UI.toast({ type: 'error', title: 'Failed to delete tournament', message: err.message });
              return false;
            }
          }
        });
      });
    }
  }

  /* ==================================================================== */
  /* USERS                                                                 */
  /* ==================================================================== */
  async function viewUsers() {
    UI.setAdminTitle('Users');
    const m = mount();
    m.innerHTML = UI.skelTable(6);
    let all = [], search = '';
    try { all = await API.getUsers(); } catch (err) { m.innerHTML = UI.errorState(err, 'location.reload()'); return; }
    const draw = () => {
      const list = search ? all.filter(u => u.username.includes(search.toLowerCase()) || u.email.includes(search.toLowerCase()) || (u.full_name || '').toLowerCase().includes(search.toLowerCase())) : all;
      m.innerHTML = `
        ${UI.pageHeader({ title: 'Users', sub: `${all.length} rows in <code class="mono" style="font-size:11.5px">users</code> — role CHECK ∈ (PLAYER, ADMIN), UNIQUE username & email.` })}
        <div style="max-width:380px;margin-bottom:18px">${UI.searchInput('Search users...', 'u-search', search)}</div>
        ${list.length ? `
        <div class="tbl-wrap fade-up">
          <table class="tbl">
            <thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Team</th><th>Joined</th><th>Status</th></tr></thead>
            <tbody>
              ${list.map(u => `
                <tr>
                  <td><div style="display:flex;align-items:center;gap:10px">${UI.avatar(u.full_name || u.username, { size: 'sm' })}<span class="td-strong">@${UI.esc(u.username)}</span></div></td>
                  <td class="mono" style="font-size:11.5px;color:var(--muted)">${UI.esc(u.email)}</td>
                  <td>${UI.roleBadge(u.role)}</td>
                  <td>${u.team ? `<span class="chip">${UI.icon('users', 'w-3.5 h-3.5')} ${UI.esc(u.team.name)}</span>` : '<span style="color:var(--faint);font-size:12px">free agent</span>'}</td>
                  <td>${UI.fmtDate(u.created_at)}</td>
                  <td><span class="badge badge-win"><span class="badge-dot"></span>${UI.esc(u.status)}</span></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : `<div class="card">${UI.emptyState({ icon: 'search', title: 'No users found', message: `Nothing matches “${search}”.` })}</div>`}`;
      const s = m.querySelector('#u-search');
      let deb;
      s.addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(() => { search = s.value; draw(); const el = m.querySelector('#u-search'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }, 300); });
    };
    draw();
  }

  /* ==================================================================== */
  /* TEAMS                                                                 */
  /* ==================================================================== */
  async function viewTeams() {
    UI.setAdminTitle('Teams');
    const m = mount();
    m.innerHTML = UI.skelTable(6);
    let all = [], search = '';
    try { all = await API.getTeams(); } catch (err) { m.innerHTML = UI.errorState(err, 'location.reload()'); return; }
    const draw = () => {
      const list = search ? all.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || (t.captain && t.captain.username.includes(search.toLowerCase()))) : all;
      m.innerHTML = `
        ${UI.pageHeader({ title: 'Teams', sub: `${all.length} rows in <code class="mono" style="font-size:11.5px">teams</code> — roster size CHECK ≤ 5, captain FK protected.` })}
        <div style="max-width:380px;margin-bottom:18px">${UI.searchInput('Search teams...', 't-search', search)}</div>
        ${list.length ? `
        <div class="tbl-wrap fade-up">
          <table class="tbl">
            <thead><tr><th>Team</th><th>Captain</th><th>Members</th><th>Tournaments</th><th>Created</th><th>Status</th></tr></thead>
            <tbody>
              ${list.map(t => `
                <tr style="cursor:pointer" data-team="${t.id}">
                  <td><div style="display:flex;align-items:center;gap:10px">${UI.avatar(t.name, { size: 'sm', square: true })}
                    <div><div class="td-strong">${UI.esc(t.name)}</div><div class="mono" style="font-size:10px;color:var(--faint)">[${UI.esc(t.tag || '')}]</div></div></div></td>
                  <td>@${UI.esc(t.captain ? t.captain.username : '—')}</td>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px;min-width:120px">
                      <span class="mono" style="font-size:12px">${t.member_count}/${t.max_members}</span>
                      <div style="flex:1">${UI.progress((t.member_count / t.max_members) * 100, { tone: t.member_count >= t.max_members ? 'warn' : 'accent' })}</div>
                    </div>
                  </td>
                  <td><span class="chip mono">${t.tournaments_entered} entered</span></td>
                  <td>${UI.fmtDate(t.created_at)}</td>
                  <td>${t.in_active_tournament ? '<span class="badge badge-accent"><span class="badge-dot pulse"></span>Competing</span>' : '<span class="badge badge-slate"><span class="badge-dot"></span>Active</span>'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="mono" style="font-size:11px;color:var(--faint);margin-top:10px">click a row to inspect the roster (team_members JOIN users)</p>`
        : `<div class="card">${UI.emptyState({ icon: 'search', title: 'No teams found', message: `Nothing matches “${search}”.` })}</div>`}`;
      UI.hydrateProgress(m);
      const s = m.querySelector('#t-search');
      let deb;
      s.addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(() => { search = s.value; draw(); const el = m.querySelector('#t-search'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }, 300); });
      m.querySelectorAll('[data-team]').forEach(tr => tr.addEventListener('click', () => {
        const t = all.find(x => x.id === tr.dataset.team);
        UI.modal({
          title: t.name, subtitle: `Roster · ${t.member_count}/${t.max_members} members · captain @${t.captain ? t.captain.username : '?'}`,
          body: `<div style="display:flex;flex-direction:column;gap:8px">
            ${t.members.map(mem => `
              <div style="display:flex;align-items:center;gap:11px;padding:9px 12px;border:1px solid var(--edge);border-radius:10px;background:rgba(7,11,18,.35)">
                ${UI.avatar(mem.full_name || mem.username, { size: 'sm' })}
                <div style="flex:1"><div style="font-size:13px;font-weight:600;color:#fff">${UI.esc(mem.full_name || mem.username)}</div>
                <div class="mono" style="font-size:10.5px;color:var(--faint)">@${UI.esc(mem.username)} · joined ${UI.fmtDate(mem.joined_at)}</div></div>
                ${mem.role === 'CAPTAIN' ? `<span class="badge badge-warn">${UI.icon('crown', 'w-3 h-3')}Captain</span>` : '<span class="badge badge-slate">Member</span>'}
              </div>`).join('')}
          </div>`,
          footer: `<button class="btn btn-ghost" data-close>Close</button>`,
        });
      }));
    };
    draw();
  }

  /* ==================================================================== */
  /* ROUTER + INIT                                                         */
  /* ==================================================================== */
  const VIEWS = {
    overview: viewOverview,
    create: viewCreate,
    tournaments: viewTournaments,
    manage: viewManage,
    users: viewUsers,
    teams: viewTeams,
  };

  async function init() {
    const user = await Auth.requireAuth({ role: 'ADMIN' });
    if (!user) return;
    state.user = user;
    state.view = state.params.get('view') || 'overview';
    if (state.view === 'tournaments' && state.params.get('id')) state.view = 'manage';
    UI.renderAdminShell(state.view === 'manage' ? 'tournaments' : state.view, user);
    (VIEWS[state.view] || viewOverview)();
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => Admin.init());
