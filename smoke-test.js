/* ArenaX mock-backend smoke test — exercises the full DBMS workflow.
   Run: node smoke-test.js  (from repo root) */
'use strict';
const { MockServer } = require('./frontend/js/mock.js');

let pass = 0, fail = 0;
const ok = (cond, msg) => { cond ? (pass++, console.log('  ✓ ' + msg)) : (fail++, console.error('  ✗ FAIL: ' + msg)); };
const call = (m, p, b, t) => MockServer.handle(m, p, b, { token: t });

(async () => {
  console.log('— auth & RBAC —');
  let r = await call('POST', '/auth/login', { username: 'admin', password: 'wrong', role: 'ADMIN' });
  ok(r.status === 401 && r.data.error.code === 'INVALID_CREDENTIALS', 'bad password → 401 INVALID_CREDENTIALS');
  r = await call('POST', '/auth/login', { username: 'admin', password: 'admin123', role: 'PLAYER' });
  ok(r.status === 403 && r.data.error.code === 'ROLE_MISMATCH', 'role mismatch → 403 ROLE_MISMATCH');
  r = await call('POST', '/auth/login', { username: 'admin', password: 'admin123', role: 'ADMIN' });
  ok(r.status === 200 && r.data.token, 'admin login → 200 + token');
  const adminTok = r.data.token;
  r = await call('GET', '/tournaments', null, null);
  ok(r.status === 401, 'no token → 401 UNAUTHORIZED');

  console.log('— seeded state —');
  r = await call('GET', '/tournaments', null, adminTok);
  ok(r.status === 200 && r.data.length === 4, '4 seeded tournaments');
  const campus = r.data.find(t => t.name === 'Campus Championship');
  ok(campus && campus.registered_count === 6 && campus.status === 'REGISTRATION_OPEN', 'Campus Championship 6/8 REGISTRATION_OPEN');
  const winter = r.data.find(t => t.name === 'Winter Showdown');
  ok(winter.status === 'IN_PROGRESS', 'Winter Showdown IN_PROGRESS');
  const arena = r.data.find(t => t.name === 'Arena Championship');
  ok(arena.status === 'COMPLETED' && arena.champion_team_name === 'Team Nova', 'Arena Championship COMPLETED · champion Team Nova');
  r = await call('GET', `/tournaments/${winter.id}/bracket`, null, adminTok);
  const wb = r.data;
  ok(wb.rounds[0].matches.every(m => m.status === 'COMPLETED'), 'Winter Showdown: all QF completed');
  ok(wb.rounds[1].matches[0].status === 'COMPLETED' && wb.rounds[1].matches[1].status === 'READY', 'SF1 completed, SF2 READY');
  ok(wb.rounds[2].matches[0].team1 && wb.rounds[2].matches[0].team1.name === 'Team Nova' && !wb.rounds[2].matches[0].team2, 'Final: Nova propagated into slot 1, slot 2 TBD');

  console.log('— create tournament (constraints) —');
  r = await call('POST', '/tournaments', { name: 'VIT Inter-College Championship', capacity: 6 }, adminTok);
  ok(r.status === 422 && r.data.error.fields.capacity, 'capacity 6 → 422 (CHECK capacity IN (4,8,16))');
  const alexR = await call('POST', '/auth/login', { username: 'alex', password: 'alex123', role: 'PLAYER' });
  const alexTok = alexR.data.token;
  r = await call('POST', '/tournaments', { name: 'X Cup', capacity: 8 }, alexTok);
  ok(r.status === 403 && r.data.error.code === 'ADMIN_ONLY', 'player creates tournament → 403');
  r = await call('POST', '/tournaments', { name: 'VIT Inter-College Championship', description: 'demo', capacity: 8 }, adminTok);
  ok(r.status === 201, 'admin creates 8-team tournament → 201');
  const tour = r.data.tournament;
  ok(tour.status === 'REGISTRATION_OPEN' && tour.registered_count === 0, 'new tournament REGISTRATION_OPEN 0/8');
  r = await call('POST', '/tournaments', { name: 'VIT Inter-College Championship', capacity: 4 }, adminTok);
  ok(r.status === 422 && r.data.error.fields.name, 'duplicate name → 422 UNIQUE');

  console.log('— registration → auto LOCK at capacity —');
  const captains = ['alex', 'ryan', 'kai', 'neo', 'juno', 'zane', 'elio', 'nyx'];
  const toks = {};
  for (const c of captains) { const rr = await call('POST', '/auth/login', { username: c, password: c + '123', role: 'PLAYER' }); toks[c] = rr.data.token; }
  const aaravR = await call('POST', '/auth/login', { username: 'aarav', password: 'aarav123', role: 'PLAYER' });
  r = await call('POST', `/tournaments/${tour.id}/register`, {}, aaravR.data.token);
  ok(r.status === 403 && r.data.error.code === 'NOT_CAPTAIN', 'non-captain registers → 403 NOT_CAPTAIN');
  let lockedAt = -1, seeds = [];
  for (let i = 0; i < captains.length; i++) {
    r = await call('POST', `/tournaments/${tour.id}/register`, {}, toks[captains[i]]);
    if (r.status !== 201) console.error('   ', JSON.stringify(r.data));
    ok(r.status === 201, `register #${i + 1} (${captains[i]}) → 201, seed ${r.data && r.data.seed}`);
    seeds.push(r.data && r.data.seed);
    if (r.data && r.data.locked) lockedAt = i;
  }
  ok(JSON.stringify(seeds) === JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8]), 'seeds assigned in registration order 1..8');
  ok(lockedAt === 7, '8th registration triggered auto-LOCK');
  r = await call('GET', `/tournaments/${tour.id}`, null, adminTok);
  ok(r.data.tournament.status === 'LOCKED' && r.data.tournament.registered_count === 8, 'tournament LOCKED 8/8');
  r = await call('POST', `/tournaments/${tour.id}/register`, {}, toks.alex);
  ok(r.status === 409 && r.data.error.code === 'REGISTRATION_CLOSED', 'register after LOCK → 409 REGISTRATION_CLOSED');

  console.log('— bracket generation —');
  r = await call('GET', `/tournaments/${tour.id}/bracket`, null, adminTok);
  const br = r.data;
  ok(br.rounds.length === 3, '3 rounds (QF/SF/F)');
  ok(br.rounds[0].matches.length === 4 && br.rounds[1].matches.length === 2 && br.rounds[2].matches.length === 1, '4 + 2 + 1 matches');
  const allM = br.rounds.flatMap(x => x.matches);
  ok(allM.length === 7, '7 matches = capacity − 1');
  ok(br.rounds[0].matches.every(m => m.status === 'READY'), 'round 1 all READY');
  ok(br.rounds[1].matches.every(m => m.status === 'PENDING' && !m.team1 && !m.team2), 'round 2 PENDING with TBD slots');
  ok(allM.filter(m => m.next_match_id).length === 6, '6 matches carry next_match_id (self-ref FK)');
  ok(br.rounds[2].matches[0].next_match_id === null, 'final has no next_match_id');
  const qf1 = br.rounds[0].matches[0];
  ok(qf1.team1.seed === 1 && qf1.team2.seed === 8, 'QF1 pairs seed #1 vs #8 (standard seeding)');
  ok(qf1.next_match_number === br.rounds[1].matches[0].number, 'QF1 next_match_number points at SF1');
  r = await call('GET', `/tournaments/${tour.id}/matches`, null, adminTok);
  ok(r.data.length === 7, 'GET /tournaments/:id/matches → 7 rows');

  console.log('— winner selection & propagation —');
  const sf1 = br.rounds[1].matches[0];
  r = await call('POST', `/matches/${sf1.id}/winner`, { team_id: qf1.team1.id }, adminTok);
  ok(r.status === 409 && r.data.error.code === 'MATCH_NOT_READY', 'winner on PENDING match → 409 MATCH_NOT_READY');
  const outsider = br.rounds[0].matches[1].team1.id;
  r = await call('POST', `/matches/${qf1.id}/winner`, { team_id: outsider }, adminTok);
  ok(r.status === 422 && r.data.error.code === 'INVALID_WINNER', 'non-participant winner → 422 INVALID_WINNER');
  r = await call('POST', `/matches/${qf1.id}/winner`, { team_id: qf1.team1.id }, toks.alex);
  ok(r.status === 403, 'player selects winner → 403 ADMIN_ONLY');
  r = await call('POST', `/matches/${qf1.id}/winner`, { team_id: qf1.team1.id }, adminTok);
  ok(r.status === 200 && r.data.match.status === 'COMPLETED', 'QF1 winner → match COMPLETED');
  ok(r.data.next_match && r.data.next_match.team1 && r.data.next_match.team1.id === qf1.team1.id, 'winner propagated into SF1 slot 1 via next_match_id');
  ok(r.data.next_match.source1 === qf1.number, 'SF1 knows its source match numbers');
  r = await call('GET', `/tournaments/${tour.id}`, null, adminTok);
  ok(r.data.tournament.status === 'IN_PROGRESS', 'tournament LOCKED → IN_PROGRESS on first result');
  r = await call('POST', `/matches/${qf1.id}/winner`, { team_id: qf1.team2.id }, adminTok);
  ok(r.status === 409 && r.data.error.code === 'ALREADY_COMPLETED', 're-declare winner → 409 ALREADY_COMPLETED');

  // QF2 winner should flip SF1 to READY once both slots filled
  const qf2 = br.rounds[0].matches[1];
  r = await call('POST', `/matches/${qf2.id}/winner`, { team_id: qf2.team1.id }, adminTok);
  ok(r.data.next_match.status === 'READY' && r.data.next_match.team2.id === qf2.team1.id, 'SF1 becomes READY when both winners arrive');

  // play out the rest (always team1)
  let guard = 0, champ = null;
  while (guard++ < 20) {
    r = await call('GET', `/tournaments/${tour.id}/bracket`, null, adminTok);
    if (r.data.tournament.status === 'COMPLETED') { champ = r.data.champion; break; }
    const ready = r.data.rounds.flatMap(x => x.matches).find(m => m.status === 'READY');
    if (!ready) { ok(false, 'stuck: no READY match but not COMPLETED'); break; }
    const rr = await call('POST', `/matches/${ready.id}/winner`, { team_id: (ready.team1 || ready.team2).id }, adminTok);
    if (rr.status !== 200) { ok(false, 'playthrough failed: ' + JSON.stringify(rr.data)); break; }
  }
  r = await call('GET', `/tournaments/${tour.id}`, null, adminTok);
  ok(r.data.tournament.status === 'COMPLETED', 'tournament COMPLETED after final');
  ok(champ && champ.name === 'Team Nova', 'champion = Team Nova (seed #1 path)');
  r = await call('GET', '/tournaments?status=COMPLETED', null, adminTok);
  ok(r.data.length === 2, 'history query → 2 COMPLETED tournaments');

  console.log('— teams & roster constraints —');
  r = await call('GET', '/teams/mine', null, alexTok);
  ok(r.data.team.name === 'Team Nova' && r.data.is_captain, 'alex → Team Nova captain');
  ok(r.data.team.member_count === 5 && r.data.team.members[0].role === 'CAPTAIN', 'Nova roster 5/5, captain first');
  r = await call('GET', '/users?available=1', null, alexTok);
  const gabe = r.data.find(u => u.username === 'gabe');
  ok(!!gabe, 'gabe listed as available free agent');
  const novaId = (await call('GET', '/teams/mine', null, alexTok)).data.team.id;
  r = await call('POST', `/teams/${novaId}/members`, { user_id: gabe.id }, toks.alex);
  ok(r.status === 422 && r.data.error.code === 'TEAM_FULL', 'add to full roster → 422 TEAM_FULL (CHECK ≤ 5)');
  r = await call('GET', '/teams/mine', null, toks.ryan);
  const falcons = r.data.team;
  ok(falcons.member_count === 4, 'Iron Falcons 4/5');
  r = await call('POST', `/teams/${falcons.id}/members`, { user_id: 'nope' }, toks.ryan);
  ok(r.status === 404, 'add unknown user → 404');
  r = await call('POST', `/teams/${falcons.id}/members`, { user_id: gabe.id }, toks.ryan);
  ok(r.status === 201 && r.data.team.member_count === 5, 'captain adds gabe → 5/5');
  r = await call('POST', `/teams/${falcons.id}/members`, { user_id: gabe.id }, toks.ryan);
  ok(r.status === 409 && r.data.error.code === 'USER_HAS_TEAM', 'second team for gabe → 409 UNIQUE(user_id)');
  r = await call('DELETE', `/teams/${falcons.id}/members/${falcons.captain_id}`, null, toks.ryan);
  ok(r.status === 422 && r.data.error.code === 'CANNOT_REMOVE_CAPTAIN', 'remove captain → 422 (FK teams.captain_id)');
  r = await call('POST', `/teams/${falcons.id}/members`, { user_id: gabe.id }, toks.neo);
  ok(r.status === 403 && r.data.error.code === 'NOT_CAPTAIN', 'non-captain manages roster → 403');
  r = await call('DELETE', `/teams/${falcons.id}/members/${gabe.id}`, null, toks.ryan);
  ok(r.status === 200 && r.data.team.member_count === 4, 'remove gabe → 4/5');
  r = await call('POST', '/teams', { name: 'Phoenix Rising' }, aaravR.data.token);
  ok(r.status === 409 && r.data.error.code === 'ALREADY_IN_TEAM', 'player already in a team → 409');

  console.log('— new team creation transaction —');
  r = await call('POST', '/auth/register', { username: 'newkid', email: 'newkid@x.com', password: 'secret1', role: 'PLAYER' });
  ok(r.status === 201 && r.data.token, 'register new player → 201 + token');
  const newTok = r.data.token;
  r = await call('POST', '/auth/register', { username: 'newkid', email: 'other@x.com', password: 'secret1', role: 'PLAYER' });
  ok(r.status === 422 && r.data.error.fields.username, 'duplicate username → 422 UNIQUE');
  r = await call('POST', '/teams', { name: 'Iron Falcons' }, newTok);
  ok(r.status === 409 && r.data.error.code === 'TEAM_NAME_TAKEN', 'duplicate team name → 409 UNIQUE(teams.name)');
  r = await call('POST', '/teams', { name: 'Phoenix Rising' }, newTok);
  ok(r.status === 201 && r.data.team.member_count === 1 && r.data.team.members[0].role === 'CAPTAIN', 'create team → captain auto-membership in same tx');
  r = await call('GET', '/auth/me', null, newTok);
  ok(r.data.user.username === 'newkid' && r.data.team.name === 'Phoenix Rising', '/auth/me returns user + team');

  console.log('— admin meta, stats, tx log —');
  r = await call('GET', '/admin/stats', null, adminTok);
  ok(r.data.total_users > 35 && r.data.total_teams >= 9 && r.data.completed_tournaments === 2, 'admin stats consistent');
  r = await call('GET', '/admin/stats', null, alexTok);
  ok(r.status === 403, 'player hits admin stats → 403');
  r = await call('GET', '/admin/schema', null, adminTok);
  const matchesRows = r.data.tables.find(t => t.name === 'matches').rows;
  ok(matchesRows >= 14 && r.data.tx.length > 0, `schema lens: matches rows=${matchesRows}, tx log populated`);
  const allTx = (await call('GET', '/admin/tx?limit=60', null, adminTok)).data;
  ok(allTx.some(t => t.name === 'select_winner' && t.status === 'COMMITTED'), 'select_winner COMMITTED in tx log');
  ok(allTx.some(t => t.name === 'register_team' && t.status === 'COMMITTED'), 'register_team recorded in tx log');
  ok(allTx.some(t => t.name === 'select_winner' && t.statements.some(s => s.includes('next_match_id'))), 'winner tx logs the next_match_id propagation statement');
  ok(allTx.some(t => t.name === 'register_team' && t.statements.some(s => s.includes("status='LOCKED'")) && t.statements.some(s => s.includes('INSERT INTO matches'))), '8th registration tx: LOCK + bracket INSERT in ONE transaction');
  r = await call('GET', '/stats/me', null, alexTok);
  ok(r.data.matches_played >= 1 && r.data.wins >= 1, 'player stats: matches played & wins counted');
  r = await call('GET', '/notifications', null, alexTok);
  ok(r.data.length > 0, 'notifications delivered to players');
  r = await call('GET', '/tournaments/latest', null, adminTok);
  ok(r.status === 200, '/tournaments/latest alias resolves');
  r = await call('GET', '/matches?status=READY', null, adminTok);
  ok(r.status === 200 && r.data.every(m => m.status === 'READY'), 'match queue filter works');

  console.log(`\n${fail === 0 ? '✅ ALL PASSED' : '❌ FAILURES'} — ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(1); });
