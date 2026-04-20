// Tiny auth helper — token lives in localStorage so reloads keep the user in.
const KEY = 'viikko.token';

export const auth = {
  getToken() {
    try { return localStorage.getItem(KEY); } catch { return null; }
  },
  setToken(token) {
    try { localStorage.setItem(KEY, token); } catch { /* ignore */ }
  },
  clear() {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  },
  isLoggedIn() {
    return !!this.getToken();
  },
};
