/* ==========================================================================
   ArenaX · bracket.js — Horizontal Single-Elimination Knockout Bracket
   --------------------------------------------------------------------------
   Matches the clean, spacious horizontal bracket layout from the reference:
   - Rounds progress horizontally across columns from left to right
   - Each match card displays both teams with seeds and a dedicated action cell
   - Direct, intuitive winner selection with instant propagation to next round
   - Clean fork bracket lines connect pairs to the next round and champion
   ========================================================================== */
'use strict';

const Bracket = (() => {

  const ROUND_NAMES = {
    1: ['Final'],
    2: ['Semifinals', 'Final'],
    3: ['Quarterfinals', 'Semifinals', 'Final'],
    4: ['Round of 16', 'Quarterfinals', 'Semifinals', 'Final'],
  };
  const ABBR = { 'Round of 16': 'R16', 'Quarterfinals': 'QF', 'Semifinals': 'SF', 'Final': 'F' };

  const effStatus = (m) => (m.status === 'PENDING' && !m.team1 && !m.team2) ? 'WAITING' : m.status;

  /* ------------------------------------------------ Guaranteed style injection */
  function ensureStyles() {
    let style = document.getElementById('arena-bracket-styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'arena-bracket-styles';
      document.head.appendChild(style);
    }
    style.textContent = `
      .bracket-scroll { overflow-x: auto; overflow-y: auto; max-height: 85vh; padding: 18px 8px 28px; width: 100%; -webkit-overflow-scrolling: touch; }
      .bracket.bracket-container { display: flex; align-items: stretch; min-width: min-content; padding: 8px 4px; }
      .b-round-col { display: flex; flex-direction: column; flex: 0 0 auto; min-width: 295px; max-width: 325px; margin-right: 54px; position: relative; }
      .b-col-header { padding: 0 0 16px 4px; text-align: left; }
      .b-col-title { font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #7DD3FC; display: flex; align-items: center; gap: 8px; }
      .b-col-sub { font-size: 11px; color: #64748b; font-family: 'JetBrains Mono', monospace; margin-top: 3px; }
      .b-col-matches { display: flex; flex-direction: column; justify-content: space-around; flex: 1 1 auto; gap: 0; }
      .b-match-slot { position: relative; display: flex; flex-direction: column; justify-content: center; flex: 1 1 0; min-height: 200px; padding: 14px 0; }
      .b-match-unit { width: 100%; position: relative; z-index: 2; }
      .b-match-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; padding: 0 4px; min-height: 18px; }
      .b-match-num { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; color: #94a3b8; }
      .b-match-card { width: 100%; border-radius: 12px; background: #0d1626; border: 1.5px solid #23354d; padding: 10px; box-shadow: 0 8px 24px -6px rgba(2,6,23,0.7); transition: all 0.2s ease; position: relative; }
      .b-match-card:hover { border-color: rgba(56, 189, 248, 0.5); box-shadow: 0 10px 26px -6px rgba(56, 189, 248, 0.22); }
      .b-match-card.is-ready { border-color: rgba(56, 189, 248, 0.7); box-shadow: 0 0 20px -4px rgba(56, 189, 248, 0.35); }
      .b-match-card.is-completed { border-color: rgba(52, 211, 153, 0.45); }
      .b-match-card.is-waiting { border-style: dashed; opacity: 0.8; }
      .b-team-boxes-wrap { display: flex; flex-direction: column; gap: 8px; }
      .b-team-box { display: flex; align-items: center; justify-content: space-between; min-height: 52px; background: #142033; border: 1.5px solid #22344d; border-radius: 8px; padding: 7px 10px; transition: all 0.18s ease; position: relative; gap: 10px; }
      .b-team-box.can-pick { cursor: pointer; }
      .b-team-box.can-pick:hover { border-color: #38bdf8; background: #192a45; box-shadow: 0 0 12px rgba(56,189,248,0.25); }
      .b-team-box.is-winner { background: linear-gradient(90deg, rgba(52, 211, 153, 0.16), rgba(16, 28, 44, 0.8)); border-color: rgba(52, 211, 153, 0.6); box-shadow: 0 0 14px rgba(52, 211, 153, 0.18); }
      .b-team-box.is-loser { opacity: 0.55; background: rgba(15, 23, 42, 0.5); border-color: #1e293b; }
      .b-team-box.is-tbd { opacity: 0.7; border-style: dashed; }
      .b-team-left { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
      .b-team-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
      .b-team-title-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
      .b-team-name { font-size: 13.5px; font-weight: 700; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.01em; }
      .b-team-box.is-winner .b-team-name { color: #6ee7b7; }
      .b-team-box.is-loser .b-team-name { text-decoration: line-through; text-decoration-color: rgba(248, 113, 113, 0.6); color: #94a3b8; }
      .b-team-name.tbd-text { color: #64748b; font-style: italic; font-weight: 500; }
      .b-team-sub { font-size: 10.5px; color: #64748b; font-family: 'JetBrains Mono', monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .b-seed-tag { font-family: 'JetBrains Mono', monospace; font-size: 9.5px; font-weight: 700; color: #7dd3fc; background: rgba(56, 189, 248, 0.14); padding: 1px 5px; border-radius: 4px; border: 1px solid rgba(56, 189, 248, 0.3); flex: none; }
      .b-tbd-av { background: transparent; border: 1px dashed #334155; color: #64748b; font-size: 10px; }
      .b-team-cell { flex: 0 0 auto; display: flex; align-items: center; justify-content: center; min-width: 64px; }
      .b-select-btn { padding: 6px 12px; border-radius: 6px; font-size: 10.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #04121f; background: linear-gradient(135deg, #38bdf8, #0ea5e9); border: none; cursor: pointer; transition: all 0.18s ease; white-space: nowrap; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(56, 189, 248, 0.4); }
      .b-select-btn:hover { transform: scale(1.05); box-shadow: 0 4px 14px rgba(56, 189, 248, 0.65); background: linear-gradient(135deg, #7dd3fc, #38bdf8); }
      .b-winner-badge { display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 4px 9px; border-radius: 6px; background: rgba(52, 211, 153, 0.16); border: 1px solid rgba(52, 211, 153, 0.45); font-size: 10.5px; font-weight: 800; color: #34d399; }
      .b-winner-badge svg { color: #fbbf24; filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.6)); }
      .b-loser-tag { display: inline-flex; align-items: center; justify-content: center; padding: 4px 9px; border-radius: 6px; background: rgba(248, 113, 113, 0.07); border: 1px solid rgba(248, 113, 113, 0.25); font-size: 10.5px; font-weight: 700; color: #f87171; }
      .b-cell-empty { font-size: 11px; color: #475569; }
      .b-vs-divider { display: flex; align-items: center; justify-content: center; position: relative; height: 2px; margin: 1px 0; }
      .b-vs-divider::before { content: ''; position: absolute; left: 0; right: 0; height: 1px; background: rgba(46, 65, 94, 0.5); }
      .b-vs-label { position: relative; background: #0d1626; padding: 0 6px; font-size: 9px; font-weight: 800; color: #475569; letter-spacing: 0.1em; font-family: 'JetBrains Mono', monospace; }
      .b-bracket-wire-out { position: absolute; right: -27px; width: 28px; top: 50%; transform: translateY(-50%); height: 2px; background: #253750; pointer-events: none; border-radius: 1px; }
      .b-bracket-wire-in { position: absolute; left: -27px; width: 28px; top: 50%; transform: translateY(-50%); height: 2px; background: #253750; pointer-events: none; border-radius: 1px; }
      .b-bracket-wire-v-down { position: absolute; right: -27px; top: 50%; bottom: 0; width: 2px; background: #253750; pointer-events: none; border-radius: 1px; }
      .b-bracket-wire-v-up { position: absolute; right: -27px; top: 0; height: 50%; width: 2px; background: #253750; pointer-events: none; border-radius: 1px; }
      .b-wire-live { background: #34d399 !important; box-shadow: 0 0 8px rgba(52, 211, 153, 0.7) !important; }
      .b-wire-final-lead { height: 3px !important; background: linear-gradient(90deg, #34d399 0%, #6ee7b7 50%, #facc15 100%) !important; box-shadow: 0 0 10px rgba(52, 211, 153, 0.65) !important; z-index: 3; }
      .b-wire-champ { height: 3px !important; background: linear-gradient(90deg, #facc15 0%, #fbbf24 60%, #f59e0b 100%) !important; box-shadow: 0 0 12px rgba(251, 191, 36, 0.75) !important; z-index: 3; }
      .b-wire-champ::after { content: ''; position: absolute; right: -2px; top: 50%; transform: translateY(-50%); width: 7px; height: 7px; border-radius: 50%; background: #fbbf24; box-shadow: 0 0 10px #fbbf24; }
      .b-champ-col { display: flex; flex-direction: column; justify-content: center; flex: 0 0 auto; min-width: 260px; max-width: 290px; position: relative; }
      .b-champ-card { border-radius: 16px; padding: 24px 20px 22px; text-align: center; position: relative; overflow: hidden; transition: all 0.25s ease; z-index: 2; }
      .b-champ-card.crowned { background: radial-gradient(circle at 50% 0%, rgba(251, 191, 36, 0.22) 0%, rgba(26, 36, 56, 0.95) 55%, rgba(13, 22, 38, 0.98) 100%); border: 1.5px solid rgba(251, 191, 36, 0.75); box-shadow: 0 0 35px -5px rgba(251, 191, 36, 0.3), 0 14px 34px -8px rgba(2, 6, 23, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.2); }
      .b-champ-card.crowned::before { content: ''; position: absolute; top: 0; left: 20%; right: 20%; height: 2px; background: linear-gradient(90deg, transparent, #fde047, transparent); box-shadow: 0 0 10px #fbbf24; }
      .b-champ-card.pending { border: 1.5px dashed #283e5e; background: rgba(15, 23, 42, 0.5); }
      .b-champ-trophy-wrap { position: relative; width: 68px; height: 68px; margin: 0 auto 4px; display: flex; align-items: center; justify-content: center; }
      .b-champ-aura { position: absolute; inset: 0; border-radius: 50%; background: radial-gradient(circle, rgba(251, 191, 36, 0.32) 0%, rgba(251, 191, 36, 0.08) 60%, transparent 80%); filter: blur(2px); animation: pulseAura 3s ease-in-out infinite; }
      @keyframes pulseAura { 0%, 100% { transform: scale(0.95); opacity: 0.8; } 50% { transform: scale(1.15); opacity: 1; } }
      .b-champ-trophy { font-size: 42px; line-height: 1; position: relative; z-index: 1; filter: drop-shadow(0 0 14px rgba(251, 191, 36, 0.75)); animation: trophyFloat 3s ease-in-out infinite; }
      .b-champ-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px; background: linear-gradient(135deg, rgba(251, 191, 36, 0.22), rgba(245, 158, 11, 0.1)); border: 1px solid rgba(251, 191, 36, 0.55); color: #FDE047; font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; margin: 6px auto 8px; box-shadow: 0 2px 10px rgba(251, 191, 36, 0.2); }
      .b-champ-crown-icon { font-size: 11px; line-height: 1; }
      .b-champ-pill.pending-pill { background: rgba(30, 41, 59, 0.6); border-color: rgba(71, 85, 105, 0.5); color: #94a3b8; box-shadow: none; }
      .b-champ-name { font-size: 21px; font-weight: 800; letter-spacing: -0.02em; color: #FFFFFF; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5); margin-top: 4px; line-height: 1.25; word-break: break-word; }
      .b-champ-sub { font-size: 12px; color: #94a3b8; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 6px; }
      .b-champ-event { color: #cbd5e1; font-weight: 600; }
      .b-champ-dot { color: #64748b; }
      .b-champ-status { color: #fbbf24; font-weight: 700; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; }
      .bracket-action-hint { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 9px; background: rgba(56, 189, 248, 0.06); border: 1px solid rgba(56, 189, 248, 0.25); font-size: 12.5px; color: #94a3b8; margin-top: 16px; }
    `;
    document.head.appendChild(style);
  }

  /* ---------------------------------------------------- team detail box in match card */
  function teamRow(m, side, canManage) {
    const team = side === 1 ? m.team1 : m.team2;
    const completed = m.status === 'COMPLETED';
    const isWinner = completed && team && m.winner_id === team.id;
    const isLoser = completed && team && m.winner_id !== team.id;
    const isReady = m.status === 'READY';
    const canPick = canManage && isReady && team;

    if (!team) {
      const src = side === 1 ? m.source1 : m.source2;
      return `
        <div class="b-team-box is-tbd" data-side="${side}">
          <div class="b-team-left">
            <span class="avatar xs sq b-tbd-av">?</span>
            <div class="b-team-info">
              <span class="b-team-name tbd-text">TBD</span>
              <span class="b-team-sub">${src ? `Winner of Match #${src}` : 'Awaiting match result'}</span>
            </div>
          </div>
          <div class="b-team-cell">
            <span class="b-cell-empty">—</span>
          </div>
        </div>`;
    }

    let cellHtml;
    if (isWinner) {
      cellHtml = `<span class="b-winner-badge" title="Winner">${UI.icon('trophy', 'w-3.5 h-3.5')} <b>WIN</b></span>`;
    } else if (isLoser) {
      cellHtml = `<span class="b-loser-tag" title="Eliminated">OUT</span>`;
    } else if (canPick) {
      cellHtml = `<button class="b-select-btn" data-select="${side}" data-match-id="${m.id}" aria-label="Select ${UI.esc(team.name)} as winner">Select</button>`;
    } else {
      cellHtml = `<span class="b-cell-empty">${completed ? '—' : ''}</span>`;
    }

    const subDetail = team.member_count
      ? `${team.member_count} member${team.member_count === 1 ? '' : 's'}${team.tag ? ` · ${UI.esc(team.tag)}` : ''}`
      : (team.tag ? `${UI.esc(team.tag)}` : (team.seed ? `Seed #${team.seed}` : ''));

    return `
      <div class="b-team-box ${isWinner ? 'is-winner' : ''} ${isLoser ? 'is-loser' : ''} ${canPick ? 'can-pick' : ''}"
           data-side="${side}" data-match-id="${m.id}"
           ${canPick ? `title="Click to select ${UI.esc(team.name)} as winner"` : ''}>
        <div class="b-team-left">
          ${UI.avatar(team.name, { size: 'xs', square: true })}
          <div class="b-team-info">
            <div class="b-team-title-row">
              <span class="b-team-name" title="${UI.esc(team.name)}">${UI.esc(team.name)}</span>
              ${team.seed ? `<span class="b-seed-tag">#${team.seed}</span>` : ''}
            </div>
            ${subDetail ? `<span class="b-team-sub">${subDetail}</span>` : ''}
          </div>
        </div>
        <div class="b-team-cell">
          ${cellHtml}
        </div>
      </div>`;
  }

  /* ----------------------------------------------------------------- match box */
  function matchCard(m, canManage) {
    const st = effStatus(m);
    const cls = st === 'READY' ? 'is-ready' : st === 'COMPLETED' ? 'is-completed' : st === 'WAITING' ? 'is-waiting' : 'is-pending';
    const roundTitle = m.round_name || (m.round_number === 1 ? 'Round 1' : `Round ${m.round_number}`);

    return `
      <div class="b-match-unit" data-match-id="${m.id}" data-number="${m.number}">
        <div class="b-match-meta">
          <span class="b-match-num">${UI.esc(roundTitle)} · Match #${m.number}</span>
          ${st && st !== 'READY' ? UI.matchBadge(st) : ''}
        </div>
        <article class="b-match-card ${cls}">
          <div class="b-team-boxes-wrap">
            ${teamRow(m, 1, canManage)}
            <div class="b-vs-divider">
              <span class="b-vs-label">VS</span>
            </div>
            ${teamRow(m, 2, canManage)}
          </div>
        </article>
      </div>`;
  }

  /* ------------------------------------------------------------- champion card */
  function championColumn(t, champion) {
    if (champion) {
      return `
        <div class="b-champ-col">
          <span class="b-bracket-wire-in b-wire-live b-wire-champ"></span>
          <div class="b-champ-card crowned">
            <div class="b-champ-trophy-wrap">
              <div class="b-champ-aura"></div>
              <div class="b-champ-trophy">🏆</div>
            </div>
            <div class="b-champ-pill">
              <span class="b-champ-crown-icon">👑</span>
              <span>TOURNAMENT CHAMPION</span>
            </div>
            <div class="b-champ-name">${UI.esc(champion.name)}</div>
            <div class="b-champ-sub">
              <span class="b-champ-event">${UI.esc(t.name)}</span>
              <span class="b-champ-dot">·</span>
              <span class="b-champ-status">Winner</span>
            </div>
          </div>
        </div>`;
    }
    return `
      <div class="b-champ-col">
        <span class="b-bracket-wire-in"></span>
        <div class="b-champ-card pending">
          <div class="b-champ-trophy-wrap">
            <div class="b-champ-trophy">🏆</div>
          </div>
          <div class="b-champ-pill pending-pill">
            <span>CHAMPION</span>
          </div>
          <div class="b-champ-name">To be decided</div>
          <div class="b-champ-sub">Winner of Final</div>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------- main render */
  function render(container, data, opts = {}) {
    ensureStyles();
    const { tournament: t, rounds, champion } = data;
    const canManage = !!opts.canManage;

    const hasMatches = rounds && rounds.some(r => r.matches && r.matches.length);
    if (!hasMatches) {
      container.innerHTML = UI.emptyState({
        icon: 'gitBranch',
        title: 'No matches available yet',
        message: t.status === 'REGISTRATION_OPEN'
          ? `The bracket is generated automatically the moment registration reaches capacity (${t.registered_count}/${t.capacity} teams registered).`
          : 'Matches will appear here once the bracket has been generated.',
      });
      return;
    }

    const totalRounds = rounds.length;
    // Calculate max matches across all rounds to scale column min-height dynamically for any even number of teams
    const maxMatches = Math.max(...rounds.map(r => (r.matches ? r.matches.length : 0)), 1);
    const UNIT_HEIGHT = 230; // comfortable height per match slot preventing any overlap
    const colMinHeight = Math.max(maxMatches * UNIT_HEIGHT, 460);

    container.innerHTML = `
      <div class="bracket-scroll" tabindex="0" aria-label="Tournament bracket — horizontal knockout progression">
        <div class="bracket bracket-container">
          ${rounds.map((r, ri) => {
            const isLast = ri === totalRounds - 1;
            const matchesCount = r.matches.length;

            return `
              <div class="b-round-col" data-round="${r.number}">
                <div class="b-col-header">
                  <div class="b-col-title">${UI.icon('sword', 'w-3.5 h-3.5')} ${UI.esc(r.name)}</div>
                  <div class="b-col-sub">${matchesCount} match${matchesCount === 1 ? '' : 'es'}</div>
                </div>
                <div class="b-col-matches" style="min-height:${colMinHeight}px">
                  ${r.matches.map((m, mi) => {
                    const isEven = mi % 2 === 0;
                    const notFinal = !isLast;
                    const mCompleted = m.status === 'COMPLETED';
                    const isFinalCompleted = isLast && mCompleted;

                    const wireOut = `<span class="b-bracket-wire-out ${mCompleted ? 'b-wire-live' : ''} ${isFinalCompleted ? 'b-wire-final-lead' : ''}"></span>`;
                    const wireV = (notFinal && matchesCount > 1)
                      ? (isEven
                          ? `<span class="b-bracket-wire-v-down ${mCompleted ? 'b-wire-live' : ''}"></span>`
                          : `<span class="b-bracket-wire-v-up ${mCompleted ? 'b-wire-live' : ''}"></span>`)
                      : '';
                    const wireIn = (ri > 0) ? `<span class="b-bracket-wire-in ${m.team1 || m.team2 ? 'b-wire-live' : ''}"></span>` : '';

                    return `
                      <div class="b-match-slot" data-slot-for="${m.id}">
                        ${wireIn}
                        ${matchCard(m, canManage)}
                        ${wireOut}
                        ${wireV}
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}

          ${championColumn(t, champion)}
        </div>
      </div>

      ${canManage ? `
        <div class="bracket-action-hint">
          ${UI.icon('info', 'w-4 h-4 text-sky-400')}
          <span>Click <b class="text-sky-300 font-bold">Select</b> on any team in a <b class="text-sky-300 font-bold">READY</b> match to declare the winner and advance them to the next round.</span>
        </div>
      ` : ''}
    `;

    /* Click delegation */
    container.onclick = (e) => {
      const selBtn = e.target.closest('[data-select]');
      const teamBoxEl = e.target.closest('.b-team-box.can-pick, .b-team-row.can-pick');
      if (selBtn) {
        e.stopPropagation();
        const m = findMatch(data, selBtn.dataset.matchId);
        const team = selBtn.dataset.select === '1' ? m.team1 : m.team2;
        if (m && team) confirmWinner(m, team, data, opts);
      } else if (teamBoxEl) {
        e.stopPropagation();
        const m = findMatch(data, teamBoxEl.dataset.matchId);
        const team = teamBoxEl.dataset.side === '1' ? m.team1 : m.team2;
        if (m && team) confirmWinner(m, team, data, opts);
      }
    };

    UI.hydrateProgress(container);
  }

  const findMatch = (data, id) => {
    const targetId = parseInt(id, 10) || id;
    for (const r of data.rounds) {
      const m = r.matches.find(x => x.id === targetId || String(x.id) === String(id));
      if (m) return m;
    }
    return null;
  };

  /* ------------------------------------------------ match detail modal */
  function openMatchModal(m, data, opts) {
    if (m.status !== 'READY' || !opts.canManage) return;
    const t = data.tournament;
    const vsTeam = (team, side) => `
      <div class="vs-team">
        <div style="display:flex;justify-content:center">${UI.avatar(team.name, { size: 'lg', square: true })}</div>
        <div class="vt-name">${UI.esc(team.name)}</div>
        <div class="vt-sub">${team.seed ? `seed #${team.seed} · ` : ''}${team.member_count} members · captain @${UI.esc(team.captain ? team.captain.username : '—')}</div>
        <button class="btn btn-primary btn-block" style="margin-top:14px" data-pick="${side}">
          ${UI.icon('trophy')} Select ${UI.esc(team.name)} as Winner
        </button>
      </div>`;

    const modal = UI.modal({
      size: 'lg',
      title: `Match #${m.number} · ${m.round_name || 'Knockout Match'}`,
      subtitle: `${t.name} — declare the match winner`,
      body: `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap">
          <span class="chip">${UI.icon('calendar', 'w-3.5 h-3.5')} round ${m.round_number} of ${t.total_rounds}</span>
          ${m.next_match_id
            ? `<span class="chip">${UI.icon('arrowRight', 'w-3.5 h-3.5')} winner advances to Match #${m.next_match_number} (slot ${m.next_match_slot})</span>`
            : `<span class="chip" style="color:var(--warn);border-color:rgba(251,191,36,.4)">${UI.icon('trophy', 'w-3.5 h-3.5')} winner becomes tournament champion</span>`}
        </div>
        <div class="vs-panel">
          ${m.team1 ? vsTeam(m.team1, 1) : '<div class="vs-team"><div class="vt-name">TBD</div></div>'}
          <div class="vs-mid">VS</div>
          ${m.team2 ? vsTeam(m.team2, 2) : '<div class="vs-team"><div class="vt-name">TBD</div></div>'}
        </div>
        <div class="warn-strip" style="margin-top:16px">
          ${UI.icon('database')}
          <span>Selecting a winner executes an <b>atomic transaction</b> advancing the team to the next round.</span>
        </div>`,
    });

    modal.el.querySelectorAll('[data-pick]').forEach(btn => btn.addEventListener('click', () => {
      const team = btn.dataset.pick === '1' ? m.team1 : m.team2;
      confirmWinner(m, team, data, opts, modal);
    }));
  }

  /* ------------------------------------------- confirm + propagate flow */
  function confirmWinner(m, team, data, opts, parentModal) {
    const oppTeam = m.team1 && m.team2 ? (m.team1.id === team.id ? m.team2 : m.team1) : null;
    UI.confirmDialog({
      title: `Declare ${team.name} as winner?`,
      message: `Match #${m.number} · ${m.round_name || ''} — ${team.name} defeats ${oppTeam ? oppTeam.name : 'their opponent'}.`,
      warning: 'This action will complete the match and advance the winner to the next round.',
      confirmLabel: 'Confirm & Advance Winner',
      onConfirm: async () => {
        const pageCard = document.querySelector(`.bracket [data-match-id="${m.id}"]`);
        const srcRect = pageCard ? pageCard.getBoundingClientRect() : null;

        const res = await API.selectWinner(m.id, team.id);

        parentModal && parentModal.close();
        document.querySelectorAll('.modal-wrap').forEach(w => w.remove());
        document.body.style.overflow = '';

        if (opts.onWinner) await opts.onWinner(res);

        requestAnimationFrame(() => setTimeout(() => {
          if (res.next_match) {
            const targetCard = document.querySelector(`.bracket [data-match-id="${res.next_match.id}"]`);
            if (targetCard && srcRect) UI.flyChip(srcRect, targetCard.getBoundingClientRect(), `${team.name} advances`);
            if (targetCard) {
              targetCard.classList.add('pulse-target');
              setTimeout(() => targetCard.classList.remove('pulse-target'), 3000);
            }
            UI.toast({
              type: 'success',
              title: `${team.name} wins Match #${m.number}`,
              message: `Advanced to Match #${res.next_match.number} (${res.next_match.round_name || 'Next Round'}).`,
              duration: 5200,
            });
          } else if (res.champion_declared) {
            UI.confetti(90);
            UI.toast({
              type: 'success',
              title: `🏆 ${team.name} is the Champion!`,
              message: `${data.tournament.name} completed successfully!`,
              duration: 7000,
            });
          }
        }, 80));
        return false;
      },
    });
  }

  /* ------------------------------------- client-side PREVIEW generator */
  function generatePreview(capacity) {
    capacity = Number(capacity) || 4;
    let p = 1;
    while (p < capacity) p *= 2;
    const roundsN = Math.max(1, Math.round(Math.log2(p)));
    const names = ROUND_NAMES[roundsN] || Array.from({ length: roundsN }, (_, i) => `Round ${i + 1}`);
    const rounds = [];
    let number = 0;
    for (let r = 0; r < roundsN; r++) {
      const count = Math.max(1, Math.floor(p / Math.pow(2, r + 1)));
      const matches = [];
      for (let i = 0; i < count; i++) {
        number += 1;
        matches.push({
          id: `pv_${r}_${i}`, number, round_number: r + 1, round_name: names[r] || `Round ${r + 1}`,
          abbr: ABBR[names[r]] || `R${r + 1}`, team1: null, team2: null, winner_id: null,
          status: 'PENDING', next_match_id: r < roundsN - 1 ? `pv_${r + 1}_${Math.floor(i / 2)}` : null,
          next_match_number: r < roundsN - 1 ? Math.round((p - Math.pow(2, r + 1) + 1) + Math.floor(i / 2)) : null,
          next_match_round: r < roundsN - 1 ? names[r + 1] : null,
          next_match_slot: (i % 2) + 1,
          source1: r > 0 ? number - count * 2 + (i * 2) - 1 : null,
          source2: r > 0 ? number - count * 2 + (i * 2) : null,
        });
      }
      rounds.push({ number: r + 1, name: names[r] || `Round ${r + 1}`, matches });
    }
    rounds.forEach((r, ri) => {
      if (ri === 0) return;
      r.matches.forEach((m, mi) => {
        const prev = rounds[ri - 1].matches;
        m.source1 = prev[mi * 2] ? prev[mi * 2].number : null;
        m.source2 = prev[mi * 2 + 1] ? prev[mi * 2 + 1].number : null;
      });
    });
    return {
      tournament: { name: 'Live preview', capacity, status: 'REGISTRATION_OPEN', total_rounds: roundsN, registered_count: 0 },
      rounds, teams: {}, champion: null,
    };
  }

  return { render, openMatchModal, confirmWinner, generatePreview, ROUND_NAMES, effStatus };
})();
