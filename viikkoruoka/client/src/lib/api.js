const BASE = '/api';

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
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
  deleteRecipe:     (id)         => req('DELETE', `/recipes/${id}`),

  // Shopping
  getShopping:      ()           => req('GET',    '/shopping'),
};
