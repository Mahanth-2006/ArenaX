/* ==========================================================================
   ArenaX · api.js — CENTRALIZED API SERVICE LAYER
   --------------------------------------------------------------------------
   The ONLY module that performs network I/O. Every page/component calls
   these functions; no fetch() is scattered anywhere else.

   ┌─────────────────────────────────────────────────────────────────────┐
   │ GOING LIVE WITH THE FASTAPI BACKEND                                 │
   │  1. Start the backend so it serves  http://localhost:8000/api       │
   │  2. Set USE_MOCK = false below (or open any page with ?mock=0,      │
   │     or run  localStorage.setItem('aremax.mock','0')  )              │
   │  Nothing else changes — the mock server implements the exact same   │
   │  routes, payload shapes and HTTP error contract as FastAPI will.    │
   └─────────────────────────────────────────────────────────────────────┘

   Error contract (both mock & real):
     non-2xx → throws ApiError { status, code, message, fields, url }
     e.g. 409 DUPLICATE_REGISTRATION, 409 CAPACITY_REACHED,
          422 INVALID_CAPACITY, 409 MATCH_NOT_READY …
   ========================================================================== */
'use strict';

/* ---- configuration ------------------------------------------------------ */
const API_BASE_URL = (typeof window !== 'undefined' && window.location)
  ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? (window.location.port === '8000' ? `${window.location.origin}/api` : `http://${window.location.hostname}:8000/api`)
      : `${window.location.origin}/api`)
  : 'http://localhost:8000/api';

/* Live FastAPI mode only — no demo/mock backend */
const USE_MOCK = false;
try {
  localStorage.removeItem('arenax.mock');
  localStorage.removeItem('aremax.mock');
} catch {}

/* Helper to reliably read token across all scopes and storage aliases */
function getAuthToken() {
  try {
    if (typeof Auth !== 'undefined' && typeof Auth.token === 'function') {
      const t = Auth.token();
      if (t) return t;
    }
  } catch {}
  try {
    if (typeof window !== 'undefined' && window.Auth && typeof window.Auth.token === 'function') {
      const t = window.Auth.token();
      if (t) return t;
    }
  } catch {}
  try {
    const raw = localStorage.getItem('arenax.session') || sessionStorage.getItem('arenax.session') ||
                localStorage.getItem('aremax.session') || sessionStorage.getItem('aremax.session');
    if (!raw) return null;
    const s = JSON.parse(raw);
    return (s && s.token) ? s.token : null;
  } catch {
    return null;
  }
}

