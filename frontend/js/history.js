/* ==========================================================================
   ArenaX · history.js — Tournament history (completed tournaments)
   Page: history.html
   ========================================================================== */
'use strict';

const HistoryPage = (() => {
  let state = { user: null, tournaments: [], filter: 'ALL', search: '' };

  function row(t) {
    return `
    <tr style="cursor:pointer" data-open="${t.id}">
      <td>
        <div style="display:flex;align-items:center;gap:11px">
          <span class="avatar sm sq" style="background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.35);color:var(--warn)">${UI.icon('trophy', 'w-4 h-4')}</span>
          <div>
            <div class="td-strong">${UI.esc(t.name)}</div>
            <div class="mono" style="font-size:10.5px;color:var(--faint)">${t.capacity}-team single elimination · ${t.total_rounds} rounds</div>
          </div>
        </div>
      </td>
      <td>
        ${t.champion_team_name
          ? `<span style="display:inline-flex;align-items:center;gap:8px;color:#FCD34D;font-weight:700">🏆 ${UI.esc(t.champion_team_name)}</span>`
          : '<span style="color:var(--faint)">—</span>'}
      </td>
      <td><span class="chip">${UI.icon('users', 'w-3.5 h-3.5')} ${t.registered_count} Teams</span></td>
      <td>${UI.fmtDate(t.completed_at)} <span class="mono" style="font-size:10.5px;color:var(--faint)">(${UI.timeAgo(t.completed_at)})</span></td>
      <td>${UI.statusBadge(t.status)}</td>
      <td>
        <div class="tbl-actions">
          ${t.my_team_registered ? `<span class="badge badge-accent" title="Your team participated">Played</span>` : ''}
          <a class="btn btn-outline btn-sm" href="tournament.html?id=${t.id}&tab=bracket" onclick="event.stopPropagation()">${UI.icon('gitBranch')}Final Bracket</a>
        </div>
      </td>
    </tr>`;
  }

  function render(page) {
    let list = state.tournaments;
    if (state.filter === 'MINE') list = list.filter(t => t.my_team_registered);
    const s = state.search.toLowerCase();
    if (s) list = list.filter(t => t.name.toLowerCase().includes(s) || (t.champion_team_name || '').toLowerCase().includes(s));

    page.innerHTML = `
      ${UI.pageHeader({
        title: 'Tournament History',
        sub: 'Every completed event — champions, brackets and final states are preserved permanently.',
      })}
      <div class="card card-pad" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:20px">
        <div class="filter-pills">
          <button class="f-pill ${state.filter === 'ALL' ? 'active' : ''}" data-filter="ALL">All completed</button>
          <button class="f-pill ${state.filter === 'MINE' ? 'active' : ''}" data-filter="MINE">My team played</button>
        </div>
        <div style="margin-left:auto;min-width:230px;flex:1;max-width:360px">${UI.searchInput('Search by tournament or champion…', 'hist-search', state.search)}</div>
      </div>
      ${list.length ? `
        <div class="tbl-wrap fade-up">
          <table class="tbl">
            <thead><tr><th>Tournament</th><th>Winner</th><th>Teams</th><th>Completed</th><th>Status</th><th style="text-align:right">Bracket</th></tr></thead>
            <tbody>${list.map(row).join('')}</tbody>
          </table>
        </div>
        <p class="mono" style="font-size:11px;color:var(--faint);margin-top:12px">SELECT * FROM tournaments WHERE status = 'COMPLETED' ORDER BY completed_at DESC — ${list.length} row${list.length === 1 ? '' : 's'}</p>`
      : `<div class="card">${UI.emptyState({
          icon: 'history',
          title: state.filter === 'MINE' ? 'Your team has no finished tournaments yet' : 'No completed tournaments yet',
          message: 'Once a final match gets a winner, the tournament is archived here with its full bracket and champion.',
          action: `<a class="btn btn-primary" href="dashboard.html?tab=tournaments">${UI.icon('trophy')}Browse live tournaments</a>`,
        })}</div>`}`;

    page.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => { state.filter = b.dataset.filter; render(page); }));
    page.querySelectorAll('[data-open]').forEach(tr => tr.addEventListener('click', () => { location.href = `tournament.html?id=${tr.dataset.open}&tab=bracket`; }));
    const searchEl = page.querySelector('#hist-search');
    let deb;
    searchEl && searchEl.addEventListener('input', () => {
      clearTimeout(deb);
      deb = setTimeout(() => { state.search = searchEl.value; render(page); const el = document.getElementById('hist-search'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }, 350);
    });
  }

  async function init() {
    const user = await Auth.requireAuth();
    if (!user) return;
    state.user = user;
    await UI.renderPlayerNav('history', user);
    const page = document.getElementById('page');
    page.innerHTML = UI.skelTable(4);
    try {
      state.tournaments = await API.getTournaments({ status: 'COMPLETED' });
      render(page);
    } catch (err) {
      page.innerHTML = UI.errorState(err, 'HistoryPage.init()');
    }
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => HistoryPage.init());
