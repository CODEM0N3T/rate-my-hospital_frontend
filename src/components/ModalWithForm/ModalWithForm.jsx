import { createPortal } from "react-dom";
import "./ModalWithForm.css";

export default function ModalWithForm({
  title,
  children,
  onClose,
  onSubmit,
  submitLabel = "Save",
  // NEW:
  secondaryLabel = "Cancel",
  onSecondary, // falls back to onClose if not provided
}) {
  const handleSecondary = onSecondary || onClose;

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="modal__backdrop" onClick={onClose} />
      <form className="modal__panel" onSubmit={onSubmit}>
        <div className="modal__header">
          <h2 id="modal-title" className="modal__title">
            {title}
          </h2>
          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="modal__body">{children}</div>

        <div className="modal__footer">
          <button
            type="button"
            className="button button--ghost"
            onClick={handleSecondary}
          >
            {secondaryLabel}
          </button>
          <button type="submit" className="button button--primary">
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
