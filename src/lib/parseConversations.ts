import type { ChatThread, ChatMessage } from "../types";

function typeOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function getImageAssetPointersFromMessageContent(content: unknown): string[] {
  const out: string[] = [];
  if (!content) return out;

  const parts = (content as { parts: unknown[] }).parts;
  if (!Array.isArray(parts)) return out;

  for (const p of parts) {
    if (typeOf(p) === "object" && p) {
      const ap = (p as { asset_pointer: string }).asset_pointer;
      if (typeof ap === "string" && ap.length > 0) out.push(ap);
    }
  }
  return out;
}

function extractTextFromContent(content: unknown): string {
  if (!content) return "";
  if (typeof (content as { text: string })?.text === "string") return (content as { text: string }).text;

  const parts = (content as { parts: unknown[] }).parts;
  if (!Array.isArray(parts)) return "";

  const texts: string[] = [];
  for (const p of parts) {
    if (typeof p === "string") {
      texts.push(p);
    } else if (p && typeof p === "object" && typeof (p as { text: string }).text === "string") {
      texts.push((p as { text: string }).text);
    }
  }
  return texts.join("\n").trim();
}

export function parseConversationsToThreads(conversations: unknown[]): ChatThread[] {
  const threads: ChatThread[] = [];

  for (const conv of conversations) {
    const mapping = (conv as { mapping: Record<string, unknown> })?.mapping;
    if (!mapping || typeOf(mapping) !== "object") continue;

    let messageCount = 0;
    let hasImages = false;
    const assetPointers: string[] = [];
    const messages: Array<{ msg: ChatMessage; order: number }> = [];

    for (const nodeId of Object.keys(mapping)) {
      const msg = (mapping[nodeId] as { message: unknown })?.message;
      if (!msg) continue;

      messageCount++;

      const content = (msg as { content: unknown })?.content;
      const contentType = String((content as { content_type: string })?.content_type ?? "");

      // 핵심: multimodal_text에서 asset_pointer 추출
      if (contentType === "multimodal_text") {
        const aps = getImageAssetPointersFromMessageContent(content);
        if (aps.length > 0) {
          hasImages = true;
          assetPointers.push(...aps);
        }
      }

      const role = String(((msg as { author: { role: string } })?.author)?.role ?? "");
      if (role === "user" || role === "assistant") {
        const text = extractTextFromContent(content);
        const messageAssetPointers =
          contentType === "multimodal_text" ? getImageAssetPointersFromMessageContent(content) : [];

        messages.push({
          msg: {
            id: String((msg as { id: string })?.id ?? nodeId),
            role,
            text,
            createdAt: typeof (msg as { create_time: number })?.create_time === "number" ? (msg as { create_time: number }).create_time * 1000 : undefined,
            assetPointers: messageAssetPointers.length ? messageAssetPointers : undefined,
          },
          order: messages.length,
        });
      }
    }

    // dedup
    const uniquePointers = Array.from(new Set(assetPointers));

    const sortedMessages = messages.some((item) => item.msg.createdAt)
      ? [...messages].sort((a, b) => {
          const ta = a.msg.createdAt ?? 0;
          const tb = b.msg.createdAt ?? 0;
          if (ta !== tb) return ta - tb;
          return a.order - b.order;
        })
      : messages;

    threads.push({
      id: String((conv as { id: string })?.id ?? (conv as { conversation_id: string })?.conversation_id ?? ""),
      title: (conv as { title: string })?.title ?? "(untitled)",
      startTime: typeof (conv as { create_time: number })?.create_time === "number" ? (conv as { create_time: number }).create_time * 1000 : undefined,
      endTime: typeof (conv as { update_time: number })?.update_time === "number" ? (conv as { update_time: number }).update_time * 1000 : undefined,
      hasImages,
      messageCount,
      messages: sortedMessages.length ? sortedMessages.map((item) => item.msg) : undefined,
      imageAssetPointers: uniquePointers.length ? uniquePointers : undefined,
    });
  }

  // 최신순 정렬(원하면 반대로)
  threads.sort((a, b) => (b.endTime ?? 0) - (a.endTime ?? 0));

  return threads;
}
