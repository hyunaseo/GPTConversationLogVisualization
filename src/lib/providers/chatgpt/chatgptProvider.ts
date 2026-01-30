import type { ChatProvider, ParseResult, ChatThread } from "../../../types";
import type { ZipManager } from "../../ZipManager";
import { parseConversationsToThreads } from "../../parseConversations";
import { listMediaPaths, resolveAssetPointerToPath } from "../../resolveAssets";

export class ChatGPTProvider implements ChatProvider {
  async parse(manager: ZipManager): Promise<ParseResult> {
    const entries = await manager.getEntries();
    const jsonPaths = entries
      .map((e) => e.filename)
      .filter((p) => p.toLowerCase().endsWith(".json"));

    if (jsonPaths.length === 0) {
      throw new Error("No .json files found in ZIP");
    }

    // Prefer files with "conversations" in the name
    const preferred =
      jsonPaths.find((p) => p.toLowerCase().includes("conversations")) ??
      jsonPaths[0];

    const text = await manager.readText(preferred);
    const conversationsArray = JSON.parse(text);

    // Build lookup for download functionality
    const conversationLookup: Record<string, unknown> = {};
    for (const conv of conversationsArray) {
      const id = String(conv?.id ?? conv?.conversation_id ?? "");
      if (id) conversationLookup[id] = conv;
    }

    const threads = parseConversationsToThreads(conversationsArray);

    return { threads, conversationLookup };
  }

  async resolveAssets(
    threads: ChatThread[],
    manager: ZipManager
  ): Promise<ChatThread[]> {
    const entries = await manager.getEntries();
    const mediaPaths = listMediaPaths(entries.map((e) => e.filename));

    return threads.map((t) => {
      const pointers = t.imageAssetPointers ?? [];
      if (pointers.length === 0) return { ...t, provider: "chatgpt" as const };

      const resolved = pointers
        .map((ap) => resolveAssetPointerToPath(ap, mediaPaths))
        .filter((p): p is string => Boolean(p));

      const unique = Array.from(new Set(resolved));

      return {
        ...t,
        imagePaths: unique.length ? unique : undefined,
        provider: "chatgpt" as const,
      };
    });
  }
}
