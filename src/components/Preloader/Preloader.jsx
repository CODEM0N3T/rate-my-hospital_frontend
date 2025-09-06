import "./Preloader.css";
export default function Preloader({ label = "Loading…" }) {
  return (
    <div
      className="preloader"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className="preloader__spinner" />
      <span className="preloader__text">{label}</span>
    </div>
  );
}
