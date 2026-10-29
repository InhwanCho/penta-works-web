export default function AuthoringHeader({ title, onBack, disabled = false }: { title: string; onBack: () => void; disabled?: boolean }) {
  return <header className="work-authoring-header">
    <button type="button" onClick={onBack} disabled={disabled} className="work-authoring-back" aria-label="이전 화면으로 돌아가기">
      <span aria-hidden="true">←</span><span>업무현황</span>
    </button>
    <h1>{title}</h1>
  </header>;
}
