/**
 * Backend API-тай харилцах туслах.
 * Амжилттай бол JSON-ийг буцаана, алдаа гарвал ApiError шиднэ.
 */
export class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Нэвтрэх хуудас руу шилжүүлнэ, буцаж ирэх хаягийг хадгална */
export function goToLogin() {
  const next = window.location.pathname + window.location.search;
  window.location.href = `/login.html?next=${encodeURIComponent(next)}`;
}

async function request(method, url, body) {
  const options = { method, credentials: 'same-origin', headers: {} };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, options);
  } catch (err) {
    throw new ApiError(0, 'Сервертэй холбогдож чадсангүй. Интернэт холболтоо шалгана уу');
  }

  let data = {};
  try {
    data = await res.json();
  } catch (err) {
    data = {};
  }

  // Session дууссан бол нэвтрэх хуудас руу (нэвтрэх оролдлогоос бусад үед)
  if (res.status === 401 && !url.startsWith('/api/auth/login') && !url.startsWith('/api/auth/register')) {
    goToLogin();
  }
  if (!res.ok) throw new ApiError(res.status, data.error || 'Алдаа гарлаа. Дахин оролдоно уу', data.details || null);
  return data;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body = {}) => request('POST', url, body),
  put: (url, body = {}) => request('PUT', url, body),
  patch: (url, body = {}) => request('PATCH', url, body),
  del: (url) => request('DELETE', url),
};

/** Query string үүсгэнэ, хоосон утгыг алгасна */
export function qs(values) {
  const p = new URLSearchParams();
  Object.entries(values).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') p.set(k, v);
  });
  const text = p.toString();
  return text ? `?${text}` : '';
}
