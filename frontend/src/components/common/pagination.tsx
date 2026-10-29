"use client";

export default function Pagination({ page, total, pageSize = 20, onPageChange, disabled = false, label = "목록 페이지", unit = "건" }: {
  page: number; total: number; pageSize?: number; onPageChange: (page: number) => void;
  disabled?: boolean; label?: string; unit?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const visible = Array.from(new Set([1, pages, ...Array.from({ length: 3 }, (_, index) => page + index - 1)]))
    .filter(value => value >= 1 && value <= pages).sort((a, b) => a - b);
  return <nav className="pagination" aria-label={label}>
    <span className="pagination-total">총 {total.toLocaleString("ko-KR")}{unit}</span>
    <ul className="pagination-list">
      <li><button type="button" className="pagination-button pagination-direction" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)} aria-label="이전 페이지"><Chevron /><span>이전</span></button></li>
      {visible.map((value, index) => <li className="pagination-number" key={value}>
        {index > 0 && value - visible[index - 1] > 1 && <span className="pagination-ellipsis" aria-hidden="true">…</span>}
        <button type="button" className="pagination-button" aria-label={`${value}페이지`} aria-current={value === page ? "page" : undefined} disabled={disabled} onClick={() => onPageChange(value)}>{value}</button>
      </li>)}
      <li className="pagination-mobile-status" aria-hidden="true">{page} / {pages}</li>
      <li><button type="button" className="pagination-button pagination-direction" disabled={disabled || page >= pages} onClick={() => onPageChange(page + 1)} aria-label="다음 페이지"><span>다음</span><Chevron next /></button></li>
    </ul>
    <span className="sr-only" role="status">{pages}페이지 중 {page}페이지</span>
  </nav>;
}
function Chevron({ next = false }: { next?: boolean }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={next ? "m9 6 6 6-6 6" : "m15 6-6 6 6 6"} /></svg>;
}
