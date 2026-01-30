import * as React from "react";
import type { SavedThread } from "../types";
import type { ZipManager } from "../lib/ZipManager";

type Props = {
  savedThreads: SavedThread[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  zipManager: ZipManager | null;
};

function fmt(ts?: number) {
  if (!ts) return "-";
  const d = new Date(ts);
  return d.toLocaleString();
}

export function SavedThreadGrid({
  savedThreads,
  selectedId,
  onSelect,
  zipManager,
}: Props) {
  const [thumbUrls, setThumbUrls] = React.useState<Record<string, string>>({});
  const thumbUrlCache = React.useRef<Record<string, string>>({});

  React.useEffect(() => {
    let isCancelled = false;

    const loadThumbs = async () => {
      if (!zipManager) {
        setThumbUrls({});
        return;
      }

      const next: Record<string, string> = {};
      await Promise.all(
        savedThreads.map(async (t) => {
          const path = t.imagePaths?.[0];
          if (!path) return;

          if (thumbUrlCache.current[t.id]) {
            next[t.id] = thumbUrlCache.current[t.id];
            return;
          }

          const url = await zipManager.readBlobUrl(path);
          if (url && !isCancelled) {
            next[t.id] = url;
            thumbUrlCache.current[t.id] = url;
          }
        })
      );

      if (!isCancelled) {
        setThumbUrls(next);
      }
    };

    loadThumbs();

    return () => {
      isCancelled = true;
    };
  }, [savedThreads, zipManager]);

  React.useEffect(() => {
    const cache = thumbUrlCache.current;
    return () => {
      Object.values(cache).forEach(URL.revokeObjectURL);
    };
  }, []);

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
            <img
              className="threadGridImage"
              src={thumbUrls[t.id]}
              alt={t.title ?? "thread image"}
            />
          ) : (
            <div className="threadGridPlaceholder muted">(대표 이미지 없음)</div>
          )}
          <div className="threadGridMeta muted">{fmt(t.savedAt)}</div>
        </button>
      ))}
    </div>
  );
}