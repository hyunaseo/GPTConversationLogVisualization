import * as React from "react";
import type { SavedThread } from "../types";
import { createBlobUrlFromPath, type ZipArchive } from "../lib/zipJson";

type Props = {
  savedThreads: SavedThread[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  archive: ZipArchive | null;
};

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

export function SavedThreadGrid({ savedThreads, selectedId, onSelect, archive }: Props) {
  const [thumbUrls, setThumbUrls] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    let cancelled = false;
    const previous = { ...thumbUrls };
    for (const url of Object.values(previous)) URL.revokeObjectURL(url);
    setThumbUrls({});

    if (!archive) return;

    const load = async () => {
      const next: Record<string, string> = {};
      for (const t of savedThreads) {
        const path = t.imagePaths?.[0];
        if (!path) continue;
        try {
          const url = await createBlobUrlFromPath(archive, path);
          if (url) next[t.id] = url;
        } catch (e) {
          console.warn("Failed to load saved thumbnail:", path, e);
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
  }, [savedThreads, archive]);

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
            <div className="threadGridPlaceholder muted">(No thumbnail image available)</div>
          )}
          <div className="threadGridMeta muted">{fmt(t.savedAt)}</div>
        </button>
      ))}
    </div>
  );
}
