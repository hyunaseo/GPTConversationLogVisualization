import type { ChatThread } from "../types";

function fmt(ts?: number) {
  if (!ts) return "-";
  const d = new Date(ts);
  return d.toLocaleString();
}

type Props = {
  threads: ChatThread[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function ThreadList({ threads, selectedId, onSelect }: Props) {
  return (
    <div className="card" style={{ height: "100%", overflow: "auto" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="title">3) Threads</div>
        <div className="muted">{threads.length} items</div>
      </div>

      <div className="list">
        {threads.map((t) => (
          <button
            key={t.id}
            className={"listItem " + (t.id === selectedId ? "active" : "")}
            onClick={() => onSelect(t.id)}
            type="button"
          >
            <div className="listTitle">
              {t.title ?? "(untitled)"}{" "}
              {t.hasImages ? <span className="pill">IMG</span> : null}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              {fmt(t.startTime)} · {t.messageCount} msgs
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
