export default function AuthoringHeader({ title, onBack, disabled = false }: { title: string; onBack: () => void; disabled?: boolean }) {
  return <header className="work-authoring-header">
    <button type="button" onClick={onBack} disabled={disabled} className="work-authoring-back" aria-label="이전 화면으로 돌아가기">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg><span>뒤로</span>
    </button>
    <h1>{title}</h1>
  </header>;
}
