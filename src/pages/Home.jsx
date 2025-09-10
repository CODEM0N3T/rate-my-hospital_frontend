import { useEffect, useRef, useState } from "react";
import { fetchHospitals } from "../api/cms.js";
import SearchBar from "../components/SearchBar/SearchBar.jsx";
import Preloader from "../components/Preloader/Preloader.jsx";
import HospitalList from "../components/HospitalList/HospitalList.jsx";
import Hero from "../components/Hero/Hero.jsx";
import logo from "../assets/images/rmh-logo.png";

const VISIBLE_LIMIT = 3;

export default function Home() {
  const [q, setQ] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef(null);

  function load() {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError("");

    // always fetch the first “page”; we only show top 3
    fetchHospitals({ q, state: stateCode, page: 1 }, { signal: ctrl.signal })
      .then((data) => {
        const rows = data?.items || data || [];
        const list = rows.map((row) => ({
          providerId:
            row.provider_id ||
            row.ccn ||
            row.providerid ||
            Math.random().toString(36).slice(2),
          hospitalName:
            row.hospital_name || row.hospitalname || row.facility_name,
          city: row.city,
          state: row.state,
          phone: row.phone_number || row.phone,
          type: row.hospital_type || row.type,
          ownership: row.hospital_ownership || row.ownership,
          hcahpsStars: row.hospital_overall_rating || row.overall_rating || 0,
        }));
        setItems(list.slice(0, VISIBLE_LIMIT)); // show only 3
      })
      .catch((e) => {
        if (e?.name !== "AbortError")
          setError("Couldn’t load hospitals. Try again.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(); // initial fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(e) {
    e.preventDefault();
    load();
  }

  return (
    <section className="home">
      <Hero>
        <img className="hero__logo" src={logo} alt="Rate My Hospital logo" />
        <h1 className="hero__title">Rate My Hospital</h1>
        <p className="hero__subtitle">Enter your hospital to get started</p>

        <div className="hero__search">
          <SearchBar
            variant="hero"
            showState={true} // set to false to hide the state dropdown
            q={q}
            stateCode={stateCode}
            onChangeQ={setQ}
            onChangeState={setStateCode}
            onSubmit={onSubmit}
          />
        </div>
      </Hero>

      <div style={{ height: 40 }} />

      {loading && <Preloader />}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && <HospitalList items={items} columns={3} />}
      {/* Pagination intentionally removed */}
    </section>
  );
}
