/* ============================================================
   PAGINATION CONTROL
   Renders page-number + prev/next controls from the standard
   {page, limit, total, totalPages, hasNextPage, hasPreviousPage}
   envelope returned by every paginated backend list endpoint.
============================================================ */
import { ChevronLeft, ChevronRight } from "lucide-react";

const pageNumbers = (page, totalPages) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
  const withGaps = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) withGaps.push("…");
    withGaps.push(p);
    prev = p;
  }
  return withGaps;
};

const PageButton = ({ active, disabled, children, onClick, ariaLabel }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    className={`min-w-9 h-9 px-2 inline-flex items-center justify-center rounded-xl text-xs font-bold border transition
      ${
        active
          ? "bg-[#173B5C] text-white border-[#173B5C] shadow-sm"
          : "bg-[#FFFDF8] text-[#747B83] border-[#E7E1D3] hover:bg-[#F5F1E7] hover:text-[#16263A]"
      }
      ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
  >
    {children}
  </button>
);

const Pagination = ({ pagination, onPageChange, className = "" }) => {
  if (!pagination || pagination.totalPages <= 1) return null;

  const { page, limit, totalPages, hasNextPage, hasPreviousPage, total } = pagination;

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 ${className}`}>
      <p className="text-xs text-[#8A9096]">
        Showing{" "}
        <span className="font-semibold text-[#16263A]">
          {total === 0 ? 0 : (page - 1) * limit + 1}–{Math.min(page * limit, total)}
        </span>{" "}
        of <span className="font-semibold text-[#16263A]">{total}</span>
      </p>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <PageButton
          disabled={!hasPreviousPage}
          onClick={() => onPageChange(page - 1)}
          ariaLabel="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </PageButton>

        {pageNumbers(page, totalPages).map((p, idx) =>
          p === "…" ? (
            <span key={`gap-${idx}`} className="px-1 text-xs text-[#8A9096]">
              …
            </span>
          ) : (
            <PageButton
              key={p}
              active={p === page}
              onClick={() => onPageChange(p)}
              ariaLabel={`Page ${p}`}
            >
              {p}
            </PageButton>
          )
        )}

        <PageButton
          disabled={!hasNextPage}
          onClick={() => onPageChange(page + 1)}
          ariaLabel="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </PageButton>
      </div>
    </div>
  );
};

export default Pagination;