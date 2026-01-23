import * as React from "react";
import type { ChatThread } from "../types";
import type { ZipEntries } from "../lib/zipJson";

function fmt(ts?: number) {
  if (!ts) return "-";
  const d = new Date(ts);
  return d.toLocaleString();
}

type Props = {
  threads: ChatThread[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  entries: ZipEntries | null;
  imagesOnly: boolean;
};

function blobUrlFromEntry(entries: ZipEntries, path: string): string | null {
  const u8 = entries[path];
  if (!u8) return null;

  const ext = path.toLowerCase().split(".").pop() || "png";
  const mime =
    ext === "jpg" || ext === "jpeg"
      ? "image/jpeg"
      : ext === "webp"
      ? "image/webp"
      : "image/png";

  const ab = new Uint8Array(u8).buffer;
  const blob = new Blob([ab], { type: mime });
  return URL.createObjectURL(blob);
}

export function ThreadList({ threads, selectedId, onSelect, entries, imagesOnly }: Props) {
  const [thumbUrls, setThumbUrls] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    for (const url of Object.values(thumbUrls)) URL.revokeObjectURL(url);
    setThumbUrls({});

    if (!imagesOnly || !entries) return;

    const next: Record<string, string> = {};
    for (const t of threads) {
      const path = t.imagePaths?.[0];
      if (!path) continue;
      const url = blobUrlFromEntry(entries, path);
      if (url) next[t.id] = url;
    }
    setThumbUrls(next);

    return () => {
      for (const url of Object.values(next)) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads, entries, imagesOnly]);

  const showThumbnails = imagesOnly;

  return (
    <div className="card threadListCard">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="title">3) Threads</div>
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
                  <div className="threadGridPlaceholder muted">(대표 이미지 없음)</div>
                )}
                <div className="threadGridMeta muted">
                  {fmt(t.startTime)} · {t.messageCount} msgs
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