import "./SearchBar.css";

const STATES =
  "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(
    " "
  );

export default function SearchBar({
  q,
  stateCode,
  onChangeQ,
  onChangeState,
  onSubmit,
  variant = "hero",
  showState = true, // set false if you want to remove the state selector entirely
}) {
  return (
    <form
      className={`search ${variant === "hero" ? "search--hero" : ""}`}
      role="search"
      onSubmit={onSubmit}
    >
      <div className="search__group">
        <label htmlFor="q" className="sr-only">
          Hospital or city
        </label>
        <input
          id="q"
          className="search__input"
          value={q}
          onChange={(e) => onChangeQ(e.target.value)}
          placeholder="Search hospital or city…"
          autoComplete="off"
        />

        {showState && (
          <>
            <label htmlFor="st" className="sr-only">
              State
            </label>
            <select
              id="st"
              className="search__select"
              aria-label="State (optional)"
              value={stateCode}
              onChange={(e) => onChangeState(e.target.value)}
            >
              <option value="">All states</option>
              {STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </>
        )}

        <button type="submit" className="search__btn">
          Search
        </button>
      </div>
    </form>
  );
}
