import * as React from "react";
import type { ChatThread } from "../types";
import type { ZipManager } from "../lib/ZipManager";

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatInline(text: string) {
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function markdownToHtml(input: string) {
  const escaped = escapeHtml(input);
  const lines = escaped.split(/\r?\n/);
  const parts: string[] = [];
  let paragraph: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      parts.push(`<p>${paragraph.join("<br />")}</p>`);
      paragraph = [];
    }
  };

  const closeList = () => {
    if (listType) {
      parts.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      closeList();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      closeList();
      const level = headingMatch[1].length;
      parts.push(`<h${level}>${formatInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      if (listType !== "ol") {
        closeList();
        listType = "ol";
        parts.push("<ol>");
      }
      parts.push(`<li>${formatInline(orderedMatch[2])}</li>`);
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      if (listType !== "ul") {
        closeList();
        listType = "ul";
        parts.push("<ul>");
      }
      parts.push(`<li>${formatInline(bulletMatch[1])}</li>`);
      continue;
    }

    closeList();
    paragraph.push(formatInline(trimmed));
  }

  flushParagraph();
  closeList();

  return parts.join("");
}

function fmt(ts?: number) {
  if (!ts) return "-";
  const d = new Date(ts);
  return d.toLocaleString();
}

type Props = {
  thread: ChatThread | null;
  zipManager: ZipManager | null;
  onAddThread: (thread: ChatThread) => void;
  onDeleteThread: (threadId: string) => void;
  isAdded: boolean;
};

export function ThreadViewer({ thread, zipManager, onAddThread, onDeleteThread, isAdded }: Props) {
  const [thumbUrls, setThumbUrls] = React.useState<Array<{ path: string; url: string }>>([]);

  React.useEffect(() => {
    let isCancelled = false;

    const loadThumbs = async () => {
      if (!thread || !zipManager) {
        setThumbUrls([]);
        return;
      }

      const paths = thread.imagePaths ?? [];
      if (paths.length === 0) {
        setThumbUrls([]);
        return;
      }

      const next: Array<{ path: string; url: string }> = [];
      await Promise.all(
        paths.map(async (p) => {
          const url = await zipManager.readBlobUrl(p);
          if (url && !isCancelled) {
            next.push({ path: p, url });
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
      thumbUrls.forEach((t) => URL.revokeObjectURL(t.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.id, zipManager]);

  if (!thread) {
    return (
      <div className="card" style={{ height: "100%" }}>
        <div className="title">Step 3. 이미지와 대화를 확인한 뒤 데이터로 추가할지 선택하세요.</div>
        <div className="muted" style={{ marginTop: 10 }}>
          왼쪽에서 대화를 선택하세요.
        </div>
      </div>
    );
  }

  const imagePathCount = thread.imagePaths?.length ?? 0;
  const messages = thread.messages ?? [];
  const hasImagePaths = imagePathCount > 0;
  const hasRenderableImages = Boolean(zipManager) && thumbUrls.length > 0;

  return (
    <div className="card" style={{ height: "100%" }}>
      <div className="row">
        <div className="title">Step 3. 이미지와 대화를 확인한 뒤 데이터로 추가할지 선택하세요.</div>
        <button
          className={isAdded ? "btn btnDanger" : "btn"}
          type="button"
          onClick={() => (isAdded ? onDeleteThread(thread.id) : onAddThread(thread))}
          aria-pressed={isAdded}
          title={isAdded ? "현재 대화를 삭제합니다." : "현재 대화를 추가합니다."}
        >
          {isAdded ? "Delete" : "Add"}
        </button>
      </div>
    {isAdded ? (
        <div className="muted" style={{ marginTop: 6 }}>
          이 대화는 저장 목록에 추가되었습니다.
        </div>
      ) : null}

      {/* Header / Meta */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>대화제목: {thread.title ?? "(untitled)"}</div>

        <div className="muted" style={{ marginTop: 6 }}>
          날짜: {fmt(thread.startTime)}
        </div>
      </div>

      <hr style={{ margin: "14px 0" }} />

      {/* Images preview */}
      {hasRenderableImages ? (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>이미지</div>
          <div className="muted" style={{ marginTop: 6 }}>
            
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
                  style={{ width: "100%", display: "block", maxHeight: 260, objectFit: "contain" }}
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
                  {/* {path} */}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : thread.hasImages && !zipManager ? (
        <div className="muted">(ZIP 파일이 아직 업로드되지 않았습니다.)</div>
      ) : thread.hasImages && !hasImagePaths ? null : (
        <div className="muted">(이 대화에는 이미지가 없습니다.)</div>
      )}

    {/* Conversation log */}
      <div style={{ marginTop: 14 }}>
        <hr style={{ margin: "14px 0" }} />

        <div style={{ fontSize: 14, fontWeight: 700 }}>대화 내용</div>
        <div className="muted" style={{ marginTop: 6 }}>
        </div>

        {messages.length > 0 ? (
          <div className="conversationLog">
            {messages.map((msg) => {
              const text = msg.text?.trim();
              const assetCount = msg.assetPointers?.length ?? 0;
              const fallback = assetCount > 0 ? "(Image attached)" : "(No content)";
              const content = text || fallback;
              const html = markdownToHtml(content);

              return (
                <div
                  key={msg.id}
                  className={`conversationMessage ${
                    msg.role === "user" ? "conversationMessageUser" : "conversationMessageAssistant"
                  }`}
                >
                  <div className="conversationRole">
                    {msg.role === "user" ? "User" : "Assistant"}
                  </div>
                  <div className="conversationBody">
                    <div
                      className="conversationText conversationMarkdown"
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
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
            (이 대화에는 대화 내용이 없습니다.)
          </div>
        )}
      </div>
    </div>
  );
}
