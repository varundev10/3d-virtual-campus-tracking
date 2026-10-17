const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

let authToken = null;
let unauthorizedHandler = null;

export function setAuthToken(token) {
  authToken = token;
}

// Called when a request made with a token comes back 401 (expired, revoked or deactivated).
export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

export class ApiError extends Error {
  constructor(message, status, fieldErrors = {}) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function request(path, options = {}) {
  const sentToken = authToken;
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(sentToken ? { Authorization: `Bearer ${sentToken}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(
      navigator.onLine === false
        ? 'You appear to be offline. Reconnect to the network and try again.'
        : 'Cannot reach the campus server. Check that the backend is running.',
      0,
    );
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    let fieldErrors = {};
    try {
      const body = await response.json();
      if (body?.message) message = body.message;
      if (body?.errors) fieldErrors = body.errors;
    } catch {
      // Non-JSON error body; keep the generic message.
    }
    if (response.status === 401 && sentToken) unauthorizedHandler?.();
    throw new ApiError(message, response.status, fieldErrors);
  }

  if (response.status === 204) return null;
  return response.json();
}

function query(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

const json = (method, body) => ({ method, body: JSON.stringify(body) });

export const api = {
  baseUrl: API_BASE_URL,

  // ---- Authentication ----
  login(email, password) {
    return request('/api/auth/login', json('POST', { email, password }));
  },

  register(user) {
    return request('/api/auth/register', json('POST', user));
  },

  me() {
    return request('/api/auth/me');
  },

  updateMe(profile) {
    return request('/api/auth/me', json('PATCH', profile));
  },

  changePassword(currentPassword, newPassword) {
    return request('/api/auth/password', json('PUT', { currentPassword, newPassword }));
  },

  // ---- Users (list/create/update are admin only on the server) ----
  getUsers(filters = {}) {
    return request(`/api/users${query(filters)}`);
  },

  getUser(id) {
    return request(`/api/users/${id}`);
  },

  createUser(user) {
    return request('/api/users', json('POST', user));
  },

  updateUser(id, changes) {
    return request(`/api/users/${id}`, json('PATCH', changes));
  },

  setUserPassword(id, password) {
    return request(`/api/users/${id}/password`, json('PUT', { password }));
  },

  // ---- Location pings ----
  postLocation(location) {
    return request('/api/locations', json('POST', location));
  },

  getRecentLocations(userId) {
    return request(`/api/locations/${userId}/recent`);
  },

  // ---- Attendance ----
  markAttendance(status, userId, classroomId) {
    const endpoint = status === 'BUNKED' ? 'bunk' : 'present';
    const params = new URLSearchParams({
      userId: String(userId),
      classroomId,
    });

    return request(`/api/attendance/${endpoint}?${params.toString()}`, {
      method: 'POST',
    });
  },

  getAttendance(userId) {
    return request(`/api/attendance/${userId}`);
  },

  // ---- Campus locations (writes are admin only on the server) ----
  getCampusLocations() {
    return request('/api/campus-locations');
  },

  createCampusLocation(location) {
    return request('/api/campus-locations', json('POST', location));
  },

  updateCampusLocation(id, location) {
    return request(`/api/campus-locations/${id}`, json('PUT', location));
  },

  deleteCampusLocation(id) {
    return request(`/api/campus-locations/${id}`, { method: 'DELETE' });
  },

  // ---- Admin ----
  getAdminStats() {
    return request('/api/admin/stats');
  },

  getLatestPositions(windowMinutes) {
    return request(`/api/admin/tracking/latest${query({ windowMinutes })}`);
  },

  getPings(filters = {}) {
    return request(`/api/admin/pings${query(filters)}`);
  },

  getAttendanceRecords(filters = {}) {
    return request(`/api/admin/attendance${query(filters)}`);
  },

  getAlerts(filters = {}) {
    return request(`/api/admin/alerts${query(filters)}`);
  },

  getActivityReport(range = {}) {
    return request(`/api/admin/reports/activity${query(range)}`);
  },
};
