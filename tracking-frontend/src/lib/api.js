const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  baseUrl: API_BASE_URL,

  getUsers() {
    return request('/api/users');
  },

  createUser(user) {
    return request('/api/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
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
