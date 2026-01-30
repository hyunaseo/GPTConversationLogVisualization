type ScanResult = {
  totalConversations: number;
  totalMessagesScanned: number;

  roleCounts: Record<string, number>;
  contentTypeCounts: Record<string, number>;

  conversationsWithImageHints: number;
  conversationsWithAttachmentHints: number;

  // 이미지/첨부로 의심되는 메시지 예시(최대 몇 개)
  examples: Array<{
    conversationIndex: number;
    conversationTitle?: string;
    messageId: string;
    role: string;
    contentType: string;
    hint: "image" | "attachment";
    // 민감 텍스트 없이 구조만 보이도록 content 일부만 잘라서 제공
    contentPreview: unknown;
  }>;
};

function typeOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}
function inc(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

// 텍스트는 제거하고 구조만 남기는 “안전 프리뷰”
function redactDeep(v: unknown, depth = 0): unknown {
  if (depth > 4) return "[[depth_limit]]";
  const t = typeOf(v);
  if (t === "string") {
    // 너무 긴 텍스트는 내용 대신 길이만
    return `[[string len=${v.length}]]`;
  }
  if (t === "number" || t === "boolean" || t === "null") return v;
  if (t === "array") return (v as unknown[]).slice(0, 6).map((x) => redactDeep(x, depth + 1));
  if (t === "object") {
    const o: unknown = {};
    const keys = Object.keys(v).slice(0, 30);
    for (const k of keys) o[k] = redactDeep(v[k], depth + 1);
    return o;
  }
  return `[[${t}]]`;
}

function looksLikeImageFromContent(msgContent: unknown): boolean {
  if (!msgContent) return false;

  const ct = String(msgContent.content_type ?? "").toLowerCase();
  if (ct.includes("image")) return true;
  if (ct.includes("multimodal")) return true;

  // parts 안에 객체가 들어있는 경우가 많음 (예: {content_type:"image_asset_pointer"...})
  const parts = msgContent.parts;
  if (Array.isArray(parts)) {
    for (const p of parts) {
      const pt = typeOf(p);
      if (pt === "object") {
        const pct = String((p as unknown).content_type ?? "").toLowerCase();
        if (pct.includes("image")) return true;
        // 흔한 키워드들(버전별 상이)
        const s = JSON.stringify(p).toLowerCase();
        if (s.includes("image") || s.includes("asset_pointer") || s.includes("file_id") || s.includes("upload")) {
          return true;
        }
      }
      if (pt === "string") {
        const s = (p as string).toLowerCase();
        if (s.includes("data:image/") || s.includes("![")) return true;
      }
    }
  }

  // attachments/assets/files 같은 필드가 있을 수 있음
  if (msgContent.attachments || msgContent.assets || msgContent.files) return true;

  return false;
}

function looksLikeAttachment(msgContent: unknown): boolean {
  if (!msgContent) return false;
  return Boolean(msgContent.attachments || msgContent.assets || msgContent.files);
}

export function scanConversations(conversations: unknown[], maxExamples = 10): ScanResult {
  const roleCounts: Record<string, number> = {};
  const contentTypeCounts: Record<string, number> = {};
  const examples: ScanResult["examples"] = [];

  let totalMessagesScanned = 0;
  let conversationsWithImageHints = 0;
  let conversationsWithAttachmentHints = 0;

  // 성능: 전체 1574개 * mapping 노드 전부 스캔해도 브라우저에서 가능하지만,
  // 일단은 안전하게 전부 돌리되 예시는 maxExamples까지만 수집.
  for (let ci = 0; ci < conversations.length; ci++) {
    const conv = conversations[ci];
    const mapping = conv?.mapping;
    if (!mapping || typeOf(mapping) !== "object") continue;

    let convHasImage = false;
    let convHasAttachment = false;

    for (const nodeId of Object.keys(mapping)) {
      const msg = mapping[nodeId]?.message;
      if (!msg) continue;

      totalMessagesScanned++;

      const role = String(msg?.author?.role ?? "unknown");
      inc(roleCounts, role);

      const content = msg?.content;
      const contentType = String(content?.content_type ?? "unknown");
      inc(contentTypeCounts, contentType);

      const img = looksLikeImageFromContent(content);
      const att = looksLikeAttachment(content);

      if (img) convHasImage = true;
      if (att) convHasAttachment = true;

      if ((img || att) && examples.length < maxExamples) {
        examples.push({
          conversationIndex: ci,
          conversationTitle: conv?.title,
          messageId: String(msg?.id ?? nodeId),
          role,
          contentType,
          hint: att ? "attachment" : "image",
          contentPreview: redactDeep(content),
        });
      }
    }

    if (convHasImage) conversationsWithImageHints++;
    if (convHasAttachment) conversationsWithAttachmentHints++;
  }

  return {
    totalConversations: conversations.length,
    totalMessagesScanned,
    roleCounts,
    contentTypeCounts,
    conversationsWithImageHints,
    conversationsWithAttachmentHints,
    examples,
  };
}
