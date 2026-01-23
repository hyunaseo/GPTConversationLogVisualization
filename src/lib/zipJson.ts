import { unzipSync, strFromU8 } from "fflate";

export type ZipEntries = Record<string, Uint8Array>;

export async function readZipEntries(file: File): Promise<ZipEntries> {
  const buf = await file.arrayBuffer();
  return unzipSync(new Uint8Array(buf));
}

export function listJsonPaths(entries: ZipEntries): string[] {
  return Object.keys(entries)
    .filter((p) => p.toLowerCase().endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));
}

export function readJsonText(entries: ZipEntries, path: string): string {
  const u8 = entries[path];
  if (!u8) throw new Error(`JSON not found in zip: ${path}`);
  return strFromU8(u8);
}

export function parseJsonSafe(text: string): { ok: true; value: any } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}
