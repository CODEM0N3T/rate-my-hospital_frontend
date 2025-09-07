const USERS_KEY = "rmh_users";
const CURRENT_KEY = "rmh_user";

const loadAll = () => JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
const saveAll = (obj) => localStorage.setItem(USERS_KEY, JSON.stringify(obj));
const keyOf = (alias = "") => alias.trim().toLowerCase();

export function aliasExists(alias) {
  const all = loadAll();
  return Boolean(all[keyOf(alias)]);
}

export function upsertUser(user) {
  const all = loadAll();
  all[keyOf(user.alias)] = user; // store by lowercased alias
  saveAll(all);
}

export function getUserByAlias(alias) {
  const all = loadAll();
  return all[keyOf(alias)] || null;
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
