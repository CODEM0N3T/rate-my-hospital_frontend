import "./HospitalList.css";
import HospitalCard from "../HospitalCard/HospitalCard.jsx";

export default function HospitalList({ items = [] }) {
  if (!items.length) return <p>Search to load hospitals…</p>;
  return (
    <ul className="cards" role="list">
      {items.map((h) => (
        <li key={h.providerId}>
          <HospitalCard {...h} />
        </li>
      ))}
    </ul>
  );
}
