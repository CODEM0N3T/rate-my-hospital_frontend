export function makeAlias(role = "nurse") {
  const words = [
    "Sky",
    "River",
    "Oak",
    "Sage",
    "Nova",
    "Harbor",
    "Echo",
    "Flint",
    "Willow",
    "Quartz",
    "Maple",
    "Cedar",
  ];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(100 + Math.random() * 900);
  return `${role === "nurse" ? "Nurse" : "Staff"} ${w}-${n}`;
}

export function makeRecoveryCode() {
  // simple 12-char code grouped as xxxx-xxxx-xxxx
  const s = [...crypto.getRandomValues(new Uint8Array(9))]
    .map((b) => (b % 36).toString(36))
    .join("")
    .toUpperCase();
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}
