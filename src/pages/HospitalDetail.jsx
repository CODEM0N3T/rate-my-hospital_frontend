import { useParams, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { fetchHcahps } from "../api/cms";
import { loadReviews, saveReview } from "../storage/reviews";
import ReviewList from "../components/ReviewList/ReviewList.jsx";
import ReviewForm from "../components/ReviewForm/ReviewForm.jsx";
import "./HospitalDetail.css";

function computeStats(reviews = []) {
  const total = reviews.length || 0;
  const counts = [0, 0, 0, 0, 0, 0]; // index by stars 0..5
  let recommendYes = 0;
  let difficultySum = 0;

  for (const r of reviews) {
    const s = Math.max(1, Math.min(5, Number(r.rating || 0)));
    counts[s] += 1;
    if (r.recommend) recommendYes += 1;
    if (r.difficulty) difficultySum += Number(r.difficulty);
  }

  const avg = total
    ? (1 * counts[1] +
        2 * counts[2] +
        3 * counts[3] +
        4 * counts[4] +
        5 * counts[5]) /
      total
    : 0;
  const recommendPct = total ? Math.round((recommendYes / total) * 100) : 0;
  const difficulty = total ? difficultySum / total : 0;

  return { total, counts, avg, recommendPct, difficulty };
}

export default function HospitalDetail() {
  const { providerId } = useParams();
  const location = useLocation();
  const hospital = location.state?.hospital || {};
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
    setOpen(false);
  }

  const stats = useMemo(() => computeStats(reviews), [reviews]);
  const dist = useMemo(
    () =>
      [5, 4, 3, 2, 1].map((s) => ({
        star: s,
        count: stats.counts[s],
        pct: stats.total
          ? Math.round((stats.counts[s] / stats.total) * 100)
          : 0,
      })),
    [stats]
  );

  return (
    <article className="detail container">
      <header className="detail__header">
        {/* LEFT: title + KPIs + actions */}
        <div className="detail__left">
          <div className="detail__score">
            <div className="detail__score-big">
              {stats.avg ? stats.avg.toFixed(1) : "—"}
            </div>
            <div className="detail__score-outof">/ 5</div>
          </div>
          <p className="detail__based">
            Overall Quality based on <strong>{stats.total}</strong>{" "}
            {stats.total === 1 ? "rating" : "ratings"}
          </p>

          <h1 className="detail__title">
            {hospital.hospitalName || "Hospital"}
          </h1>
          <p className="detail__subtitle">
            {hospital.type ? `${hospital.type} • ` : ""}
            {hospital.city && hospital.state
              ? `${hospital.city}, ${hospital.state}`
              : ""}
          </p>

          <div className="detail__kpis">
            <div className="kpi">
              <div className="kpi__num">{stats.recommendPct}%</div>
              <div className="kpi__label">Would recommend</div>
            </div>
            <div className="kpi">
              <div className="kpi__num">
                {stats.difficulty ? stats.difficulty.toFixed(1) : "—"}
              </div>
              <div className="kpi__label">Level of Difficulty</div>
            </div>
          </div>

          <div className="detail__actions">
            <button
              className="button button--primary"
              onClick={() => setOpen(true)}
            >
              Rate
            </button>
            {hospital.phone && (
              <a
                className="button button--ghost"
                href={`tel:${hospital.phone}`}
                title="Call hospital"
              >
                Call
              </a>
            )}
          </div>

          {/* Optional: quick HCAHPS highlights */}
          {metrics?.length > 0 && (
            <div className="detail__hcahps">
              <h3 className="card__title">HCAHPS Highlights</h3>
              <ul className="hcahps__list">
                {metrics.slice(0, 4).map((m, i) => (
                  <li key={i} title={m?.hcahps_question || m?.measure_name}>
                    <span className="hcahps__name">
                      {m?.hcahps_measure_id?.replace(/_/g, " ") ||
                        m?.measure_name ||
                        "Measure"}
                    </span>
                    <span className="hcahps__val">
                      {m?.hcahps_star_rating ||
                        m?.hcahps_linear_mean_value ||
                        m?.linear_mean_value ||
                        "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* RIGHT: rating distribution */}
        <aside className="detail__right">
          <div className="card">
            <h3 className="card__title">Rating Distribution</h3>
            <ul className="bars" role="list">
              {dist.map((row) => (
                <li key={row.star} className="bars__row">
                  <span className="bars__label">
                    {["Awful", "OK", "Good", "Great", "Awesome"][row.star - 1]}{" "}
                    {row.star}
                  </span>
                  <div className="bars__track" aria-label={`${row.pct}%`}>
                    <div
                      className="bars__fill"
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                  <span className="bars__count">{row.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </header>

      <hr className="detail__divider" aria-hidden="true" />

      {/* REVIEWS */}
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
