import { useState } from "react";
import ModalWithForm from "../ModalWithForm/ModalWithForm.jsx";
import { sha256Hex } from "../../utils/crypto.js";
import { aliasExists } from "../../storage/users.js";

export default function RegisterModal({ onSubmit, onClose, onGoToLogin }) {
  const [role, setRole] = useState("nurse");
  const [facility, setFacility] = useState("");
  const [alias, setAlias] = useState("");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const name = alias.trim();
    if (name.length < 3) return setError("Name must be at least 3 characters.");
    if (aliasExists(name))
      return setError("That name is already in use on this device.");
    if (pass.length < 8)
      return setError("Passcode must be at least 8 characters.");
    if (pass !== confirm) return setError("Passcodes do not match.");

    const codeHash = await sha256Hex(pass);
    const payload = {
      id: crypto?.randomUUID?.() || String(Date.now()),
      alias: name,
      role,
      facility: facility.trim() || null,
      codeHash, // store only the hash (no raw passcode)
      createdAt: new Date().toISOString(),
    };
    onSubmit(payload);
  }

  return (
    <ModalWithForm
      title="Create your account"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Create account"
      secondaryLabel="Login" // ← text change
      onSecondary={onGoToLogin}
    >
      <fieldset className="form__row field">
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

      <label className="field">
        <span className="form__label">Display name</span>
        <input
          className="input"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder="Choose a name (e.g., Nurse Willow)"
          required
          minLength={3}
          maxLength={24}
        />
      </label>

      <label className="field">
        <span className="form__label">Facility (optional)</span>
        <input
          className="input"
          value={facility}
          onChange={(e) => setFacility(e.target.value)}
          placeholder="Your hospital"
        />
      </label>

      <label className="field password-field">
        <span className="form__label">Passcode</span>
        <input
          className="input"
          type={showPass ? "text" : "password"}
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder="Create a passcode (min 8 chars)"
          required
          minLength={8}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setShowPass((v) => !v)}
          aria-label={showPass ? "Hide passcode" : "Show passcode"}
        >
          {showPass ? "Hide" : "Show"}
        </button>
      </label>

      <label className="field password-field">
        <span className="form__label">Confirm passcode</span>
        <input
          className="input"
          type={showConfirm ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Re-enter your passcode"
          required
          minLength={8}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setShowConfirm((v) => !v)}
          aria-label={showConfirm ? "Hide passcode" : "Show passcode"}
        >
          {showConfirm ? "Hide" : "Show"}
        </button>
      </label>

      {error && (
        <p role="alert" style={{ color: "#b91c1c" }}>
          {error}
        </p>
      )}

      <p className="text-muted" style={{ marginTop: 6 }}>
        No email required. Your display name is public. Your passcode is private
        and never stored in plain text.
      </p>
    </ModalWithForm>
  );
}
