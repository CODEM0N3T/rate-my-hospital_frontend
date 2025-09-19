import "./Preloader.css";

export default function Preloader({
  label = "Searching for hospital…",
  full = false,
}) {
  return (
    <div
      className={`preloader ${full ? "preloader--full" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className="preloader__spinner" />
      <span className="preloader__text">{label}</span>
    </div>
  );
}
