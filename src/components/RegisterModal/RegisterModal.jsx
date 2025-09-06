import { useEffect, useState } from "react";
import ModalWithForm from "../ModalWithForm/ModalWithForm.jsx";
import { makeAlias, makeRecoveryCode } from "../../utils/anon.js";
import { sha256Hex } from "../../utils/crypto.js";

export default function RegisterModal({ onSubmit, onClose }) {
  const [role, setRole] = useState("nurse");
  const [facility, setFacility] = useState("");
  const [alias, setAlias] = useState(makeAlias("nurse"));
  const [recovery, setRecovery] = useState(makeRecoveryCode());
  const [showSavedHint, setShowSavedHint] = useState(false);

  useEffect(() => {
    setAlias(makeAlias(role));
  }, [role]);

  async function handleSubmit(e) {
    e.preventDefault();
    const codeHash = await sha256Hex(recovery);
    const payload = {
      id: crypto?.randomUUID?.() || String(Date.now()),
      alias,
      role,
      facility: facility.trim() || null,
      codeHash, // store only the hash (no PII)
      createdAt: new Date().toISOString(),
    };
    onSubmit(payload, { recovery }); // pass plain code ONLY to show to the user once
  }

  return (
    <ModalWithForm
      title="Create anonymous account"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Create account"
    >
      <fieldset className="form__row">
        <legend className="form__label">Role</legend>
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
      </fieldset>

      <label>
        <span className="form__label">Facility (optional)</span>
        <input
          className="input"
          value={facility}
          onChange={(e) => setFacility(e.target.value)}
          placeholder="Hospital name"
        />
      </label>

      <label>
        <span className="form__label">Your alias</span>
        <div className="form__row">
          <input className="input" readOnly value={alias} />
          <button
            type="button"
            className="button"
            onClick={() => setAlias(makeAlias(role))}
          >
            Regenerate
          </button>
        </div>
      </label>

      <label>
        <span className="form__label">Recovery code (save this!)</span>
        <div className="form__row">
          <input className="input" readOnly value={recovery} />
          <button
            type="button"
            className="button"
            onClick={() => {
              navigator.clipboard.writeText(recovery);
              setShowSavedHint(true);
            }}
          >
            Copy
          </button>
          <button
            type="button"
            className="button"
            onClick={() => setRecovery(makeRecoveryCode())}
          >
            New
          </button>
        </div>
        {showSavedHint && (
          <small className="text-muted">
            Copied. Store it somewhere safe. We don’t keep this.
          </small>
        )}
      </label>

      <p className="text-muted" style={{ marginTop: 8 }}>
        We don’t ask for your name or email. Your identity is a random alias.
        Keep your recovery code to sign in later.
      </p>
    </ModalWithForm>
  );
}
