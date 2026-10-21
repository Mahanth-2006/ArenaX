/* ==========================================================================
   ArenaX · tournament.js — Tournament details page
   Page: tournament.html?id=<id>&tab=overview|bracket
   Shows: header + lifecycle badge, info cards, registration progress,
   registered teams, role-aware registration CTA, the interactive bracket,
   the completed/champion screen and (admin) the Database Lens.
   ========================================================================== */
'use strict';

const TournamentPage = (() => {
  let state = { user: null, id: null, tab: 'overview', detail: null, bracket: null, lensOpen: false };

  const isAdmin = () => state.user && state.user.role === 'ADMIN';

  /* ------------------------------------------------------------ header */
  function header(t) {
    return `
    <div class="fade-up" style="margin-bottom:20px">
      <a href="${isAdmin() ? 'admin.html?view=tournaments' : 'dashboard.html?tab=tournaments'}" class="btn btn-ghost btn-sm" style="padding-left:8px;margin-bottom:14px">
        ${UI.icon('arrowLeft', 'w-4 h-4')} ${isAdmin() ? 'All tournaments' : 'Discover tournaments'}
      </a>
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap">
        <div>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <h1 style="font-size:clamp(22px,3.4vw,32px);font-weight:800;letter-spacing:-0.02em;color:#fff">${UI.esc(t.name)}</h1>
            ${UI.statusBadge(t.status)}
          </div>
          <p style="color:var(--muted);font-size:14px;margin-top:8px;max-width:640px;line-height:1.6">${UI.esc(t.description || '')}</p>
          <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
            <span class="chip">${UI.icon('shield', 'w-3.5 h-3.5')} Organized by ${UI.esc(t.organizer_name)}</span>
            <span class="chip">${UI.icon('calendar', 'w-3.5 h-3.5')} Created ${UI.fmtDate(t.created_at)}</span>
            <span class="chip">${UI.icon('clock', 'w-3.5 h-3.5')} Starts ${UI.fmtDate(t.start_date)}</span>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${isAdmin() ? `
            <a class="btn btn-primary btn-sm" href="admin.html?view=manage&id=${t.id}">${UI.icon('settings')}Manage in Control Center</a>
            <button class="btn btn-danger btn-sm" id="hdr-del-tourn-btn">${UI.icon('trash')}Delete Tournament</button>
          ` : ''}
        </div>
      </div>
    </div>`;
  }

  /* -------------------------------------------------------- champion hero */
  function championHero(t) {
    const finalMatch = state.bracket ? state.bracket.rounds[state.bracket.rounds.length - 1].matches[0] : null;
    return `
    <section class="champ-hero fade-up" id="champ-hero">
      <span class="big-trophy">🏆</span>
      <div class="badge badge-win" style="margin-top:10px">Tournament Completed</div>
      <h2>${UI.esc(t.champion_team_name || 'Champion')}</h2>
      <p style="color:var(--muted);font-size:14.5px;margin-top:6px">Tournament Champion · ${UI.esc(t.name)} · completed ${UI.fmtDate(t.completed_at)}</p>
      ${finalMatch && finalMatch.team1 && finalMatch.team2 ? `
        <div style="max-width:420px;margin:22px auto 0">
          <div style="font-size:10.5px;letter-spacing:.14em;font-weight:800;color:var(--warn);margin-bottom:8px">THE FINAL · MATCH #${finalMatch.number}</div>
          <div class="match-card is-completed" style="text-align:left">
            ${[finalMatch.team1, finalMatch.team2].map((tm, i) => `
              <div class="team-row ${finalMatch.winner_id === (tm && tm.id) ? 'winner' : 'loser'}" style="justify-content:space-between">
                <div style="display:flex;align-items:center;gap:10px">
                  ${UI.avatar(tm ? tm.name : '?', { size: 'sm', square: true })}
                  <span class="tr-name">${UI.esc(tm ? tm.name : 'TBD')}</span>
                </div>
                ${finalMatch.winner_id === (tm && tm.id) ? `<span class="trophy-ico">${UI.icon('trophy')}</span>` : ''}
                ${i === 0 ? '' : ''}
              </div>`).join('')}
          </div>
        </div>` : ''}
      <div style="display:flex;gap:10px;justify-content:center;margin-top:24px;flex-wrap:wrap">
        <button class="btn btn-primary" data-goto-bracket>${UI.icon('gitBranch')}View Final Bracket</button>
        <a class="btn btn-outline" href="history.html">${UI.icon('history')}Back to Tournament History</a>
      </div>
    </section>`;
  }

  /* ------------------------------------------------------ overview tab */
  function infoCards(t) {
    const full = t.registered_count >= t.capacity;
    return `
    <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 fade-up fade-up-1">
      <div class="card card-pad">
        <div class="kv"><span class="k">Teams registered</span>
          <span class="capacity-frac ${full ? 'full' : ''}" style="margin-top:4px"><span class="now">${t.registered_count}</span> / ${t.capacity}</span></div>
      </div>
      <div class="card card-pad">
        <div class="kv"><span class="k">Capacity</span><span class="v">${t.capacity} teams</span></div>
      </div>
      <div class="card card-pad">
        <div class="kv"><span class="k">Format</span><span class="v">${t.capacity}-Team Knockout</span>
        <span class="stat-label" style="margin-top:4px">Single elimination · ${t.total_rounds} rounds · ${t.capacity - 1} matches</span></div>
      </div>
      <div class="card card-pad">
        <div class="kv"><span class="k">Current round</span><span class="v">${t.status === 'COMPLETED' ? 'Finished' : `Round ${t.current_round} / ${t.total_rounds}`}</span>
        <span class="stat-label" style="margin-top:4px">${t.matches_completed}/${t.matches_total} matches completed</span></div>
      </div>
      <div class="card card-pad">
        <div class="kv"><span class="k">${t.status === 'REGISTRATION_OPEN' ? 'Reg. deadline' : 'Organizer'}</span>
        <span class="v">${t.status === 'REGISTRATION_OPEN' ? UI.fmtDate(t.registration_deadline) : UI.esc(t.organizer_name)}</span>
        <span class="stat-label" style="margin-top:4px">${t.status === 'REGISTRATION_OPEN' ? UI.timeAgo(t.registration_deadline).replace('ago', 'left') : UI.esc(t.organizer_name)}</span></div>
      </div>
    </section>`;
  }

  function registrationPanel(t) {
    const pct = Math.round((t.registered_count / t.capacity) * 100);
    const full = t.registered_count >= t.capacity;
    const team = state.myStats ? state.myStats.team : null;
    const isCaptain = state.myStats ? state.myStats.is_captain : false;

    let cta;
    if (isAdmin()) {
      cta = `<div class="warn-strip info-strip">${UI.icon('shield')}<span>Admin view — teams are registered by their team leads.</span></div>`;
    } else if (t.status === 'COMPLETED') {
      cta = `<div class="warn-strip info-strip">${UI.icon('trophy')}<span>This tournament is completed. Champion: <b>${UI.esc(t.champion_team_name || '—')}</b>.</span></div>`;
    } else if (t.status !== 'REGISTRATION_OPEN') {
      cta = `<div class="warn-strip">${UI.icon('lock')}<span><b>Registration closed.</b> The tournament is ${t.status === 'LOCKED' ? 'locked — bracket has been generated' : 'in progress'}.</span></div>`;
    } else if (t.my_team_registered) {
      cta = `<div class="warn-strip" style="background:rgba(52,211,153,.07);border-color:rgba(52,211,153,.35);color:#6EE7B7">${UI.icon('checkCircle')}<span><b>REGISTERED ✓</b> — ${team ? UI.esc(team.name) : 'Your team'} is registered.</span></div>`;
    } else if (full) {
      cta = `<div class="warn-strip">${UI.icon('ban')}<span><b>TOURNAMENT FULL</b> — maximum capacity reached (${t.capacity}/${t.capacity}).</span></div>`;
    } else {
      cta = `<button class="btn btn-primary btn-block btn-lg" id="register-cta">${UI.icon('zap')}Register a Team for this Tournament</button>`;
    }

    return `
    <section class="card card-pad fade-up fade-up-2" style="margin-top:18px">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:14px;flex-wrap:wrap;margin-bottom:12px">
        <div>
          <h3 class="section-title">${UI.icon('target')} Registration</h3>
          <p class="section-sub">${t.status === 'REGISTRATION_OPEN'
            ? `Register your team to secure a seed in the ${t.capacity}-team bracket.`
            : 'Tournament status.'}</p>
        </div>
        <span class="capacity-frac ${full ? 'full' : ''}" style="font-size:15px"><span class="now">${t.registered_count}</span> / ${t.capacity} REGISTERED</span>
      </div>
      ${UI.progress(pct, { tone: full ? 'warn' : 'accent', large: true })}
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:9px;flex-wrap:wrap">
        <span style="font-size:12px;color:${full ? 'var(--warn)' : 'var(--muted)'};font-weight:600">${full ? '100% · CAPACITY REACHED' : `${pct}% full · ${t.remaining_slots} slot${t.remaining_slots === 1 ? '' : 's'} remaining`}</span>
      </div>
      <div style="margin-top:16px">${cta}</div>
    </section>`;
  }

  function registeredTeams(detail) {
    const regs = detail.registrations;
    const t = detail.tournament;
    if (!regs.length) {
      return UI.emptyState({ icon: 'users', title: 'No teams registered yet', message: 'Registered teams and their seeds will appear here the moment captains sign up.' });
    }
    return `
    <section class="mt-8 fade-up fade-up-3">
      <div class="section-head">
        <div><h2 class="section-title">${UI.icon('users')} Registered Teams</h2>
        <p class="section-sub">Seed = registration order (registrations.seed) — used for bracket placement (1 vs ${t.capacity}, …).</p></div>
        <span class="chip mono">${regs.length} rows in registrations</span>
      </div>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        ${regs.map(r => r.team ? `
          <div class="card team-card card-hover">
            ${UI.avatar(r.team.name, { size: 'lg', square: true })}
            <div style="min-width:0;flex:1">
              <div style="display:flex;align-items:center;gap:8px">
                <span class="tc-name" style="overflow:hidden;text-overflow:ellipsis">${UI.esc(r.team.name)}</span>
                <span class="seed-pill">#${r.seed}</span>
              </div>
              <div class="tc-sub">${UI.icon('crown', 'w-3.5 h-3.5')} ${UI.esc(r.team.captain ? r.team.captain.username : '—')}</div>
              <div class="tc-sub">${UI.icon('users', 'w-3.5 h-3.5')} ${r.team.member_count}/${r.team.max_members} members · joined ${UI.timeAgo(r.registered_at)}</div>
            </div>
          </div>` : '').join('')}
      </div>
    </section>`;
  }

  function participatingTeams(detail) {
    return registeredTeams(detail);
  }

  /* ------------------------------------------------------ bracket tab */
  function renderBracketTab(mount) {
    const b = state.bracket;
    if (!b || !b.rounds.some(r => r.matches.length)) {
      mount.innerHTML = `<div class="card">${UI.emptyState({
        icon: 'gitBranch',
        title: 'Bracket not generated yet',
        message: `The bracket is created automatically inside the registration transaction when the tournament reaches ${b ? b.tournament.capacity : 'full'} / ${b ? b.tournament.capacity : '?'} teams and flips to LOCKED.`,
      })}</div>`;
      return;
    }
    mount.innerHTML = `
      <div class="card" style="padding:18px 14px 14px">
        <div class="section-head" style="padding:0 8px;margin-bottom:8px">
          <div>
            <h2 class="section-title">${UI.icon('gitBranch')} Tournament Bracket</h2>
            <p class="section-sub">Winners flow upward through the self-referencing FK <code class="mono" style="font-size:11.5px">matches.next_match_id</code> — ${b.tournament.capacity - 1} matches, ${b.tournament.total_rounds} rounds.</p>
          </div>
        </div>
        <div id="bracket-mount"></div>
      </div>`;

    Bracket.render(document.getElementById('bracket-mount'), b, {
      canManage: isAdmin() && b.tournament.status !== 'COMPLETED',
      onWinner: async () => { await reload(); },
    });
  }

  /* -------------------------------------------------------- overview tab */
  function renderOverviewTab(mount) {
    const detail = state.detail;
    const t = detail.tournament;
    mount.innerHTML = `
      ${t.status === 'COMPLETED' ? championHero(t) : ''}
      ${infoCards(t)}
      ${registrationPanel(t)}
      ${registeredTeams(detail)}`;
    const reg = mount.querySelector('#register-cta');
    if (reg) reg.addEventListener('click', () => registerFlow(t));
    const gotoBracket = mount.querySelector('[data-goto-bracket]');
    if (gotoBracket) gotoBracket.addEventListener('click', () => setTab('bracket'));
    if (t.status === 'COMPLETED') {
      const hero = mount.querySelector('#champ-hero');
      if (hero && !sessionStorage.getItem('aremax.confetti.' + t.id)) {
        sessionStorage.setItem('aremax.confetti.' + t.id, '1');
        setTimeout(() => UI.confetti(60), 400);
      }
    }
    UI.hydrateProgress(mount);
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
        message: 'You must create a team before registering for this tournament.',
        confirmLabel: 'Create Team Now',
        onConfirm: async () => {
          location.href = 'team.html';
          return false;
        }
      });
      return;
    }

    const optionsHtml = myTeams.map((tm, idx) => `
      <label class="card card-pad" style="display:flex;align-items:center;gap:12px;margin-bottom:8px;cursor:pointer;background:var(--card);border:1px solid var(--edge)">
        <input type="radio" name="sel_tourn_team" value="${tm.id}" ${idx === 0 ? 'checked' : ''} style="accent-color:var(--accent);width:18px;height:18px">
        <div style="flex:1">
          <div style="font-weight:700;color:#fff;font-size:14px">Team ID #${tm.id} · ${UI.esc(tm.name)} <span class="mono" style="font-size:11px;color:var(--accent)">[${UI.esc(tm.tag || '')}]</span></div>
          <div class="mono" style="font-size:11px;color:var(--faint)">${tm.member_count} members ${tm.is_eliminated ? '· <span style="color:var(--danger)">[Eliminated in past match]</span>' : '· Ready'}</div>
        </div>
      </label>
    `).join('');

    const modal = UI.modal({
      title: `Register for "${t.name}"`,
      subtitle: `Select which team you created to compete with (${t.registered_count}/${t.capacity} teams registered)`,
      body: `
        <div>
          <p style="font-size:13px;color:var(--muted);margin-bottom:12px">Choose one of your teams:</p>
          <form id="team-select-tourn-form">
            ${optionsHtml}
          </form>
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" data-close>Cancel</button>
        <button class="btn btn-primary" id="confirm-tourn-team-reg">${UI.icon('zap')}Confirm & Register Team</button>
      `
    });

    const confirmBtn = modal.el.querySelector('#confirm-tourn-team-reg');
    confirmBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (confirmBtn.disabled) return;
      const checked = modal.el.querySelector('input[name="sel_tourn_team"]:checked');
      if (!checked) return;
      confirmBtn.disabled = true;
      const teamId = parseInt(checked.value, 10);
      const selectedTeam = myTeams.find(x => x.id === teamId);
      modal.close();

      try {
        const res = await API.registerTeam(t.id, teamId);
        if (res.locked) {
          UI.confetti(60);
          UI.toast({ type: 'warn', title: 'Tournament LOCKED 🔒', message: `Capacity reached — bracket auto-generated with ${t.capacity} teams.`, duration: 6500 });
        } else {
          UI.toast({ type: 'success', title: 'Registration confirmed ✓', message: `${selectedTeam.name} (Team ID #${selectedTeam.id}) registered as seed #${res.seed}.` });
        }
      } catch (err) {
        UI.toast({ type: 'error', title: 'Registration failed', message: err.message, duration: 6000 });
      }
      try {
        await reload();
      } catch (e) {
        console.error('Failed to reload state after registration:', e);
      }
    });
  }

  /* ------------------------------------------------------------ tabs */
  function setTab(tab) {
    state.tab = tab;
    const url = new URL(location.href);
    url.searchParams.set('tab', tab);
    history.replaceState(null, '', url);
    render();
  }

  function tabbar() {
    const hasBracket = state.bracket && state.bracket.rounds.some(r => r.matches.length);
    return `<div class="tabbar">
      <button class="tab-btn ${state.tab === 'overview' ? 'active' : ''}" data-tab="overview">${UI.icon('info')}Overview</button>
      <button class="tab-btn ${state.tab === 'bracket' ? 'active' : ''}" data-tab="bracket">${UI.icon('gitBranch')}Bracket ${hasBracket ? '' : '<span class="badge badge-slate" style="font-size:9px">locked</span>'}</button>
    </div>`;
  }

  function render() {
    const page = document.getElementById('page');
    const t = state.detail.tournament;
    page.innerHTML = `
      ${header(t)}
      ${tabbar()}
      <div id="tab-mount"></div>`;
    page.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
    const mount = document.getElementById('tab-mount');
    if (state.tab === 'bracket') renderBracketTab(mount); else renderOverviewTab(mount);

    const delHdrBtn = page.querySelector('#hdr-del-tourn-btn');
    if (delHdrBtn) {
      delHdrBtn.addEventListener('click', () => {
        UI.confirmDialog({
          title: `Delete "${t.name}"?`,
          message: `Are you sure you want to permanently delete "${t.name}"? All matches and registrations will be deleted via ON DELETE CASCADE. This cannot be undone.`,
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

  async function reload() {
    const validId = state.id && state.id !== 'undefined' && state.id !== 'null' && !isNaN(Number(state.id));
    if (!validId) {
      const tournaments = await API.getTournaments();
      const page = document.getElementById('page');
      if (page) renderCatalog(tournaments, page);
      return;
    }
    const [detail, bracket] = await Promise.all([API.getTournament(state.id), API.getBracket(state.id)]);
    state.detail = detail;
    state.bracket = bracket;
    render();
  }

  function renderCatalog(list, page) {
    page.innerHTML = `
      <section class="hero fade-up" style="margin-bottom:24px">
        <div style="max-width:700px">
          <span class="land-kicker" style="font-size:10px">${UI.icon('trophy', 'w-3.5 h-3.5')} LIVE TOURNAMENTS</span>
          <h1 style="font-size:clamp(22px,3.2vw,30px);font-weight:800;letter-spacing:-0.02em;margin-top:10px;color:#fff">
            Available Tournaments
          </h1>
          <p style="color:var(--muted);font-size:14px;margin-top:6px;line-height:1.6">
            Click on any live tournament to register your team or inspect the live knockout bracket.
          </p>
        </div>
      </section>

      ${list.length ? `
        <div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          ${list.map(t => {
            const pct = Math.round((t.registered_count / t.capacity) * 100);
            const full = t.registered_count >= t.capacity;
            const open = t.status === 'REGISTRATION_OPEN';
            return `
              <div class="card card-hover card-pad fade-up" style="display:flex;flex-direction:column;justify-content:space-between">
                <div>
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                    <span style="font-size:17px;font-weight:800;color:#fff">${UI.esc(t.name)}</span>
                    ${UI.statusBadge(t.status)}
                  </div>
                  <div style="font-size:13px;color:var(--muted);margin-bottom:14px">
                    ${t.capacity}-Team Knockout · ${t.registered_count}/${t.capacity} Teams Registered
                  </div>
                  <div style="margin-bottom:14px">
                    ${UI.progress(pct, { tone: full ? 'warn' : 'accent' })}
                  </div>
                </div>
                <div style="display:flex;gap:8px;margin-top:12px">
                  <a class="btn btn-outline btn-sm" style="flex:1" href="tournament.html?id=${t.id}&tab=bracket">${UI.icon('eye')}View Bracket</a>
                  ${isAdmin() ? `
                    <a class="btn btn-primary btn-sm" style="flex:1" href="admin.html?view=manage&id=${t.id}">${UI.icon('settings')}Manage</a>
                    <button class="btn btn-ghost btn-sm text-rose-400" data-del-cat="${t.id}" data-del-name="${UI.esc(t.name)}" title="Delete Tournament">${UI.icon('trash')}</button>
                  ` : (open && !full ? `<button class="btn btn-primary btn-sm" style="flex:1" data-cat-reg="${t.id}">${UI.icon('zap')}Register Team</button>` : '')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div class="card card-pad" style="text-align:center;padding:48px 24px">
          ${UI.icon('trophy', 'w-12 h-12 text-slate-500 mx-auto mb-3')}
          <h3 style="font-size:18px;font-weight:700;color:#fff">No live tournaments right now</h3>
          <p style="color:var(--muted);font-size:13.5px;margin-top:6px">New tournaments will appear here when an admin creates them.</p>
        </div>
      `}
    `;

    page.querySelectorAll('[data-cat-reg]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tId = parseInt(btn.dataset.catReg, 10);
        const t = list.find(x => x.id === tId);
        if (t) registerFlow(t);
      });
    });

    page.querySelectorAll('[data-del-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tId = btn.dataset.delCat;
        const tName = btn.dataset.delName;
        UI.confirmDialog({
          title: `Delete "${tName}"?`,
          message: `Are you sure you want to permanently delete "${tName}"? All matches, registrations, and bracket state will be deleted via ON DELETE CASCADE. This action cannot be undone.`,
          confirmLabel: 'Delete Tournament',
          danger: true,
          onConfirm: async () => {
            try {
              await API.deleteTournament(tId);
              UI.toast({ type: 'success', title: 'Tournament deleted', message: `"${tName}" was deleted.` });
              await reload();
              return true;
            } catch (err) {
              UI.toast({ type: 'error', title: 'Failed to delete tournament', message: err.message });
              return false;
            }
          }
        });
      });
    });
  }

  async function init() {
    const user = await Auth.requireAuth();
    if (!user) return;
    state.user = user;
    const params = new URLSearchParams(location.search);
    const hasId = params.get('id');

    await UI.renderPlayerNav('tournaments', user);
    const page = document.getElementById('page');
    page.innerHTML = `<div class="skel skel-line" style="height:38px;width:45%;margin-bottom:22px"></div>${UI.skelGrid(4, 'repeat(auto-fill,minmax(200px,1fr))')}<div class="mt-6">${UI.skelGrid(2)}</div>`;

    if (!hasId) {
      try {
        const tournaments = await API.getTournaments();
        renderCatalog(tournaments, page);
      } catch (err) {
        page.innerHTML = UI.errorState(err, 'TournamentPage.init()');
      }
      return;
    }

    state.id = hasId;
    state.tab = params.get('tab') === 'bracket' ? 'bracket' : 'overview';

    try {
      const calls = [API.getTournament(state.id), API.getBracket(state.id)];
      if (user.role !== 'ADMIN') calls.push(API.getMyStats());
      const [detail, bracket, myStats] = await Promise.all(calls);
      state.detail = detail;
      state.bracket = bracket;
      state.myStats = myStats || null;
      state.id = detail.tournament.id;
      render();
    } catch (err) {
      if (err.status === 404) {
        page.innerHTML = UI.emptyState({ icon: 'search', tone: 'warn', title: 'Tournament not found', message: 'It may have been removed, or the link is incorrect.', action: `<a class="btn btn-primary" href="tournament.html">${UI.icon('trophy')}View all tournaments</a>` });
      } else {
        page.innerHTML = UI.errorState(err, 'TournamentPage.init()');
      }
    }
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => TournamentPage.init());
