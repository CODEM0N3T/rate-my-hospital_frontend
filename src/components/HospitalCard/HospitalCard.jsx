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

// Simple, reliable placeholder image (works on GH Pages too)
function getThumb({ providerId, hospitalName }) {
  const seed = encodeURIComponent(providerId || hospitalName || "rmh");
  return `https://picsum.photos/seed/${seed}/480/270`; // 16:9
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
}) {
  const img = getThumb({ providerId, hospitalName });

  return (
    <article className="hospital-card">
      <Link
        to={`/hospital/${providerId}`}
        className="hospital-card__link"
        aria-label={`Open ${hospitalName}`}
      >
        <div className="hospital-card__media">
          <img src={img} alt="" loading="lazy" />
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
