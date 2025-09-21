// src/components/HospitalCard/HospitalCard.jsx
import "./HospitalCard.css";
import { Link } from "react-router-dom";
import StarRating from "../StarRating/StarRating.jsx";

function phonePretty(s) {
  if (!s) return "";
  const m = String(s)
    .replace(/\D/g, "")
    .match(/(\d{3})(\d{3})(\d{4})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : s;
}

const PROXY_ORIGIN =
  import.meta.env.VITE_PROXY_ORIGIN ??
  "https://rmh-proxy.rate-my-hospital.workers.dev";

function getFallbackThumb({ providerId, hospitalName }) {
  const seed = encodeURIComponent(providerId || hospitalName || "rmh");
  return `https://picsum.photos/seed/${seed}/480/270`;
}

export default function HospitalCard({
  providerId,
  hospitalName,
  city,
  state,
  phone,
  type,
  ownership,
  hcahpsStars = 0,
  photoUrl, 
}) {
  const src =
    photoUrl ||
    (providerId
      ? `${PROXY_ORIGIN}/hospital-photo?provider_id=${providerId}&w=480&h=270`
      : getFallbackThumb({ providerId, hospitalName }));

  return (
    <article className="hospital-card">
      <Link
        to={`/hospital/${providerId}`}
        state={{
          hospital: {
            providerId,
            hospitalName,
            city,
            state,
            phone,
            type,
            ownership,
            photoUrl: src,
          },
        }}
        className="hospital-card__link"
        aria-label={`Open ${hospitalName}`}
      >
        <div className="hospital-card__media">
          <img
            src={src}
            alt={hospitalName}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src = getFallbackThumb({
                providerId,
                hospitalName,
              });
              e.currentTarget.onerror = null;
            }}
            style={{ display: "block", width: "100%", height: "auto" }}
          />
        </div>

        <div className="hospital-card__body">
          <h3 className="hospital-card__title">{hospitalName}</h3>
          <p className="hospital-card__sub">
            {city}, {state}
            {phone ? ` · ${phonePretty(phone)}` : ""}
          </p>

          <div className="hospital-card__meta">
            <StarRating value={Number(hcahpsStars) || 0} />
            {type && <span className="chip">{type}</span>}
            {ownership && <span className="chip">{ownership}</span>}
          </div>
        </div>
      </Link>
    </article>
  );
}
