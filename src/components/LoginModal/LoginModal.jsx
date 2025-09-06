import { useState } from "react";
import ModalWithForm from "../ModalWithForm/ModalWithForm.jsx";
import { getUserByAlias } from "../../storage/users.js";
import { sha256Hex } from "../../utils/crypto.js";

export default function LoginModal({ onSubmit, onClose }) {
  const [alias, setAlias] = useState("");
  const [recovery, setRecovery] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const record = getUserByAlias(alias.trim());
    if (!record) {
      setError("Alias not found on this device.");
      return;
    }
    const codeHash = await sha256Hex(recovery.trim());
    if (record.codeHash !== codeHash) {
      setError("Recovery code doesn’t match.");
      return;
    }
    onSubmit(record); // pass the stored anonymous user
  }

  return (
    <ModalWithForm
      title="Sign in anonymously"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Sign in"
    >
      <label>
        <span className="form__label">Alias</span>
        <input
          className="input"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          required
        />
      </label>
      <label>
        <span className="form__label">Recovery code</span>
        <input
          className="input"
          value={recovery}
          onChange={(e) => setRecovery(e.target.value)}
          required
          placeholder="XXXX-XXXX-XXXX"
        />
      </label>
      {error && (
        <p role="alert" style={{ color: "#b91c1c" }}>
          {error}
        </p>
      )}
      <p className="text-muted">
        Tip: if this device is new, first register to create a local anonymous
        account.
      </p>
    </ModalWithForm>
  );
}
