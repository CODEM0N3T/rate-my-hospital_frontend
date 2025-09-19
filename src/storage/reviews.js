const KEY = "rmh_reviews";

export function loadReviews(providerId) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY)) || {};
    return all[providerId] || [];
  } catch {
    return [];
  }
}

export function saveReview(providerId, review) {
  const all = JSON.parse(localStorage.getItem(KEY)) || {};
  const list = all[providerId] || [];
  all[providerId] = [review, ...list];
  localStorage.setItem(KEY, JSON.stringify(all));
}
