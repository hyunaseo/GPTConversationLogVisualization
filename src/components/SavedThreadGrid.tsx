import * as React from "react";
import type { SavedThread } from "../types";
import type { ZipEntries } from "../lib/zipJson";

type Props = {
  savedThreads: SavedThread[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  entries: ZipEntries | null;
};

function fmt(ts?: number) {
  if (!ts) return "-";
  const d = new Date(ts);
  return d.toLocaleString();
}

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

export function SavedThreadGrid({ savedThreads, selectedId, onSelect, entries }: Props) {
  const [thumbUrls, setThumbUrls] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    for (const url of Object.values(thumbUrls)) URL.revokeObjectURL(url);
    setThumbUrls({});

    if (!entries) return;

    const next: Record<string, string> = {};
    for (const t of savedThreads) {
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
  }, [savedThreads, entries]);

  return (
    <div className="threadGrid savedThreadGrid">
      {savedThreads.map((t) => (
        <button
          key={t.id}
          className={"threadGridItem " + (t.id === selectedId ? "active" : "")}
          onClick={() => onSelect(t.id)}
          type="button"
        >
          {thumbUrls[t.id] ? (
            <img className="threadGridImage" src={thumbUrls[t.id]} alt={t.title ?? "thread image"} />
          ) : (
            <div className="threadGridPlaceholder muted">(대표 이미지 없음)</div>
          )}
          <div className="threadGridMeta muted">{fmt(t.savedAt)}</div>
        </button>
      ))}
    </div>
  );
}