import "./Pagination.css";
export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        className="pagination__btn"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
      >
        Prev
      </button>
      <span className="pagination__status">
        {page} / {totalPages}
      </span>
      <button
        className="pagination__btn"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
      >
        Next
      </button>
    </nav>
  );
}
