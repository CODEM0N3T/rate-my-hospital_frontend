const USERS_KEY = "rmh_users";
const CURRENT_KEY = "rmh_user";

export function upsertUser(user) {
  const all = JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
  all[user.alias] = user; // keyed by alias (pseudonymous)
  localStorage.setItem(USERS_KEY, JSON.stringify(all));
}

export function getUserByAlias(alias) {
  const all = JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
  return all[alias] || null;
}

export function setCurrentUser(user) {
  localStorage.setItem(CURRENT_KEY, JSON.stringify(user));
}

export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(CURRENT_KEY)) || null;
  } catch {
    return null;
  }
}

export function clearCurrentUser() {
  localStorage.removeItem(CURRENT_KEY);
}
