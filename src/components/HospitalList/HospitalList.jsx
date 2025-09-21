// HospitalList.jsx
import "./HospitalList.css";
import HospitalCard from "../HospitalCard/HospitalCard.jsx";

const PROXY_ORIGIN =
  import.meta.env.VITE_PROXY_ORIGIN ??
  "https://rmh-proxy.rate-my-hospital.workers.dev";

export default function HospitalList({ items = [] }) {
  if (!items.length) return <p>Search to load hospitals…</p>;

  return (
    <ul className="cards" role="list">
      {items.map((h) => {
        const providerId =
          h.providerId ?? h.provider_id ?? h.id ?? h.facility_id;
        const hospitalName = h.hospitalName ?? h.hospital_name ?? h.name;
        const city = h.city;
        const state = h.state;
        const phone = h.phone ?? h.phone_number;
        const type = h.type ?? h.hospital_type;
        const ownership = h.ownership ?? h.hospital_ownership;
        const hcahpsStars = h.hcahpsStars ?? h.hospital_overall_rating ?? 0;

        const photoUrl =
          h.photoUrl ??
          h.photo_url ??
          (providerId
            ? `${PROXY_ORIGIN}/hospital-photo?provider_id=${providerId}&w=300&h=400`
            : null);

        return (
          <li key={providerId || hospitalName}>
            <HospitalCard
              providerId={providerId}
              hospitalName={hospitalName}
              city={city}
              state={state}
              phone={phone}
              type={type}
              ownership={ownership}
              hcahpsStars={hcahpsStars}
              photoUrl={
                h.photo_url ??
                (providerId
                  ? `${PROXY_ORIGIN}/hospital-photo?provider_id=${providerId}&w=300&h=400`
                  : null)
              }
            />
          </li>
        );
      })}
    </ul>
  );
}
