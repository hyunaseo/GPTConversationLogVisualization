import type { ChatThread } from "../types";

function typeOf(v: any): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function getImageAssetPointersFromMessageContent(content: any): string[] {
  const out: string[] = [];
  if (!content) return out;

  const parts = content.parts;
  if (!Array.isArray(parts)) return out;

  for (const p of parts) {
    if (typeOf(p) === "object" && p) {
      const ap = (p as any).asset_pointer;
      if (typeof ap === "string" && ap.length > 0) out.push(ap);
    }
  }
  return out;
}

export function parseConversationsToThreads(conversations: any[]): ChatThread[] {
  const threads: ChatThread[] = [];

  for (const conv of conversations) {
    const mapping = conv?.mapping;
    if (!mapping || typeOf(mapping) !== "object") continue;

    let messageCount = 0;
    let hasImages = false;
    const assetPointers: string[] = [];

    for (const nodeId of Object.keys(mapping)) {
      const msg = mapping[nodeId]?.message;
      if (!msg) continue;

      messageCount++;

      const content = msg?.content;
      const contentType = String(content?.content_type ?? "");

      // 핵심: multimodal_text에서 asset_pointer 추출
      if (contentType === "multimodal_text") {
        const aps = getImageAssetPointersFromMessageContent(content);
        if (aps.length > 0) {
          hasImages = true;
          assetPointers.push(...aps);
        }
      }
    }

    // dedup
    const uniquePointers = Array.from(new Set(assetPointers));

    threads.push({
      id: String(conv?.id ?? conv?.conversation_id ?? ""),
      title: conv?.title ?? "(untitled)",
      startTime: typeof conv?.create_time === "number" ? conv.create_time * 1000 : undefined,
      endTime: typeof conv?.update_time === "number" ? conv.update_time * 1000 : undefined,
      hasImages,
      messageCount,
      imageAssetPointers: uniquePointers.length ? uniquePointers : undefined,
    });
  }

  // 최신순 정렬(원하면 반대로)
  threads.sort((a, b) => (b.endTime ?? 0) - (a.endTime ?? 0));

  return threads;
}
