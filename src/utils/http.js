export const toJson = (res) =>
  res.ok ? res.json() : Promise.reject(`Error ${res.status}`);
