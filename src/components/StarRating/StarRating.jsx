import "./StarRating.css";
export default function StarRating({ value = 0, outOf = 5 }) {
  const full = Math.max(0, Math.min(outOf, Math.round(value)));
  return (
    <div
      className="stars"
      role="img"
      aria-label={`${full} out of ${outOf} stars`}
    >
      {"★".repeat(full)}
      {"☆".repeat(outOf - full)}
    </div>
  );
}
