import "./ReviewList.css";

export default function ReviewList({ items = [] }) {
  if (!items.length) return <p className="reviews__empty">No reviews yet.</p>;
  return (
    <ul className="reviews">
      {items.map((r) => (
        <li key={r.id} className="reviews__item">
          <div className="reviews__head">
            <strong>{r.alias}</strong>
            <span className="reviews__meta">
              {new Date(r.createdAt).toLocaleDateString()}
            </span>
            <span className="reviews__rating">
              {"★".repeat(r.ratings.overall)}
            </span>
          </div>
          <p className="reviews__body">{r.comment}</p>
        </li>
      ))}
    </ul>
  );
}
