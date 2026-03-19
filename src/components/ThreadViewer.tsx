import * as React from "react";
import type { ChatThread } from "../types";
import { createBlobUrlFromPath, type ZipArchive } from "../lib/zipJson";

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
  thread: ChatThread | null;
  archive: ZipArchive | null;
  onAddThread: (thread: ChatThread) => void;
  onDeleteThread: (threadId: string) => void;
  isAdded: boolean;
};

export function ThreadViewer({ thread, archive, onAddThread, onDeleteThread, isAdded }: Props) {
  const [thumbUrls, setThumbUrls] = React.useState<Array<{ path: string; url: string }>>([]);

  React.useEffect(() => {
    let cancelled = false;
    const previous = [...thumbUrls];
    for (const t of previous) URL.revokeObjectURL(t.url);
    setThumbUrls([]);

    if (!thread || !archive) return;

    const paths = thread.imagePaths ?? [];
    if (paths.length === 0) return;

    const load = async () => {
      const next: Array<{ path: string; url: string }> = [];
      for (const p of paths.slice(0, 12)) {
        try {
          const url = await createBlobUrlFromPath(archive, p);
          if (url) next.push({ path: p, url });
        } catch (e) {
          console.warn("Failed to load viewer image:", p, e);
        }
      }
      if (cancelled) {
        for (const t of next) URL.revokeObjectURL(t.url);
        return;
      }
      setThumbUrls(next);
    };

    void load();

    return () => {
      cancelled = true;
      for (const t of previous) URL.revokeObjectURL(t.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.id, archive]);

  if (!thread) {
    return (
      <div className="card" style={{ height: "100%" }}>
        <div className="title">Step 3. Review the image and conversation, then choose whether to add them to the dataset.</div>
        <div className="muted" style={{ marginTop: 10 }}>
          Select a conversation from the left.
        </div>
      </div>
    );
  }

  const imagePathCount = thread.imagePaths?.length ?? 0;
  const messages = thread.messages ?? [];
  const hasImagePaths = imagePathCount > 0;
  const hasRenderableImages = Boolean(archive) && thumbUrls.length > 0;

  return (
    <div className="card" style={{ height: "100%" }}>
      <div className="row">
        <div className="title">Step 3. Review the image and conversation, then choose whether to add them to the dataset.</div>
        <button
          className={isAdded ? "btn btnDanger" : "btn"}
          type="button"
          onClick={() => (isAdded ? onDeleteThread(thread.id) : onAddThread(thread))}
          aria-pressed={isAdded}
          title={isAdded ? "Delete current conversation" : "Add current conversation"}
        >
          {isAdded ? "Delete" : "Add"}
        </button>
      </div>
      {isAdded ? (
        <div className="muted" style={{ marginTop: 6 }}>
          This conversation is added to the dataset.
        </div>
      ) : null}

      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Conversation title: {thread.title ?? "(untitled)"}</div>

        <div className="muted" style={{ marginTop: 6 }}>
          Date: {fmt(thread.startTime)}
        </div>
      </div>

      <hr style={{ margin: "14px 0" }} />

      {hasRenderableImages ? (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Images</div>
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
                />
              </div>
            ))}
          </div>
        </div>
      ) : thread.hasImages && !archive ? (
        <div className="muted">(The ZIP file has not been uploaded yet.)</div>
      ) : thread.hasImages && !hasImagePaths ? null : (
        <div className="muted">(This conversation has no images.)</div>
      )}

      <div style={{ marginTop: 14 }}>
        <hr style={{ margin: "14px 0" }} />

        <div style={{ fontSize: 14, fontWeight: 700 }}>Conversation content</div>
        <div className="muted" style={{ marginTop: 6 }}>
          {messages.length} messages
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {messages.map((m) => (
            <div key={m.id} style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                {m.role === "user" ? "User" : "ChatGPT"}
              </div>
              <div dangerouslySetInnerHTML={{ __html: markdownToHtml(m.text || "") }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
