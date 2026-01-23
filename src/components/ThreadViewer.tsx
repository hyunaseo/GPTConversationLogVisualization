import * as React from "react";
import type { ChatThread } from "../types";
import type { ZipEntries } from "../lib/zipJson";

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

  // ✅ SharedArrayBuffer 가능성을 제거: ArrayBuffer로 "복사"해서 확정
  const ab = new Uint8Array(u8).buffer; // <-- 이 buffer는 ArrayBuffer로 확정됨

  const blob = new Blob([ab], { type: mime });
  return URL.createObjectURL(blob);
}

type Props = {
  thread: ChatThread | null;
  entries: ZipEntries | null;
};

export function ThreadViewer({ thread, entries }: Props) {
  const [thumbUrls, setThumbUrls] = React.useState<Array<{ path: string; url: string }>>([]);

  // 썸네일 URL 생성/정리 (메모리 누수 방지)
  React.useEffect(() => {
    // 이전 URL 정리
    for (const t of thumbUrls) URL.revokeObjectURL(t.url);
    setThumbUrls([]);

    if (!thread || !entries) return;

    const paths = thread.imagePaths ?? [];
    if (paths.length === 0) return;

    const next: Array<{ path: string; url: string }> = [];
    for (const p of paths.slice(0, 12)) {
      const url = blobUrlFromEntry(entries, p);
      if (url) next.push({ path: p, url });
    }
    setThumbUrls(next);

    return () => {
      for (const t of next) URL.revokeObjectURL(t.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.id, entries]); // thread 바뀌거나 entries 바뀌면 갱신

  if (!thread) {
    return (
      <div className="card" style={{ height: "100%" }}>
        <div className="title">4) Viewer</div>
        <div className="muted" style={{ marginTop: 10 }}>
          왼쪽에서 대화를 선택하세요.
        </div>
      </div>
    );
  }

  const pointerCount = thread.imageAssetPointers?.length ?? 0;
  const imagePathCount = thread.imagePaths?.length ?? 0;
  const messages = thread.messages ?? [];

  return (
    <div className="card" style={{ height: "100%" }}>
      <div className="title">4) Viewer</div>

      {/* Header / Meta */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{thread.title ?? "(untitled)"}</div>

        <div className="muted" style={{ marginTop: 6 }}>
          기간: {fmt(thread.startTime)} ~ {fmt(thread.endTime)}
        </div>

        <div className="muted" style={{ marginTop: 6 }}>
          메시지 수: {thread.messageCount} · 이미지 포함: {thread.hasImages ? "Yes" : "No"}
          {thread.hasImages ? ` (pointers: ${pointerCount}, files: ${imagePathCount})` : ""}
        </div>
      </div>

      <hr style={{ margin: "14px 0" }} />

      {/* Images preview */}
      {entries && thumbUrls.length > 0 ? (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Images</div>
          <div className="muted" style={{ marginTop: 6 }}>
            {imagePathCount} file{imagePathCount === 1 ? "" : "s"} (showing up to 12)
          </div>

          <div
            style={{
              marginTop: 10,
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 10,
            }}
          >
            {thumbUrls.map(({ path, url }) => (
              <div
                key={path}
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                <img
                  src={url}
                  alt={path}
                  style={{ width: "100%", display: "block", maxHeight: 260, objectFit: "cover" }}
                />
                <div
                  className="muted"
                  style={{
                    padding: 8,
                    fontSize: 11,
                    wordBreak: "break-all",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  }}
                >
                  {path}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : thread.hasImages ? (
        <div className="muted">
          {entries
            ? "(이미지 파일 매핑이 아직 없거나 실패했습니다: imagePaths가 비어있음)"
            : "(ZIP entries가 아직 로드되지 않아 이미지를 렌더링할 수 없습니다.)"}
        </div>
      ) : (
        <div className="muted">(이 대화에는 이미지가 없습니다.)</div>
      )}

    {/* Conversation log */}
      <div style={{ marginTop: 14 }}>
        <hr style={{ margin: "14px 0" }} />

        <div style={{ fontSize: 14, fontWeight: 700 }}>Conversation</div>
        <div className="muted" style={{ marginTop: 6 }}>
          {messages.length} message{messages.length === 1 ? "" : "s"} (user + assistant)
        </div>

        {messages.length > 0 ? (
          <div className="conversationLog">
            {messages.map((msg) => {
              const text = msg.text?.trim();
              const assetCount = msg.assetPointers?.length ?? 0;
              const fallback = assetCount > 0 ? "(이미지 첨부)" : "(내용 없음)";

              return (
                <div key={msg.id} className="conversationMessage">
                  <div className="conversationRole">
                    {msg.role === "user" ? "User" : "Assistant"}
                  </div>
                  <div className="conversationBody">
                    <div className="conversationText">{text || fallback}</div>
                    {assetCount > 0 ? (
                      <div className="conversationMeta muted">
                        이미지 {assetCount}개 포함
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="muted" style={{ marginTop: 10 }}>
            (이 대화에는 표시할 메시지가 없습니다.)
          </div>
        )}
      </div>

      {/* Asset pointers list */}
      {pointerCount > 0 ? (
        <div style={{ marginTop: 14 }}>
          <hr style={{ margin: "14px 0" }} />

          <div style={{ fontSize: 14, fontWeight: 700 }}>Image asset pointers</div>
          <div className="muted" style={{ marginTop: 6 }}>
            {pointerCount} item{pointerCount === 1 ? "" : "s"} (showing up to 30)
          </div>

          <div
            style={{
              marginTop: 10,
              maxHeight: 220,
              overflow: "auto",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10,
              padding: 10,
            }}
          >
            <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
              {thread.imageAssetPointers!.slice(0, 30).map((p, i) => (
                <li
                  key={i}
                  style={{
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 12,
                    lineHeight: 1.35,
                    marginBottom: 6,
                    wordBreak: "break-all",
                  }}
                >
                  {p}
                </li>
              ))}
              {pointerCount > 30 ? <li>... (more)</li> : null}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="muted" style={{ marginTop: 14 }}>
        (다음 단계: 선택한 이미지/대화만 다시 ZIP으로 export)
      </div>
    </div>
  );
}
