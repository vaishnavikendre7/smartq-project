// All calls to the backend go through this one function.
// The login session is an httpOnly cookie, so the browser sends it automatically (credentials: 'include').
const BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError('Cannot reach the server. Is the backend running?', 0);
  }
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('smartq-auth-expired'));
    throw new ApiError(data.message || 'Something went wrong.', res.status);
  }
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b || {}),
  put: (p, b) => request('PUT', p, b || {}),
  patch: (p, b) => request('PATCH', p, b || {}),
  del: (p) => request('DELETE', p)
};
