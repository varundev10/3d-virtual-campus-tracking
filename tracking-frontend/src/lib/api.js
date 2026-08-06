const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

let authToken = null;
let onUnauthorized = null;

export function setAuthToken(token) {
  authToken = token;
}

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options.headers,
    },
    ...options,
  });

  if (response.status === 401) {
    onUnauthorized?.();
    throw new Error('Session expired, please sign in again');
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  baseUrl: API_BASE_URL,

  login(email, password) {
    return request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  getMe() {
    return request('/api/users/me');
  },

  getUsers() {
    return request('/api/users');
  },

  createUser(user) {
    return request('/api/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  },

  getClassrooms() {
    return request('/api/classrooms');
  },

  getAlerts() {
    return request('/api/alerts');
  },

  postLocation(location) {
    return request('/api/locations', {
      method: 'POST',
      body: JSON.stringify(location),
    });
  },

  getRecentLocations(userId) {
    return request(`/api/locations/${userId}/recent`);
  },

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
};
