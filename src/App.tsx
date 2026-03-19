import * as React from "react";
import { strToU8, zipSync } from "fflate";
import "./styles.css";
import type { Filters, ChatThread, SavedThread } from "./types";
import { mockThreads } from "./lib/mock";
import { ZipImport } from "./components/ZipImport";
import { ThreadList } from "./components/ThreadList";
import { ThreadViewer } from "./components/ThreadViewer";
import {
  readZipEntries,
  listJsonPaths,
  readJsonText,
  readBinaryFile,
  parseJsonSafe,
  listMediaPaths,
  type ZipArchive,
} from "./lib/zipJson";
import { summarizeMaybeConversationsJson } from "./lib/summarizeConversationsJson";
import { JsonInspector } from "./components/JsonInspector";
import { scanConversations } from "./lib/scanConversations";
import { parseConversationsToThreads } from "./lib/parseConversations";
import { resolveAssetPointerToPath } from "./lib/resolveAssets";
import { SavedThreadGrid } from "./components/SavedThreadGrid";

const defaultFilters: Filters = {
  keyword: "",
  dateFrom: "",
  dateTo: "",
  imagesOnly: true,
};

function applyFilters(threads: ChatThread[], f: Filters, hasZipArchive: boolean) {
  return threads.filter((t) => {
    if (f.imagesOnly) {
      if (!t.hasImages) return false;
      if (hasZipArchive && (t.imagePaths?.length ?? 0) === 0) return false;
    }

    if (f.keyword.trim()) {
      const kw = f.keyword.trim().toLowerCase();
      const hay = (t.title ?? "").toLowerCase();
      if (!hay.includes(kw)) return false;
    }

    if (f.dateFrom) {
      const from = Date.parse(f.dateFrom + "T00:00:00");
      if ((t.startTime ?? 0) < from) return false;
    }
    if (f.dateTo) {
      const to = Date.parse(f.dateTo + "T23:59:59");
      if ((t.endTime ?? 0) > to) return false;
    }

    return true;
  });
}

