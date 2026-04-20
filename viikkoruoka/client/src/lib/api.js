import { auth } from './auth.js';

const BASE = '/api';

// Listeners notified when the server tells us the token is bad/expired.
const unauthorizedListeners = new Set();
export function onUnauthorized(fn) {
  unauthorizedListeners.add(fn);
  return () => unauthorizedListeners.delete(fn);
}

async function req(method, path, body) {
  const headers = body ? { 'Content-Type': 'application/json' } : {};
  const token = auth.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    auth.clear();
    unauthorizedListeners.forEach((fn) => { try { fn(); } catch { /* noop */ } });
    const err = await res.json().catch(() => ({ error: 'Not authenticated' }));
    throw new Error(err.error || 'Not authenticated');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  // Auth
  login:            (username, password) => req('POST', '/auth/login', { username, password }),
  me:               ()           => req('GET',    '/auth/me'),

  // Pantry
  getCategories:    ()           => req('GET',    '/pantry/categories'),
  addCategory:      (data)       => req('POST',   '/pantry/categories', data),
  deleteCategory:   (id)         => req('DELETE', `/pantry/categories/${id}`),
  addItem:          (data)       => req('POST',   '/pantry/items', data),
  updateItem:       (id, data)   => req('PATCH',  `/pantry/items/${id}`, data),
  deleteItem:       (id)         => req('DELETE', `/pantry/items/${id}`),

  // Recipes
  getRecipes:       ()           => req('GET',    '/recipes'),
  addRecipe:        (data)       => req('POST',   '/recipes', data),
  updateRecipe:     (id, data)   => req('PUT',    `/recipes/${id}`, data),
  patchRecipe:      (id, data)   => req('PATCH',  `/recipes/${id}`, data),
  deleteRecipe:     (id)         => req('DELETE', `/recipes/${id}`),
  patchIngredient:  (recipeId, ingId, data) =>
    req('PATCH', `/recipes/${recipeId}/ingredients/${ingId}`, data),

  // Shopping
  getShopping:      ()           => req('GET',    '/shopping'),
};
