import { unzipSync, strFromU8 } from "fflate";

export type ZipEntries = Record<string, Uint8Array>;

export async function readZipEntries(file: File): Promise<ZipEntries> {
  const buf = await file.arrayBuffer();
  const u8 = new Uint8Array(buf);
  return unzipSync(u8); // { "path/in/zip": Uint8Array, ... }
}

export function findChatHtmlPaths(entries: ZipEntries): string[] {
  return Object.keys(entries).filter((p) => p.toLowerCase().endsWith("/chat.html") || p.toLowerCase().endsWith("chat.html"));
}

export function readText(entries: ZipEntries, path: string): string {
  const data = entries[path];
  if (!data) throw new Error(`File not found in zip: ${path}`);
  return strFromU8(data);
}
