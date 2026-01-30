type Summary = {
  filePath: string;
  topLevelType: string;
  isArray: boolean;
  length?: number;

  sampleKeys?: string[];
  looksLikeConversations?: boolean;

  conversationTitle?: string;
  conversationCreate?: number | null;
  conversationUpdate?: number | null;

  mappingNodeCount?: number;
  messageCount?: number;

  roleCounts?: Record<string, number>;
  contentTypeCounts?: Record<string, number>;

  // 이미지/첨부 "가능성"만 우선 추정
  imageHintCount?: number;
  attachmentHintCount?: number;

  notes: string[];
};

function typeOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v; // object, string, number, boolean, undefined
}

function inc(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

export function summarizeMaybeConversationsJson(filePath: string, json: unknown): Summary {
  const notes: string[] = [];
  const top = typeOf(json);

  const out: Summary = {
    filePath,
    topLevelType: top,
    isArray: Array.isArray(json),
    length: Array.isArray(json) ? json.length : undefined,
    notes,
  };

  if (!Array.isArray(json)) {
    notes.push("Top-level is not an array. This might not be conversations export.");
    if (top === "object") out.sampleKeys = Object.keys(json).slice(0, 40);
    return out;
  }

  if (json.length === 0) {
    notes.push("Array is empty.");
    return out;
  }

  const c0 = json[0];
  if (typeOf(c0) !== "object") {
    notes.push("Array item is not an object.");
    return out;
  }

  const keys = Object.keys(c0);
  out.sampleKeys = keys.slice(0, 60);

  // heuristics
  const looks = keys.includes("mapping") && (keys.includes("title") || keys.includes("create_time") || keys.includes("update_time"));
  out.looksLikeConversations = looks;

  if (!looks) {
    notes.push("First item doesn't look like {title, create_time, update_time, mapping} conversation.");
    return out;
  }

  out.conversationTitle = c0.title;
  out.conversationCreate = c0.create_time ?? null;
  out.conversationUpdate = c0.update_time ?? null;

  const mapping = c0.mapping;
  if (typeOf(mapping) !== "object" || mapping === null) {
    notes.push("mapping is missing or not an object.");
    return out;
  }

  const nodeIds = Object.keys(mapping);
  out.mappingNodeCount = nodeIds.length;

  const roleCounts: Record<string, number> = {};
  const contentTypeCounts: Record<string, number> = {};
  let messageCount = 0;
  let imageHintCount = 0;
  let attachmentHintCount = 0;

  // 많이 크면 5천 노드까지만 샘플링
  const MAX_NODES = 5000;
  const idsToScan = nodeIds.slice(0, MAX_NODES);

  for (const id of idsToScan) {
    const node = mapping[id];
    const msg = node?.message;
    if (!msg) continue;

    messageCount++;

    const role = msg?.author?.role ?? "unknown";
    inc(roleCounts, String(role));

    const contentType = msg?.content?.content_type ?? "unknown";
    inc(contentTypeCounts, String(contentType));

    // image/attachment hint (export 버전별로 다름)
    // - content.parts 안에 markdown 이미지가 있을 수도 있고
    // - content.attachments / content.assets / content.media 같은 필드가 있을 수도 있음
    const content = msg?.content ?? {};
    const parts = Array.isArray(content.parts) ? content.parts : [];
    const partsText = parts.join("\n");

    if (/!\[.*\]\(.*\)/.test(partsText) || /<img\s/i.test(partsText)) imageHintCount++;

    if (content?.attachments || content?.assets || content?.files) attachmentHintCount++;

    // 어떤 버전은 content_type이 "image" / "multimodal_text" 등으로 들어올 수 있음
    if (String(contentType).toLowerCase().includes("image")) imageHintCount++;
  }

  out.messageCount = messageCount;
  out.roleCounts = roleCounts;
  out.contentTypeCounts = contentTypeCounts;
  out.imageHintCount = imageHintCount;
  out.attachmentHintCount = attachmentHintCount;

  if (nodeIds.length > MAX_NODES) {
    notes.push(`Scanned first ${MAX_NODES} mapping nodes out of ${nodeIds.length} (sampling).`);
  }

  return out;
}
