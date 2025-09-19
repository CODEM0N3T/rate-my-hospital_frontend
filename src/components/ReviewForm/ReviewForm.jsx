import { useState } from "react";
import "./ReviewForm.css";

function aliasFor(role) {
  const words = [
    "Sky",
    "River",
    "Oak",
    "Sage",
    "Nova",
    "Harbor",
    "Echo",
    "Flint",
  ];
  const n = Math.floor(100 + Math.random() * 900);
  return `${role === "nurse" ? "Nurse" : "Staff"} ${
    words[Math.floor(Math.random() * words.length)]
  }-${n}`;
}

export default function ReviewForm({ onSubmit, onClose }) {
  const [role, setRole] = useState("nurse");
  const [overall, setOverall] = useState(5);
  const [comment, setComment] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    onSubmit({
      id: crypto?.randomUUID?.() || String(Date.now()),
      alias: aliasFor(role),
      role,
      ratings: { overall: Number(overall) },
      comment,
      createdAt: new Date().toISOString(),
    });
    onClose();
  }

  return (
    <div className="modal">
      <div className="modal__backdrop" onClick={onClose} aria-hidden="true" />
      <form
        className="modal__panel"
        role="dialog"
        aria-modal="true"
        onSubmit={submit}
      >
        <div className="modal__header">
          <h2 className="modal__title">Add anonymous review</h2>
          <button
            type="button"
            className="modal__close"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="modal__body">
          <label className="form__label">Role</label>
          <div className="form__row">
            <label className="chip">
              <input
                type="radio"
                name="role"
                value="nurse"
                checked={role === "nurse"}
                onChange={() => setRole("nurse")}
              />{" "}
              Nurse
            </label>
            <label className="chip">
              <input
                type="radio"
                name="role"
                value="staff"
                checked={role === "staff"}
                onChange={() => setRole("staff")}
              />{" "}
              Hospital Staff
            </label>
          </div>
          <label className="form__label" htmlFor="ov">
            Overall rating (1–5)
          </label>
          <input
            id="ov"
            className="input"
            type="number"
            min="1"
            max="5"
            value={overall}
            onChange={(e) => setOverall(e.target.value)}
          />
          <label className="form__label" htmlFor="c">
            Comment
          </label>
          <textarea
            id="c"
            className="input"
            rows="4"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience…"
          />
        </div>
        <div className="modal__footer">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button">
            Submit
          </button>
        </div>
      </form>
    </div>
  );
}
