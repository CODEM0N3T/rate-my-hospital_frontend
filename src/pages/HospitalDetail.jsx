import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchHcahps } from "../api/cms";
import { loadReviews, saveReview } from "../storage/reviews";
import ReviewList from "../components/ReviewList/ReviewList.jsx";
import ReviewForm from "../components/ReviewForm/ReviewForm.jsx";

export default function HospitalDetail() {
  const { providerId } = useParams();
  const [metrics, setMetrics] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setReviews(loadReviews(providerId));
    fetchHcahps(providerId)
      .then(setMetrics)
      .catch(() => setMetrics([]));
  }, [providerId]);

  function addReview(r) {
    saveReview(providerId, { ...r, providerId });
    setReviews(loadReviews(providerId));
  }

  return (
    <article className="detail">
      <h1>Hospital Detail</h1>
      <p>Provider ID: {providerId}</p>

      <section className="detail__metrics">
        <h2>HCAHPS Highlights</h2>
        <ul>
          {(metrics || []).slice(0, 5).map((m, i) => (
            <li key={i}>
              {m?.measure_name || m?.hcahps_measure || JSON.stringify(m)}
            </li>
          ))}
        </ul>
      </section>

      <section className="detail__reviews">
        <div className="detail__reviews-head">
          <h2>Anonymous Reviews</h2>
          <button className="button" onClick={() => setOpen(true)}>
            Add review
          </button>
        </div>
        <ReviewList items={reviews} />
      </section>

      {open && (
        <ReviewForm onSubmit={addReview} onClose={() => setOpen(false)} />
      )}
    </article>
  );
}