export default function App() {
  const [zipFile, setZipFile] = React.useState<File | null>(null);
  const [zipArchive, setZipArchive] = React.useState<ZipArchive | null>(null);

  const [status, setStatus] = React.useState<string>("");
  const [filters, _setFilters] = React.useState<Filters>(defaultFilters);
  const [jsonSummary, setJsonSummary] = React.useState<string>("");

  const [threads, setThreads] = React.useState<ChatThread[]>(mockThreads);
  const [savedThreads, setSavedThreads] = React.useState<SavedThread[]>([]);
  const [conversationLookup, setConversationLookup] = React.useState<Record<string, any>>({});

  const savedImageCount = React.useMemo(
    () =>
      savedThreads.reduce(
        (acc, thread) =>
          acc +
          (thread.imagePaths?.length ??
            thread.imageAssetPointers?.length ??
            0),
        0
      ),
    [savedThreads]
  );

  const addThreadToSaved = React.useCallback((thread: ChatThread) => {
    setSavedThreads((prev) => {
      if (prev.some((saved) => saved.id === thread.id)) return prev;
      const snapshot: SavedThread = {
        ...thread,
        messages: thread.messages ? [...thread.messages] : undefined,
        imageAssetPointers: thread.imageAssetPointers
          ? [...thread.imageAssetPointers]
          : undefined,
        imagePaths: thread.imagePaths ? [...thread.imagePaths] : undefined,
        savedAt: Date.now(),
      };
      return [snapshot, ...prev];
    });
  }, []);

  const removeThreadFromSaved = React.useCallback((threadId: string) => {
    setSavedThreads((prev) => prev.filter((saved) => saved.id !== threadId));
  }, []);

  const filtered = React.useMemo(
    () => applyFilters(threads, filters, Boolean(zipArchive)),
    [threads, filters, zipArchive]
  );

  const [selectedId, setSelectedId] = React.useState<string | null>(filtered[0]?.id ?? null);

  React.useEffect(() => {
    if (selectedId && filtered.some((t) => t.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  const selected = React.useMemo(
    () => filtered.find((t) => t.id === selectedId) ?? null,
    [filtered, selectedId]
  );

  const selectedIsSaved = React.useMemo(
    () => (selected ? savedThreads.some((saved) => saved.id === selected.id) : false),
    [savedThreads, selected]
  );

  const downloadSavedConversations = React.useCallback(async () => {
    const payload = savedThreads
      .map((thread) => {
        const conversation = conversationLookup[thread.id];
        if (!conversation) return null;

        const imagePaths = thread.imagePaths ?? [];
        const exportImagePaths = imagePaths.map((path) => `images/${path}`);
        return {
          ...conversation,
          image_paths: exportImagePaths.length ? exportImagePaths : undefined,
          image_asset_pointers: thread.imageAssetPointers?.length
            ? [...thread.imageAssetPointers]
            : undefined,
        };
      })
      .filter(Boolean);

    if (payload.length === 0) return;
    const dateStamp = new Date().toISOString().slice(0, 10);

    const imageEntries: Record<string, Uint8Array> = {};
    if (zipArchive) {
      const uniquePaths = new Set(
        savedThreads.flatMap((thread) => thread.imagePaths ?? [])
      );
      for (const path of uniquePaths) {
        try {
          const data = await readBinaryFile(zipArchive, path);
          imageEntries[`images/${path}`] = data;
        } catch (e) {
          console.warn("Failed to export image from zip:", path, e);
        }
      }
    }

    const anchor = document.createElement("a");
    let blob: Blob;
    if (Object.keys(imageEntries).length > 0) {
      const jsonName = `saved-conversations-${dateStamp}.json`;
      const zipData = zipSync({
        [jsonName]: strToU8(JSON.stringify(payload, null, 2)),
        ...imageEntries,
      });
      const zipArray = new Uint8Array(zipData);
      blob = new Blob([zipArray.buffer], { type: "application/zip" });
      anchor.download = `saved-conversations-${dateStamp}.zip`;
    } else {
      blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      anchor.download = `saved-conversations-${dateStamp}.json`;
    }

    const url = URL.createObjectURL(blob);
    anchor.href = url;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [conversationLookup, savedThreads, zipArchive]);

  async function onZipSelected(file: File) {
    setZipFile(file);
    setStatus("Reading ZIP index...");
    setJsonSummary("");
    setZipArchive(null);
    setConversationLookup({});

    try {
      const archive = await readZipEntries(file);
      setZipArchive(archive);

      const jsonPaths = listJsonPaths(archive);
      if (jsonPaths.length === 0) {
        setStatus("No .json files found inside the ZIP.");
        return;
      }

      const preferred =
        jsonPaths.find((p) => p.toLowerCase().includes("conversations")) ?? jsonPaths[0];

      setStatus(`Reading ${preferred}...`);
      const text = await readJsonText(archive, preferred);
      const parsed = parseJsonSafe(text);

      if (!parsed.ok) {
        setStatus("JSON parsing failed");
        setJsonSummary(
          `File: ${preferred}\nJSON.parse error: ${parsed.error}\n\nFirst 2000 chars:\n${text.slice(0, 2000)}`
        );
        return;
      }

      const conversationsArray = Array.isArray(parsed.value) ? parsed.value : [];
      const lookup: Record<string, any> = {};
      for (const conv of conversationsArray) {
        const id = String(conv?.id ?? conv?.conversation_id ?? "");
        if (id) lookup[id] = conv;
      }
      setConversationLookup(lookup);

      const threadsFromJson = parseConversationsToThreads(conversationsArray);
      const mediaPaths = listMediaPaths(archive);
      if (import.meta.env.DEV) {
        console.log("mediaPaths:", mediaPaths.length, mediaPaths.slice(0, 30));
      }

      const threadsWithPaths: ChatThread[] = threadsFromJson.map((t) => {
        const pointers = t.imageAssetPointers ?? [];
        if (pointers.length === 0) return t;

        const resolved = pointers
          .map((ap) => resolveAssetPointerToPath(ap, mediaPaths))
          .filter((p): p is string => Boolean(p));

        const unique = Array.from(new Set(resolved));
        return {
          ...t,
          imagePaths: unique.length ? unique : undefined,
        };
      });

      setThreads(threadsWithPaths);

      const imgThreadCount = threadsWithPaths.filter((t) => t.hasImages).length;
      const mappedImgCount = threadsWithPaths.reduce((acc, t) => acc + (t.imagePaths?.length ?? 0), 0);

      if (import.meta.env.DEV) {
        const summary = summarizeMaybeConversationsJson(preferred, parsed.value);
        const scan = scanConversations(parsed.value, 10);

        setStatus(
          `Done: ${threadsWithPaths.length} conversations (${imgThreadCount} with images) · ${mappedImgCount} images mapped`
        );
        setJsonSummary(
          [
            `JSON files found (${jsonPaths.length}):`,
            ...jsonPaths.slice(0, 50).map((p) => `- ${p}`),
            jsonPaths.length > 50 ? `... (+${jsonPaths.length - 50} more)` : "",
            "",
            "=== Summary (first conversation) ===",
            JSON.stringify(summary, null, 2),
            "",
            "=== Scan (all conversations) ===",
            JSON.stringify(scan, null, 2),
          ]
            .filter(Boolean)
            .join("\n")
        );
      } else {
        setStatus(
          `Done: ${threadsWithPaths.length} conversations (${imgThreadCount} with images) · ${mappedImgCount} images mapped`
        );
        setJsonSummary("");
      }
    } catch (e: any) {
      console.error(e);
      setStatus(`Error: ${e?.message ?? String(e)}`);
    }
  }

  return (
    <div className="page">
      <header className="header">
        <div>
          <div className="h1">Data Collection for Project NoonChi</div>
          <div className="muted">
            All data processing happens only on the participant&apos;s personal device, and no information is ever transmitted externally.
          </div>
        </div>
      </header>

      <main className="layout">
        <section className="tips">
          <aside className="card tipsCard">
            <div className="tipsTitle">Tips!<br /><br /></div>
            <p className="tipsLead">
              For the purposes of this experiment, the following images are <span className="tipsEm">not elligible</span> for collection:
            </p>
            <ul className="tipsList">
              <li>Images generated by ChatGPT</li>
              <li>Screenhots (e.g., coding-related queries)</li>
              <li>Images with exposed personal information (e.g., resident registration numbers)<br /><br /></li>
            </ul>
            <p className="tipsLead">For diverse discussions, images from various contexts are preferred.</p>
            <ul className="tipsList">
              <li>
                It would be problematic if all of the data were about the same kind of content, or only supported simple questions like &quot;What is that?&quot;
              </li>
            </ul>
          </aside>
        </section>

        <section className="top">
          <ZipImport
            onZipSelected={onZipSelected}
            zipName={zipFile?.name ?? null}
            status={status}
          />
        </section>

        <section className="left">
          <ThreadList
            threads={filtered}
            selectedId={selectedId}
            onSelect={setSelectedId}
            archive={zipArchive}
            imagesOnly={filters.imagesOnly}
          />
          <div className="card savedCard">
            <div className="title">Step 4. Review and download the saved conversations.</div>
            <div className="muted" style={{ marginTop: 6 }}>
              {savedThreads.length} Saved
            </div>
            {savedThreads.length > 0 ? (
              <SavedThreadGrid
                savedThreads={savedThreads}
                selectedId={selectedId}
                onSelect={setSelectedId}
                archive={zipArchive}
              />
            ) : null}
            <div className="muted" style={{ marginTop: 10 }}>
              {savedThreads.length === 0
                ? "Click the Add button in Step 3 to save."
                : savedThreads.length < 10
                ? "Add 10 or more conversations."
                : "Download the conversations."}
            </div>
            {savedImageCount > 0 ? (
              <div className="savedActions">
                <button
                  className="btn savedDownloadBtn"
                  type="button"
                  onClick={() => void downloadSavedConversations()}
                >
                  Download
                </button>
              </div>
            ) : null}
          </div>
        </section>

        <section className="right">
          <ThreadViewer
            thread={selected}
            archive={zipArchive}
            onAddThread={addThreadToSaved}
            onDeleteThread={removeThreadFromSaved}
            isAdded={selectedIsSaved}
          />
        </section>
      </main>
    </div>
  );
}
