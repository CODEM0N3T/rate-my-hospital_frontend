import { createPortal } from "react-dom";
import "./ModalWithForm.css";

export default function ModalWithForm({
  title,
  onClose,
  onSubmit,
  submitLabel = "Submit",
  children,
}) {
  return createPortal(
    <div className="modal">
      <div className="modal__backdrop" onClick={onClose} aria-hidden="true" />
      <form
        className="modal__panel"
        role="dialog"
        aria-modal="true"
        onSubmit={onSubmit}
      >
        <div className="modal__header">
          <h2 className="modal__title">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            className="modal__close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="modal__body">{children}</div>
        <div className="modal__footer">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button--primary">
            {submitLabel}
          </button>{" "}
          {/* ← primary */}
        </div>
      </form>
    </div>,
    document.body
  );
}
