export default function PhotoSkeleton({ large = false }: { large?: boolean }) {
  return <div className={`photo-skeleton${large ? " photo-skeleton-large" : ""}`} role="status" aria-label="사진 불러오는 중">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.5" /><path d="m3 17 5-5 4 4 3-3 6 6" /></svg>
  </div>;
}
