export function Toggle({ checked, onChange, label }) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-ui" aria-hidden />
    </label>
  );
}
