type Props = {
  summaryText: string;
};

export function JsonInspector({ summaryText }: Props) {
  if (!summaryText) return null;

  return (
    <div className="card">
      <div className="title">JSON Inspector (debug)</div>
      <pre style={{ whiteSpace: "pre-wrap", marginTop: 10 }} className="muted">
        {summaryText}
      </pre>
    </div>
  );
}
