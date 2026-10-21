/* ==========================================================================
   ArenaX · dashboard.js — Player dashboard + Tournament discovery
   Page: dashboard.html (?tab=tournaments switches to the catalog view)
   ========================================================================== */
'use strict';

const Dashboard = (() => {
  let state = { user: null, stats: null, tournaments: [], tab: 'dashboard', filter: 'ALL', search: '' };

  /* ------------------------------------------------ shared: tournament card */
  function tournamentCard(t) {
    const pct = Math.round((t.registered_count / t.capacity) * 100);
    const full = t.registered_count >= t.capacity;
    const open = t.status === 'REGISTRATION_OPEN';
    const tone = full ? 'warn' : 'accent';

    let actionBtn = `<a class="btn btn-outline btn-sm" style="flex:1" href="tournament.html?id=${t.id}">${UI.icon('eye')}View Tournament</a>`;
    if (open) {
      if (t.my_team_registered) {
        actionBtn += `<button class="btn btn-success btn-sm" style="flex:1" disabled>${UI.icon('checkCircle')}Registered ✓</button>`;
      } else if (full) {
        actionBtn += `<button class="btn btn-sm" style="flex:1" disabled title="This tournament has reached its maximum capacity.">${UI.icon('ban')}Full</button>`;
      } else {
        actionBtn += `<button class="btn btn-primary btn-sm" style="flex:1" data-register="${t.id}">${UI.icon('zap')}Register Team</button>`;
      }
    }

    return `
    <article class="card card-hover t-card fade-up" data-tid="${t.id}">
      ${full && open ? '<span class="full-flag">FULL</span>' : ''}
      <div class="t-banner">
        <svg class="bg-bracket" viewBox="0 0 300 74" fill="none" aria-hidden="true">
          <path d="M20 18h30M20 56h30M50 18v38M50 37h30M80 24h25M80 50h25M105 24v26M105 37h30" stroke="rgba(56,189,248,.35)" stroke-width="1.4"/>
          <path d="M160 18h30M160 56h30M190 18v38M190 37h30M220 24h25M220 50h25M245 24v26M245 37h30" stroke="rgba(139,92,246,.3)" stroke-width="1.4"/>
          <rect x="14" y="12" width="12" height="12" rx="3" fill="rgba(56,189,248,.5)"/>
          <rect x="14" y="50" width="12" height="12" rx="3" fill="rgba(56,189,248,.5)"/>
        </svg>
        <span class="t-format">${UI.statusBadge(t.status)}</span>
      </div>
      <div class="t-body">
        <div>
          <div class="t-name">${UI.esc(t.name)}</div>
          <div class="t-org">${UI.icon('shield', 'w-3.5 h-3.5')} ${UI.esc(t.organizer_name)} ${t.my_team_registered ? `<span class="badge badge-win" style="margin-left:6px">Registered ✓</span>` : ''}</div>
        </div>

        <div class="t-meta-grid">
          <div class="t-meta">
            <div class="k">Format</div>
            <div class="v">${t.capacity}-Team Knockout</div>
          </div>
          <div class="t-meta">
            <div class="k">${open ? 'Status' : t.status === 'COMPLETED' ? 'Completed' : 'Started'}</div>
            <div class="v">${t.status}</div>
          </div>
        </div>

        <div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
            <span class="capacity-frac ${full ? 'full' : ''}"><span class="now">${t.registered_count}</span> / ${t.capacity} <span style="font-size:11px;color:var(--muted);font-family:Inter,sans-serif">teams</span></span>
            <span style="font-size:11.5px;font-weight:700;color:${full ? 'var(--warn)' : 'var(--muted)'}">${full ? '100% · FULL' : pct + '% full'}</span>
          </div>
          ${UI.progress(pct, { tone })}
          <div style="display:flex;justify-content:space-between;margin-top:7px">
            <span style="font-size:10.5px;color:var(--faint)">${open ? `${t.remaining_slots} slot${t.remaining_slots === 1 ? '' : 's'} remaining` : (t.champion_team_name ? `🏆 ${UI.esc(t.champion_team_name)}` : `Round ${t.current_round} of ${t.total_rounds}`)}</span>
          </div>
        </div>

        <div class="t-actions">${actionBtn}</div>
      </div>
    </article>`;
  }

  /* -------------------------------------------------- registration action */
  function bindRegisterButtons(root) {
    root.querySelectorAll('[data-register]').forEach(btn => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const t = state.tournaments.find(x => String(x.id) === String(btn.dataset.register));
      if (t) registerFlow(t);
    }));
  }

  async function registerFlow(t) {
    let myTeams = [];
    try {
      const myData = await API.getMyTeam();
      myTeams = myData.teams || (myData.team ? [myData.team] : []);
    } catch {
      myTeams = [];
    }

    if (!myTeams.length) {
      UI.confirmDialog({
        title: 'No Team Created Yet',
        message: 'You need to create a team before registering for tournaments. Create your team on the dashboard first.',
        confirmLabel: 'Create Team Now',
        onConfirm: async () => {
          setTab('dashboard');
          return false;
        }
      });
      return;
    }

    const optionsHtml = myTeams.map((tm, idx) => `
      <label class="card card-pad" style="display:flex;align-items:center;gap:12px;margin-bottom:8px;cursor:pointer;background:var(--card);border:1px solid var(--edge)">
        <input type="radio" name="sel_team" value="${tm.id}" ${idx === 0 ? 'checked' : ''} style="accent-color:var(--accent);width:18px;height:18px">
        <div style="flex:1">
          <div style="font-weight:700;color:#fff;font-size:14px">Team ID #${tm.id} · ${UI.esc(tm.name)} <span class="mono" style="font-size:11px;color:var(--accent)">[${UI.esc(tm.tag || '')}]</span></div>
          <div class="mono" style="font-size:11px;color:var(--faint)">Roster: ${tm.member_count} members ${tm.is_eliminated ? '· <span style="color:var(--danger)">[Eliminated in past match]</span>' : '· Ready'}</div>
        </div>
      </label>
    `).join('');

    const modal = UI.modal({
      title: `Register for "${t.name}"`,
      subtitle: `Select which team you created to participate in this tournament (${t.registered_count}/${t.capacity} teams registered)`,
      body: `
        <div>
          <p style="font-size:13px;color:var(--muted);margin-bottom:12px">Select your participating team:</p>
          <form id="team-select-form">
            ${optionsHtml}
          </form>
          <div class="warn-strip info-strip" style="margin-top:12px">
            ${UI.icon('database')}<span>When the tournament reaches capacity (${t.capacity} teams), the single-elimination bracket is generated automatically.</span>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" data-close>Cancel</button>
        <button class="btn btn-primary" id="confirm-team-reg">${UI.icon('zap')}Confirm & Register Team</button>
      `
    });

    modal.el.querySelector('#confirm-team-reg').addEventListener('click', async () => {
      const checked = modal.el.querySelector('input[name="sel_team"]:checked');
      if (!checked) return;
      const teamId = parseInt(checked.value, 10);
      const selectedTeam = myTeams.find(x => x.id === teamId);
      modal.close();

      try {
        const res = await API.registerTeam(t.id, teamId);
        if (res.locked) {
          UI.confetti(60);
          UI.toast({ type: 'warn', title: `${t.name} is now LOCKED 🔒`, message: `Capacity reached! Bracket auto-generated with all ${t.capacity} teams.`, duration: 6500 });
        } else {
          UI.toast({ type: 'success', title: 'Registration confirmed ✓', message: `${selectedTeam.name} (Team ID #${selectedTeam.id}) registered into "${t.name}" as seed #${res.seed}.` });
        }
      } catch (err) {
        UI.toast({ type: 'error', title: 'Registration failed', message: err.message, duration: 6000 });
      }
      try {
        await refreshData();
      } catch (e) {
        console.error('Failed to refresh dashboard data:', e);
      }
    });
  }

  /* ------------------------------------------------------- dashboard tab */
  function renderDashboard(page) {
    const u = state.user;
    const myTeams = (state.stats && state.stats.teams) || (state.stats && state.stats.team ? [state.stats.team] : []);

    page.innerHTML = `
      <section class="hero fade-up" style="margin-bottom:24px">
        <div style="position:relative;z-index:1;max-width:700px">
          <span class="land-kicker" style="font-size:10px">${UI.icon('zap', 'w-3.5 h-3.5')} PLAYER DASHBOARD</span>
          <h1 style="font-size:clamp(24px,3.4vw,32px);font-weight:800;letter-spacing:-0.02em;margin-top:10px;color:#fff">
            Welcome, <span class="grad-text">${UI.esc(u.full_name || u.username)}</span>
          </h1>
          <p style="color:var(--muted);font-size:14px;margin-top:6px;line-height:1.6">
            Create your team below as Team Lead and register your squad members. Once created, head over to Discover Tournaments to compete.
          </p>
        </div>
      </section>

      <div class="grid gap-6 lg:grid-cols-3">
        <!-- CREATE TEAM FORM (Takes 2 columns) -->
        <div class="lg:col-span-2">
          <div class="card card-pad fade-up">
            <div class="section-head" style="margin-bottom:18px">
              <div>
                <h2 class="section-title">${UI.icon('users')} Create a Team</h2>
                <p class="section-sub">You are the Team Lead. Specify your team name and add member names.</p>
              </div>
            </div>

            <form id="dash-create-team-form" class="auth-form" novalidate>
              <!-- Team Lead (Automatic) -->
              <div class="field">
                <label class="field-label">Team Lead (Captain)</label>
                <div style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.03);border:1px solid var(--edge);padding:10px 14px;border-radius:8px">
                  ${UI.icon('crown', 'w-5 h-5 text-amber-400')}
                  <span style="font-weight:700;color:#fff">${UI.esc(u.full_name || u.username)} (@${UI.esc(u.username)})</span>
                  <span class="badge badge-accent" style="margin-left:auto">Team Lead</span>
                </div>
                <span class="field-hint">You are automatically assigned as the Team Lead of this team.</span>
              </div>

              <!-- Team Name -->
              <div class="field">
                <label class="field-label" for="dash-team-name">Team Name *</label>
                <input class="input" id="dash-team-name" name="name" placeholder="e.g. Shadow Strikers" required>
                <span class="field-hint">3–50 characters · Must be unique</span>
              </div>

              <!-- Team Tag -->
              <div class="field">
                <label class="field-label" for="dash-team-tag">Team Tag</label>
                <input class="input mono" id="dash-team-tag" name="tag" placeholder="SHDW" maxlength="5" style="text-transform:uppercase">
                <span class="field-hint">Short 2–5 character abbreviation</span>
              </div>

              <!-- Number of members to add -->
              <div class="field">
                <label class="field-label" for="dash-member-count">Number of Additional Team Members</label>
                <select class="input" id="dash-member-count">
                  <option value="1">1 Member (2 Total)</option>
                  <option value="2" selected>2 Members (3 Total)</option>
                  <option value="3">3 Members (4 Total)</option>
                  <option value="4">4 Members (5 Total - Full Squad)</option>
                </select>
                <span class="field-hint">Select how many members to add beside yourself (roster up to 5 members).</span>
              </div>

              <!-- Member names container -->
              <div id="dash-members-container" style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px"></div>

              <div id="dash-form-error"></div>

              <button type="submit" id="dash-create-btn" class="btn btn-primary btn-lg btn-block">
                ${UI.icon('plus')}Create Team & Save Roster
              </button>
            </form>
          </div>
        </div>

        <!-- RIGHT SIDE: CREATED TEAMS SUMMARY & TOURNAMENTS SHORTCUT -->
        <div>
          <div class="card card-pad fade-up" style="margin-bottom:20px">
            <h3 class="section-title" style="font-size:16px;margin-bottom:8px">${UI.icon('shield')} Your Created Teams</h3>
            <p class="section-sub" style="margin-bottom:14px">Teams you lead ready for tournament registration.</p>
            ${myTeams.length ? `
              <div style="display:flex;flex-direction:column;gap:10px">
                ${myTeams.map(t => `
                  <div style="background:rgba(255,255,255,0.03);border:1px solid var(--edge);border-radius:8px;padding:12px">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                      <span style="font-weight:700;color:#fff">${UI.esc(t.name)}</span>
                      <span class="mono" style="font-size:11px;color:var(--accent)">ID #${t.id}</span>
                    </div>
                    <div style="font-size:12px;color:var(--muted);margin-top:4px">
                      Roster: ${t.member_count} members ${t.is_eliminated ? '· <span style="color:var(--danger)">Eliminated</span>' : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
              <a href="team.html" class="btn btn-outline btn-sm btn-block" style="margin-top:14px">${UI.icon('users')}View All in My Team</a>
            ` : `
              <div style="padding:16px;text-align:center;color:var(--faint);font-size:13px">
                No teams created yet.<br>Fill out the form on the left to create your first team!
              </div>
            `}
          </div>

          <div class="card card-pad fade-up">
            <h3 class="section-title" style="font-size:16px;margin-bottom:8px">${UI.icon('trophy')} Live Tournaments</h3>
            <p class="section-sub" style="margin-bottom:14px">Check out open tournaments to register your team.</p>
            <button class="btn btn-primary btn-block" data-goto-discovery>${UI.icon('grid')}Discover Tournaments</button>
          </div>
        </div>
      </div>
    `;

    // Render dynamic member input fields
    const container = page.querySelector('#dash-members-container');
    const countSelect = page.querySelector('#dash-member-count');

    function renderMemberInputs(count) {
      container.innerHTML = '';
      for (let i = 1; i <= count; i++) {
        const div = document.createElement('div');
        div.className = 'field';
        div.innerHTML = `
          <label class="field-label" for="member-input-${i}">Member #${i} Full Name *</label>
          <input class="input" id="member-input-${i}" name="member_names" placeholder="e.g. Player ${i}" required>
        `;
        container.appendChild(div);
      }
    }

    renderMemberInputs(parseInt(countSelect.value, 10));
    countSelect.addEventListener('change', () => renderMemberInputs(parseInt(countSelect.value, 10)));

    // Handle team creation submit
    const form = page.querySelector('#dash-create-team-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = page.querySelector('#dash-form-error');
      errBox.innerHTML = '';
      const name = page.querySelector('#dash-team-name').value.trim();
      const tag = page.querySelector('#dash-team-tag').value.trim();
      const memberInputs = Array.from(page.querySelectorAll('input[name="member_names"]'));
      const memberNames = memberInputs.map(inp => inp.value.trim()).filter(Boolean);

      if (name.length < 3) {
        errBox.innerHTML = `<div class="warn-strip danger-strip">${UI.icon('alert')}<span>Team name must be at least 3 characters.</span></div>`;
        return;
      }
      if (memberNames.length < memberInputs.length) {
        errBox.innerHTML = `<div class="warn-strip danger-strip">${UI.icon('alert')}<span>Please enter names for all specified team members.</span></div>`;
        return;
      }

      const btn = page.querySelector('#dash-create-btn');
      btn.classList.add('loading'); btn.disabled = true;

      try {
        const res = await API.createTeam({ name, tag, members: memberNames });
        UI.toast({ type: 'success', title: `Team "${res.team.name}" Created!`, message: `Team ID #${res.team.id} assigned. You are Team Lead with ${res.team.member_count} members.` });
        await refreshData();
      } catch (err) {
        btn.classList.remove('loading'); btn.disabled = false;
        errBox.innerHTML = `<div class="warn-strip danger-strip">${UI.icon('xCircle')}<span>${UI.esc(err.message)}</span></div>`;
        UI.toast({ type: 'error', title: 'Could not create team', message: err.message });
      }
    });

    page.querySelectorAll('[data-goto-discovery]').forEach(b => b.addEventListener('click', () => { location.href = 'tournament.html'; }));
  }

  /* ------------------------------------------------------ discovery tab */
  const FILTERS = [
    { key: 'ALL', label: 'All' },
    { key: 'REGISTRATION_OPEN', label: 'Registration Open' },
    { key: 'LOCKED', label: 'Locked' },
    { key: 'IN_PROGRESS', label: 'In Progress' },
    { key: 'COMPLETED', label: 'Completed' },
  ];
  function renderDiscovery(page) {
    page.innerHTML = `
      ${UI.pageHeader({ title: 'Discover Tournaments', sub: 'Every tournament, every state — capacity and lifecycle status come straight from the database.' })}
      <div class="card card-pad" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:20px">
        <div class="filter-pills" id="disc-filters">
          ${FILTERS.map(f => `<button class="f-pill ${state.filter === f.key ? 'active' : ''}" data-filter="${f.key}">${f.label}</button>`).join('')}
        </div>
        <div style="margin-left:auto;min-width:240px;flex:1;max-width:380px">${UI.searchInput('Search tournaments...', 'disc-search', state.search)}</div>
      </div>
      <div id="disc-count" style="font-size:12px;color:var(--faint);margin-bottom:12px" class="mono"></div>
      <div id="disc-grid"></div>`;

    const grid = page.querySelector('#disc-grid');
    const count = page.querySelector('#disc-count');
    const apply = () => {
      let list = state.tournaments;
      if (state.filter !== 'ALL') list = list.filter(t => t.status === state.filter);
      const s = state.search.toLowerCase();
      if (s) list = list.filter(t => t.name.toLowerCase().includes(s) || (t.description || '').toLowerCase().includes(s));
      count.textContent = `${list.length} tournament${list.length === 1 ? '' : 's'} · filtered client-side from GET /tournaments`;
      grid.innerHTML = list.length
        ? `<div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">${list.map(tournamentCard).join('')}</div>`
        : UI.emptyState({ icon: 'search', title: 'No tournaments found', message: state.search ? `Nothing matches “${state.search}”. Try a different search or filter.` : 'New tournaments will appear here when administrators open registration.' });
      bindRegisterButtons(grid);
      UI.hydrateProgress(grid);
    };
    page.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => {
      state.filter = b.dataset.filter;
      page.querySelectorAll('[data-filter]').forEach(x => x.classList.toggle('active', x === b));
      apply();
    }));
    const searchEl = page.querySelector('#disc-search');
    let deb;
    searchEl.addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(() => { state.search = searchEl.value; apply(); }, 180); });
    apply();
  }

  /* -------------------------------------------------------------- tabs */
  function render() {
    const page = document.getElementById('page');
    page.innerHTML = '';
    const mount = document.createElement('div');
    page.appendChild(mount);
    renderDashboard(mount);
  }

  async function refreshData() {
    const [stats, tournaments] = await Promise.all([API.getMyStats(), API.getTournaments()]);
    state.stats = stats;
    state.tournaments = tournaments;
    render();
  }

  async function init() {
    const user = await Auth.requireAuth();
    if (!user) return;
    if (user.role === 'ADMIN') {
      location.replace('admin.html');
      return;
    }
    state.user = user;

    // If query has tab=tournaments, redirect to dedicated tournament.html page
    if (new URLSearchParams(location.search).get('tab') === 'tournaments') {
      location.replace('tournament.html');
      return;
    }

    await UI.renderPlayerNav('dashboard', user);
    const page = document.getElementById('page');
    page.innerHTML = `${UI.skelGrid(1)}<div class="mt-6">${UI.skelGrid(3)}</div>`;

    try {
      await refreshData();
    } catch (err) {
      page.innerHTML = UI.errorState(err, 'Dashboard.init()');
    }
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => Dashboard.init());