/* ---- error type ---------------------------------------------------------- */
class ApiError extends Error {
  constructor({ status, code, message, fields, url }) {
    super(message || `Request failed (${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.code = code || 'ERROR';
    this.fields = fields || null;
    this.url = url;
  }
}

/* Friendly copy for the constraint violations the backend can return.
   Pages may use the raw code too — this map keeps messaging consistent. */
const ERROR_COPY = {
  INVALID_CREDENTIALS: 'Invalid username or password.',
  ROLE_MISMATCH: null, // server message is already specific
  UNAUTHORIZED: 'Your session expired. Please sign in again.',
  ADMIN_ONLY: 'Administrator permissions required.',
  NOT_CAPTAIN: 'Only the team captain can perform this action.',
  DUPLICATE_REGISTRATION: 'This team is already registered for this tournament.',
  CAPACITY_REACHED: 'This tournament has reached its maximum capacity.',
  REGISTRATION_CLOSED: 'Registration is closed for this tournament.',
  TEAM_FULL: 'Team roster is full (max 5 members).',
  USER_HAS_TEAM: 'That player already belongs to a team.',
  ALREADY_IN_TEAM: 'You already belong to a team.',
  CANNOT_REMOVE_CAPTAIN: 'The captain cannot be removed from the roster.',
  MATCH_NOT_READY: null,
  ALREADY_COMPLETED: null,
  INVALID_WINNER: 'The winner must be one of the two participating teams.',
  INVALID_CAPACITY: 'Tournament capacity must be 4, 8 or 16.',
  NETWORK_ERROR: 'Cannot reach the ArenaX server. Is the backend running?',
};

/* ---- core request -------------------------------------------------------- */
async function request(method, path, { body, query } = {}) {
  let url = path;
  if (query) {
    const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ''));
    if ([...qs].length) url += `?${qs}`;
  }

  /* do not send stale Authorization header to public auth endpoints */
  const isAuthEndpoint = url.startsWith('/auth/login') || url.startsWith('/auth/register');
  const token = !isAuthEndpoint ? getAuthToken() : null;

  try {
    const resp = await fetch(API_BASE_URL + url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
      if (resp.status === 401 && !isAuthEndpoint && url.startsWith('/auth/me')) {
        try {
          if (typeof Auth !== 'undefined' && typeof Auth.clearSession === 'function') Auth.clearSession();
          else if (window.Auth && typeof window.Auth.clearSession === 'function') window.Auth.clearSession();
        } catch {}
      }
      const e = (data && (data.error || data.detail || data)) || {};
      throw new ApiError({
        status: resp.status, code: e.code, fields: e.fields,
        message: friendly(e.code, typeof e.message === 'string' ? e.message : null) || `Request failed (${resp.status})`,
        url: API_BASE_URL + url,
      });
    }
    return data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError({ status: 0, code: 'NETWORK_ERROR', message: friendly('NETWORK_ERROR'), url: API_BASE_URL + url });
  }
}

function friendly(code, fallback) {
  if (code && code in ERROR_COPY && ERROR_COPY[code] !== null) return ERROR_COPY[code];
  return fallback || (code ? String(code).replaceAll('_', ' ').toLowerCase() : null);
}

/* ==========================================================================
   ENDPOINT FUNCTIONS  (name → future REST route)
   ========================================================================== */
const API = {
  /* ---- auth ---------------------------------------------------------- */
  /** POST /auth/login → { token, user } */
  login: (creds) => request('POST', '/auth/login', { body: creds }),
  /** POST /auth/register → { token, user } */
  register: (payload) => request('POST', '/auth/register', { body: payload }),
  /** GET /auth/me → { user, team } */
  getCurrentUser: () => request('GET', '/auth/me'),

  /* ---- notifications -------------------------------------------------- */
  getNotifications: () => request('GET', '/notifications'),
  markNotificationsRead: () => request('POST', '/notifications/read'),

  /* ---- teams ------------------------------------------------------------ */
  /** GET /teams/mine → { team, is_captain } */
  getMyTeam: () => request('GET', '/teams/mine'),
  /** GET /teams/:id */
  getTeam: (id) => request('GET', `/teams/${id}`),
  /** GET /teams — all teams with roster summaries (admin tables) */
  getTeams: (query) => request('GET', '/teams', { query }),
  /** POST /teams → { team, is_captain } */
  createTeam: (payload) => request('POST', '/teams', { body: payload }),
  /** POST /teams/:id/members */
  addTeamMember: (teamId, identifier) => {
    const isNum = typeof identifier === 'number' || (typeof identifier === 'string' && /^\d+$/.test(identifier.trim()));
    const body = isNum ? { user_id: parseInt(identifier, 10) } : { username: String(identifier).trim() };
    return request('POST', `/teams/${teamId}/members`, { body });
  },
  /** DELETE /teams/:id/members/:userId */
  removeTeamMember: (teamId, userId) => request('DELETE', `/teams/${teamId}/members/${userId}`),
  /** GET /users?available=1&search= — players without a team (for roster adds) */
  searchAvailablePlayers: (search = '') => request('GET', '/users', { query: { available: 1, search } }),
  /** GET /users (admin) */
  getUsers: (search = '') => request('GET', '/users', { query: { search } }),

  /* ---- tournaments ------------------------------------------------------- */
  /** GET /tournaments?status=&search= */
  getTournaments: (query) => request('GET', '/tournaments', { query }),
  /** GET /tournaments/:id → { tournament, registrations, viewer_role } */
  getTournament: (id) => request('GET', `/tournaments/${id}`),
  /** POST /tournaments (admin) */
  createTournament: (payload) => request('POST', '/tournaments', { body: payload }),
  /** POST /tournaments/:id/register → { tournament, seed, locked } */
  registerTeam: (tournamentId, teamId) => request('POST', `/tournaments/${id_fix(tournamentId)}/register`, { body: { team_id: teamId } }),
  /** DELETE /tournaments/:id (admin) */
  deleteTournament: (tournamentId) => request('DELETE', `/tournaments/${id_fix(tournamentId)}`),

  /* ---- matches / bracket -------------------------------------------------- */
  /** GET /tournaments/:id/matches */
  getMatches: (tournamentId) => request('GET', `/tournaments/${id_fix(tournamentId)}/matches`),
  /** GET /tournaments/:id/bracket → { tournament, rounds, teams, champion } */
  getBracket: (tournamentId) => request('GET', `/tournaments/${id_fix(tournamentId)}/bracket`),
  /** GET /matches?status=&tournament_id= (admin) */
  getAllMatches: (query) => request('GET', '/matches', { query }),
  /** POST /matches/:id/winner → { match, next_match, tournament, champion_declared } */
  selectWinner: (matchId, teamId) => request('POST', `/matches/${matchId}/winner`, { body: { team_id: teamId } }),

  /* ---- stats & schema (DB-aware UI) --------------------------------------- */
  /** GET /stats/me → player dashboard numbers */
  getMyStats: () => request('GET', '/stats/me'),
  /** GET /admin/stats */
  getAdminStats: () => request('GET', '/admin/stats'),
  /** GET /admin/schema → { tables:[{name,rows}], tx:[…] } for the Database Lens */
  getSchema: () => request('GET', '/admin/schema'),
  /** GET /admin/tx?limit= */
  getTransactionLog: (limit = 12) => request('GET', '/admin/tx', { query: { limit } }),
};

/* tolerate the bracket-demo alias id */
function id_fix(id) { return encodeURIComponent(id); }

if (typeof window !== 'undefined') {
  window.API = API;
}
