/* ==========================================================================
   ArenaX · team.js — My Team (creation + roster management)
   Page: team.html
   DBMS concepts demonstrated:
     • create_team runs as ONE transaction (INSERT teams + INSERT captain
       membership) — the captain automatically belongs to the team
     • UNIQUE(team_members.user_id)   → one team per player
     • CHECK roster size ≤ 5          → "Members 4/5" visual
     • FK teams.captain_id            → captain cannot be removed
   ========================================================================== */
'use strict';

const TeamPage = (() => {
  let state = { user: null, team: null, isCaptain: false };

  /* ------------------------------------------------------- no team state */
  function renderNoTeam(page) {
    page.innerHTML = `
      ${UI.pageHeader({ title: 'My Team', sub: 'Create your squad, manage the roster, and enter tournaments.' })}
      <div class="card fade-up">
        ${UI.emptyState({
          icon: 'users', tone: 'acc',
          title: 'No team created yet',
          message: 'Create a team with yourself as Team Lead to register for live tournaments.',
          action: `<button class="btn btn-primary btn-lg" id="create-team-btn">${UI.icon('plus')}Create Your Team</button>`,
        })}
      </div>`;
    page.querySelector('#create-team-btn').addEventListener('click', openCreateModal);
  }

  function openCreateModal() {
    const m = UI.modal({
      title: 'Create your team',
      subtitle: 'You will be the Team Lead.',
      body: `
        <form id="create-team-form" class="auth-form" novalidate>
          <div class="field">
            <label class="field-label" for="ct-name">Team name *</label>
            <input class="input" id="ct-name" name="name" placeholder="e.g. Team Nova" maxlength="24" required>
            <span class="field-hint">3–24 characters · must be unique</span>
          </div>
          <div class="field">
            <label class="field-label" for="ct-tag">Team tag</label>
            <input class="input mono" id="ct-tag" name="tag" placeholder="NOVA" maxlength="5" style="text-transform:uppercase">
            <span class="field-hint">Optional · up to 5 characters, shown on the bracket</span>
          </div>
        </form>`,
      footer: `
        <button class="btn btn-ghost" data-close>Cancel</button>
        <button class="btn btn-primary" id="ct-submit">${UI.icon('check')}Create Team</button>`,
    });
    const submit = async () => {
      const btn = m.el.querySelector('#ct-submit');
      const name = m.el.querySelector('#ct-name').value.trim();
      const tag = m.el.querySelector('#ct-tag').value.trim();
      m.el.querySelectorAll('.field-error').forEach(e => e.remove());
      if (name.length < 3) {
        const p = document.createElement('span'); p.className = 'field-error';
        p.innerHTML = `${UI.icon('alert', 'w-3.5 h-3.5')} Team name must be at least 3 characters.`;
        m.el.querySelector('#ct-name').closest('.field').appendChild(p);
        return;
      }
      btn.classList.add('loading'); btn.disabled = true;
      try {
        const res = await API.createTeam({ name, tag });
        state.team = res.team; state.isCaptain = true;
        m.close();
        UI.toast({ type: 'success', title: `${res.team.name} created 🎉`, message: 'You are the captain. Build your roster, then register for tournaments.' });
        renderTeam(document.getElementById('page'));
      } catch (err) {
        btn.classList.remove('loading'); btn.disabled = false;
        UI.toast({ type: 'error', title: 'Could not create team', message: err.message });
        if (err.fields && err.fields.name) {
          const p = document.createElement('span'); p.className = 'field-error';
          p.innerHTML = `${UI.icon('alert', 'w-3.5 h-3.5')} ${UI.esc(err.fields.name)}`;
          m.el.querySelector('#ct-name').closest('.field').appendChild(p);
        }
      }
    };
    m.el.querySelector('#ct-submit').addEventListener('click', submit);
    m.el.querySelector('#create-team-form').addEventListener('submit', e => { e.preventDefault(); submit(); });
  }

  /* --------------------------------------------------------- team render */
  function composition(team) {
    const slots = [];
    team.members.forEach(mem => {
      slots.push(`
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:74px">
          <div style="position:relative">
            ${UI.avatar(mem.full_name || mem.username, { size: 'lg' })}
            ${mem.role === 'CAPTAIN' ? `<span style="position:absolute;top:-7px;right:-7px;color:var(--warn);filter:drop-shadow(0 0 5px rgba(251,191,36,.7))">${UI.icon('crown', 'w-4 h-4')}</span>` : ''}
          </div>
          <span style="font-size:11px;font-weight:600;color:var(--text);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${UI.esc(mem.username)}</span>
          <span style="font-size:9.5px;color:var(--faint)" class="mono">${mem.role === 'CAPTAIN' ? 'captain' : 'member'}</span>
        </div>`);
    });
    for (let i = team.members.length; i < team.max_members; i++) {
      slots.push(`
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:74px;opacity:.5">
          <div class="avatar lg" style="border:1.5px dashed var(--edge-strong);color:var(--faint);background:transparent">${UI.icon('plus', 'w-5 h-5')}</div>
          <span style="font-size:11px;color:var(--faint)">open slot</span>
        </div>`);
    }
    return `<div style="display:flex;gap:14px;flex-wrap:wrap">${slots.join('')}</div>`;
  }

  /* --------------------------------------------------------- all teams render */
  function renderAllTeams(page) {
    const { teams, user } = state;
    page.innerHTML = `
      ${UI.pageHeader({
        title: 'My Teams',
        sub: `All teams created and captained by you (${teams.length} team${teams.length === 1 ? '' : 's'}).`,
        actions: `<button class="btn btn-primary" id="create-team-header-btn">${UI.icon('plus')}Create Another Team</button>`,
      })}

      <div style="display:flex;flex-direction:column;gap:24px">
        ${teams.map((tm, idx) => {
          const pct = (tm.member_count / tm.max_members) * 100;
          return `
          <div class="card card-pad fade-up" style="position:relative">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:18px">
              <div style="display:flex;align-items:center;gap:14px">
                ${UI.avatar(tm.name, { size: 'lg', square: true })}
                <div>
                  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                    <span style="font-size:19px;font-weight:800;color:#fff">${UI.esc(tm.name)}</span>
                    <span class="badge badge-accent" style="font-size:11px">Team ID #${tm.id}</span>
                    <span class="mono" style="font-size:11px;color:var(--accent)">[${UI.esc(tm.tag || 'TEAM')}]</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px;margin-top:4px;font-size:12.5px;color:var(--muted)">
                    <span>${UI.icon('crown', 'w-3.5 h-3.5 text-amber-400')} Team Lead: <b>${UI.esc(tm.captain_name || (user ? user.username : ''))}</b></span>
                    <span>· Created: ${UI.fmtDate(tm.created_at)}</span>
                  </div>
                </div>
              </div>

              <div>
                ${tm.is_eliminated
                  ? `<span class="badge" style="background:rgba(248,113,113,.15);border:1px solid rgba(248,113,113,.3);color:var(--danger);font-size:11px;font-weight:700">✕ ELIMINATED</span>`
                  : tm.in_active_tournament
                    ? `<span class="badge badge-accent" style="font-size:11px">⚡ IN TOURNAMENT</span>`
                    : `<span class="badge badge-win" style="font-size:11px">✓ READY FOR TOURNAMENT</span>`}
              </div>
            </div>

            <div class="grid gap-5 lg:grid-cols-3" style="margin-top:14px;border-top:1px solid var(--edge);padding-top:16px">
              <!-- Info -->
              <div style="display:flex;flex-direction:column;gap:10px">
                <div class="kv">
                  <span class="k">Roster Size</span>
                  <span class="v" style="font-size:13px">${tm.member_count} / ${tm.max_members} members</span>
                  <div style="margin-top:6px">${UI.progress(pct, { tone: pct >= 100 ? 'warn' : 'accent' })}</div>
                </div>
                <div style="display:flex;gap:8px;margin-top:6px">
                  <button class="btn btn-outline btn-sm" data-add-member="${tm.id}">${UI.icon('userPlus')}Add Member</button>
                  <a href="dashboard.html?tab=tournaments" class="btn btn-primary btn-sm">${UI.icon('trophy')}Enter Tournament</a>
                </div>
              </div>

              <!-- Composition -->
              <div class="lg:col-span-2">
                <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px">Team Members</div>
                <div style="display:flex;gap:12px;flex-wrap:wrap">
                  ${tm.members ? tm.members.map(m => `
                    <div style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.03);border:1px solid var(--edge);padding:6px 12px;border-radius:8px">
                      ${UI.avatar(m.full_name || m.username, { size: 'sm' })}
                      <div>
                        <div style="font-size:12.5px;font-weight:700;color:#fff">${UI.esc(m.full_name || m.username)}</div>
                        <div class="mono" style="font-size:10px;color:var(--faint)">${m.role === 'CAPTAIN' ? 'Team Lead' : 'Member'}</div>
                      </div>
                      ${m.role !== 'CAPTAIN' ? `
                        <button class="icon-btn" style="color:var(--danger);margin-left:4px" data-remove-member="${m.user_id}" data-team-id="${tm.id}" data-member-name="${UI.esc(m.username)}" title="Remove member">${UI.icon('trash')}</button>
                      ` : ''}
                    </div>
                  `).join('') : '<span style="color:var(--faint)">No members loaded</span>'}
                </div>
              </div>
            </div>
          </div>
          `;
        }).join('')}
      </div>
    `;

    UI.hydrateProgress(page);

    const createHeaderBtn = page.querySelector('#create-team-header-btn');
    if (createHeaderBtn) createHeaderBtn.addEventListener('click', openCreateModal);

    page.querySelectorAll('[data-add-member]').forEach(btn => {
      btn.addEventListener('click', () => {
        const teamId = parseInt(btn.dataset.addMember, 10);
        openAddMemberModal(teamId);
      });
    });

    page.querySelectorAll('[data-remove-member]').forEach(btn => {
      btn.addEventListener('click', () => {
        const userId = btn.dataset.removeMember;
        const teamId = btn.dataset.teamId;
        const memberName = btn.dataset.memberName;
        confirmRemove(teamId, userId, memberName);
      });
    });
  }

  function openCreateModal() {
    const u = state.user;
    const m = UI.modal({
      title: 'Create a new team',
      subtitle: `You will be the Team Lead (@${UI.esc(u ? u.username : '')}).`,
      body: `
        <form id="create-team-modal-form" class="auth-form" novalidate>
          <div class="field">
            <label class="field-label" for="ct-name">Team Name *</label>
            <input class="input" id="ct-name" name="name" placeholder="e.g. Apex Predators" maxlength="50" required>
            <span class="field-hint">3–50 characters · must be unique</span>
          </div>
          <div class="field">
            <label class="field-label" for="ct-tag">Team Tag</label>
            <input class="input mono" id="ct-tag" name="tag" placeholder="APEX" maxlength="5" style="text-transform:uppercase">
          </div>
          <div class="field">
            <label class="field-label">Add Initial Member Names (Optional)</label>
            <input class="input" id="ct-mem1" placeholder="Member 1 full name" style="margin-bottom:6px">
            <input class="input" id="ct-mem2" placeholder="Member 2 full name" style="margin-bottom:6px">
            <input class="input" id="ct-mem3" placeholder="Member 3 full name">
            <span class="field-hint">You can also add members anytime later.</span>
          </div>
          <div id="ct-modal-error"></div>
        </form>`,
      footer: `
        <button class="btn btn-ghost" data-close>Cancel</button>
        <button class="btn btn-primary" id="ct-submit">${UI.icon('check')}Create Team</button>`,
    });

    const submit = async () => {
      const btn = m.el.querySelector('#ct-submit');
      const errBox = m.el.querySelector('#ct-modal-error');
      errBox.innerHTML = '';
      const name = m.el.querySelector('#ct-name').value.trim();
      const tag = m.el.querySelector('#ct-tag').value.trim();
      const m1 = m.el.querySelector('#ct-mem1').value.trim();
      const m2 = m.el.querySelector('#ct-mem2').value.trim();
      const m3 = m.el.querySelector('#ct-mem3').value.trim();
      const members = [m1, m2, m3].filter(Boolean);

      if (name.length < 3) {
        errBox.innerHTML = `<div class="warn-strip danger-strip">${UI.icon('alert')}<span>Team name must be at least 3 characters.</span></div>`;
        return;
      }
      btn.classList.add('loading'); btn.disabled = true;
      try {
        const res = await API.createTeam({ name, tag, members });
        m.close();
        UI.toast({ type: 'success', title: `${res.team.name} created!`, message: `Assigned Team ID #${res.team.id}.` });
        await init();
      } catch (err) {
        btn.classList.remove('loading'); btn.disabled = false;
        errBox.innerHTML = `<div class="warn-strip danger-strip">${UI.icon('xCircle')}<span>${UI.esc(err.message)}</span></div>`;
      }
    };
    m.el.querySelector('#ct-submit').addEventListener('click', submit);
    m.el.querySelector('#create-team-modal-form').addEventListener('submit', e => { e.preventDefault(); submit(); });
  }

  /* -------------------------------------------------------- add member */
  function openAddMemberModal(teamId) {
    const m = UI.modal({
      title: 'Add member to team',
      subtitle: 'Type player name to add to the team roster.',
      body: `
        <div class="field">
          <label class="field-label" for="am-new-name">Player Name *</label>
          <input class="input" id="am-new-name" placeholder="Enter player name" required>
        </div>
        <div id="am-err"></div>`,
      footer: `
        <button class="btn btn-ghost" data-close>Cancel</button>
        <button class="btn btn-primary" id="am-submit">${UI.icon('plus')}Add Member</button>`,
    });

    const submit = async () => {
      const name = m.el.querySelector('#am-new-name').value.trim();
      const errBox = m.el.querySelector('#am-err');
      const btn = m.el.querySelector('#am-submit');
      errBox.innerHTML = '';
      if (!name) return;
      btn.disabled = true;
      btn.classList.add('loading');
      try {
        await API.addTeamMember(teamId, name);
        m.close();
        UI.toast({ type: 'success', title: 'Member added ✓', message: `${name} has been added to the roster.` });
        await init();
      } catch (err) {
        btn.disabled = false;
        btn.classList.remove('loading');
        errBox.innerHTML = `<div class="warn-strip danger-strip">${UI.icon('xCircle')}<span>${UI.esc(err.message)}</span></div>`;
      }
    };

    m.el.querySelector('#am-submit').addEventListener('click', submit);
    const input = m.el.querySelector('#am-new-name');
    if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
  }

  /* ----------------------------------------------------- remove member */
  function confirmRemove(teamId, userId, username) {
    UI.confirmDialog({
      title: `Remove ${username}?`,
      message: `Remove this member from the team roster?`,
      confirmLabel: 'Remove Member',
      danger: true,
      onConfirm: async () => {
        try {
          await API.removeTeamMember(teamId, userId);
          UI.toast({ type: 'success', title: 'Member removed', message: `${username} has been removed from the roster.` });
          await init();
        } catch (err) {
          UI.toast({ type: 'error', title: 'Could not remove member', message: err.message });
        }
      },
    });
  }

  /* ------------------------------------------------------------- init */
  async function init() {
    const user = await Auth.requireAuth();
    if (!user) return;
    if (user.role === 'ADMIN') {
      location.replace('admin.html');
      return;
    }
    state.user = user;
    await UI.renderPlayerNav('team', user);
    const page = document.getElementById('page');
    page.innerHTML = `<div class="grid gap-5 lg:grid-cols-3">${UI.skelCard()}${UI.skelCard()}${UI.skelCard()}</div>`;
    try {
      const res = await API.getMyTeam();
      state.teams = res.teams || (res.team ? [res.team] : []);
      state.isCaptain = res.is_captain;
      if (!state.teams.length) renderNoTeam(page); else renderAllTeams(page);
    } catch (err) {
      page.innerHTML = UI.errorState(err, 'TeamPage.init()');
    }
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => TeamPage.init());
