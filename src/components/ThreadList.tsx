import * as React from "react";
import type { ChatThread } from "../types";
import { createBlobUrlFromPath, type ZipArchive } from "../lib/zipJson";

function fmt(ts?: number) {
  if (!ts) return "-";
  const d = new Date(ts);
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

type Props = {
  threads: ChatThread[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  archive: ZipArchive | null;
  imagesOnly: boolean;
};

export function ThreadList({ threads, selectedId, onSelect, archive, imagesOnly }: Props) {
  const [thumbUrls, setThumbUrls] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    let cancelled = false;
    const previous = { ...thumbUrls };
    for (const url of Object.values(previous)) URL.revokeObjectURL(url);
    setThumbUrls({});

    if (!imagesOnly || !archive) return;

    const load = async () => {
      const next: Record<string, string> = {};
      for (const t of threads.slice(0, 60)) {
        const path = t.imagePaths?.[0];
        if (!path) continue;
        try {
          const url = await createBlobUrlFromPath(archive, path);
          if (url) next[t.id] = url;
        } catch (e) {
          console.warn("Failed to load thumbnail:", path, e);
        }
      }
      if (cancelled) {
        for (const url of Object.values(next)) URL.revokeObjectURL(url);
        return;
      }
      setThumbUrls(next);
    };

    void load();

    return () => {
      cancelled = true;
      for (const url of Object.values(previous)) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads, archive, imagesOnly]);

  const showThumbnails = imagesOnly;

  return (
    <div className="card threadListCard">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="title">Step 2. Select images.</div>
        <div className="muted">{threads.length} items</div>
      </div>
      <div className="threadListBody">
        {showThumbnails ? (
          <div className="threadGrid">
            {threads.map((t) => (
              <button
                key={t.id}
                className={"threadGridItem " + (t.id === selectedId ? "active" : "")}
                onClick={() => onSelect(t.id)}
                type="button"
              >
                {thumbUrls[t.id] ? (
                  <img
                    className="threadGridImage"
                    src={thumbUrls[t.id]}
                    alt={t.title ?? "thread image"}
                  />
                ) : (
                  <div className="threadGridPlaceholder muted">(No preview image)</div>
                )}
                <div className="threadGridMeta muted">
                  {fmt(t.startTime)}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="list">
            {threads.map((t) => (
              <button
                key={t.id}
                className={"listItem " + (t.id === selectedId ? "active" : "")}
                onClick={() => onSelect(t.id)}
                type="button"
              >
                <div className="listTitle">
                  {t.title ?? "(untitled)"} {t.hasImages ? <span className="pill">IMG</span> : null}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {fmt(t.startTime)} · {t.messageCount} msgs
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
