import { useState } from "react";
import ModalWithForm from "../ModalWithForm/ModalWithForm.jsx";
import { getUserByAlias } from "../../storage/users.js";
import { sha256Hex } from "../../utils/crypto.js";

export default function LoginModal({ onSubmit, onClose }) {
  const [alias, setAlias] = useState("");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const record = getUserByAlias(alias.trim());
    if (!record) return setError("No account with that name on this device.");

    const codeHash = await sha256Hex(pass.trim());
    if (record.codeHash !== codeHash) return setError("Incorrect passcode.");

    onSubmit(record);
  }

  return (
    <ModalWithForm
      title="Sign in"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Sign in"
    >
      <label className="field">
        <span className="form__label">Display name</span>
        <input
          className="input"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          required
        />
      </label>

      <label className="field password-field">
        <span className="form__label">Passcode</span>
        <input
          className="input"
          type={show ? "text" : "password"}
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          required
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide passcode" : "Show passcode"}
        >
          {show ? "Hide" : "Show"}
        </button>
      </label>

      {error && (
        <p role="alert" style={{ color: "#b91c1c" }}>
          {error}
        </p>
      )}

      <p className="text-muted">Use the name you chose and your passcode.</p>
    </ModalWithForm>
  );
}
