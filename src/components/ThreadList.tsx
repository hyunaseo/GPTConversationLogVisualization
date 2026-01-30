import * as React from "react";
import type { ChatThread } from "../types";
import type { ZipManager } from "../lib/ZipManager";

function fmt(ts?: number) {
  if (!ts) return "-";
  const d = new Date(ts);
  return d.toLocaleString();
}

type Props = {
  threads: ChatThread[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  zipManager: ZipManager | null;
  imagesOnly: boolean;
};

export function ThreadList({
  threads,
  selectedId,
  onSelect,
  zipManager,
  imagesOnly,
}: Props) {
  const [thumbUrls, setThumbUrls] = React.useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = React.useState(0);
  const thumbUrlCache = React.useRef<Record<string, string>>({});

  const ITEMS_PER_PAGE = 9;

  // Calculate pagination
  const paginatedThreads = React.useMemo(() => {
    const startIdx = currentPage * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    return threads.slice(startIdx, endIdx);
  }, [threads, currentPage]);
  const totalPages = Math.ceil(threads.length / ITEMS_PER_PAGE);

  // Reset to page 0 when threads change
  React.useEffect(() => {
    setCurrentPage(0);
  }, [threads]);

  // Effect to load thumbnail blob URLs for the current page
  React.useEffect(() => {
    let isCancelled = false;

    const loadThumbs = async () => {
      if (!imagesOnly || !zipManager) {
        setThumbUrls({});
        return;
      }

      const next: Record<string, string> = {};
      await Promise.all(
        paginatedThreads.map(async (t) => {
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
  }, [paginatedThreads, zipManager, imagesOnly]);

  React.useEffect(() => {
    const cache = thumbUrlCache.current;
    return () => {
      Object.values(cache).forEach(URL.revokeObjectURL);
    };
  }, []);

  const showThumbnails = imagesOnly;

  return (
    <div className="card threadListCard">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="title">Step 2. 이미지를 선택하세요.</div>
        <div className="muted">{threads.length} items</div>
      </div>
      <div className="threadListBody">
        {showThumbnails ? (
          <div className="threadGrid">
            {paginatedThreads.map((t) => (
              <button
                key={t.id}
                className={
                  "threadGridItem " + (t.id === selectedId ? "active" : "")
                }
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
                <div className="threadGridMeta muted">{fmt(t.startTime)}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="list">
            {paginatedThreads.map((t) => (
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
        )}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div
          style={{
            padding: "10px 14px",
            borderTop: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <div
            className="row"
            style={{ justifyContent: "space-between", alignItems: "center" }}
          >
            <button
              className="btn"
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              type="button"
            >
              Previous
            </button>
            <div className="muted">
              Page {currentPage + 1} of {totalPages}
            </div>
            <button
              className="btn"
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
              }
              disabled={currentPage === totalPages - 1}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}