import type { ChatProvider, ParseResult, ChatThread } from "../../../types";
import * as GeminiParser from "./parseGeminiHtml";
import { listMediaPaths } from "../../resolveAssets";
import type { ZipManager } from "../../ZipManager";

export class GeminiProvider implements ChatProvider {
  async parse(manager: ZipManager): Promise<ParseResult> {
    try {
      // Find the MyActivity.html file
      const entries = await manager.getEntries();
      const geminiPattern = /Takeout\/My Activity\/Gemini Apps\/MyActivity\.html/i;
      const htmlEntry = entries.find((e) => geminiPattern.test(e.filename));

      if (!htmlEntry) {
        throw new Error("Gemini MyActivity.html not found in ZIP");
      }

      console.log(`Reading ${htmlEntry.filename}...`);

      // Read HTML file
      let html = await manager.readText(htmlEntry.filename);
      console.log(`HTML decoded: ${(html.length / 1024 / 1024).toFixed(2)}MB`);

      // Parse HTML to extract turns
      const turns = GeminiParser.parseMyActivityHtml(html);

      // Clear HTML from memory immediately after parsing
      html = "";

      if (turns.length === 0) {
        console.warn("No conversation turns found in Gemini export");
      }

      const threads: ChatThread[] = turns
        .filter((turn: GeminiParser.GeminiTurn) => turn.attachedImages.length > 0)
        .map((turn: GeminiParser.GeminiTurn, index: number) => {
          const id = `gemini-${turn.timestamp}-${index}`;
          const title = turn.userPrompt.substring(0, 50) + "...";

          return {
            id,
            title,
            startTime: turn.timestamp,
            endTime: turn.timestamp,
            hasImages: true,
            messageCount: 2,
            messages: [
              {
                id: `${id}-user`,
                role: "user",
                text: turn.userPrompt,
                createdAt: turn.timestamp,
                assetPointers: turn.attachedImages,
              },
              {
                id: `${id}-assistant`,
                role: "assistant",
                text: turn.assistantResponse,
                createdAt: turn.timestamp,
              },
            ],
            imageAssetPointers: turn.attachedImages,
            provider: "gemini" as const,
          };
        });

      // Build synthetic conversation lookup for download functionality
      const conversationLookup: Record<string, unknown> = {};
      for (const thread of threads) {
        conversationLookup[thread.id] = {
          id: thread.id,
          title: thread.title,
          provider: "gemini",
          create_time: thread.startTime,
          update_time: thread.endTime,
          messages: thread.messages,
        };
      }

      return { threads, conversationLookup };
    } catch (error) {
      console.error("Gemini parsing error:", error);
      throw new Error(
        `Failed to parse Gemini export: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async resolveAssets(
    threads: ChatThread[],
    manager: ZipManager
  ): Promise<ChatThread[]> {
    console.log("Resolving Gemini image assets...");
    const allPaths = (await manager.getEntries()).map((e) => e.filename);
    const mediaPaths = listMediaPaths(allPaths);
    console.log(`Found ${mediaPaths.length} image files in ZIP`);

    // Build lookup map for O(1) access instead of O(n) find operations
    const filenameToPath = new Map<string, string>();
    for (const path of mediaPaths) {
      const filename = path.split("/").pop()?.toLowerCase();
      if (filename) {
        filenameToPath.set(filename, path);
      }
    }

    let resolvedCount = 0;

    const result = threads.map((t) => {
      const imageRefs = t.imageAssetPointers ?? [];
      if (imageRefs.length === 0) {
        return { ...t, provider: "gemini" as const };
      }

      // Match image references using the lookup map
      const resolvedPaths: string[] = [];
      for (const ref of imageRefs) {
        const normalized = ref.toLowerCase();
        const path = filenameToPath.get(normalized);
        if (path) {
          resolvedPaths.push(path);
          resolvedCount++;
        }
      }

      const unique = Array.from(new Set(resolvedPaths));

      return {
        ...t,
        imagePaths: unique.length ? unique : undefined,
        provider: "gemini" as const,
      };
    });

    console.log(`Resolved ${resolvedCount} image references`);

    return result;
  }
}
