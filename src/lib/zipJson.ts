import { inflateSync, strFromU8 } from "fflate";

export type ZipEntryMeta = {
  path: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

export type ZipArchive = {
  file: File;
  entries: Record<string, ZipEntryMeta>;
};

function readU16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

function findEndOfCentralDirectory(u8: Uint8Array): number {
  // EOCD signature: 0x06054b50
  const min = Math.max(0, u8.length - 0xffff - 22);
  for (let i = u8.length - 22; i >= min; i--) {
    if (u8[i] === 0x50 && u8[i + 1] === 0x4b && u8[i + 2] === 0x05 && u8[i + 3] === 0x06) {
      return i;
    }
  }
  throw new Error("Invalid ZIP: end of central directory not found.");
}

export async function readZipEntries(file: File): Promise<ZipArchive> {
  const tailSize = Math.min(file.size, 0xffff + 22 + 1024);
  const tailBuf = await file.slice(file.size - tailSize, file.size).arrayBuffer();
  const tail = new Uint8Array(tailBuf);
  const eocdOffsetInTail = findEndOfCentralDirectory(tail);
  const eocdView = new DataView(tail.buffer, tail.byteOffset + eocdOffsetInTail, 22);

  const totalEntries = readU16(eocdView, 10);
  const centralDirectorySize = readU32(eocdView, 12);
  const centralDirectoryOffset = readU32(eocdView, 16);

  const cdBuf = await file
    .slice(centralDirectoryOffset, centralDirectoryOffset + centralDirectorySize)
    .arrayBuffer();
  const cd = new Uint8Array(cdBuf);
  const entries: Record<string, ZipEntryMeta> = {};
  const decoder = new TextDecoder();

  let cursor = 0;
  for (let i = 0; i < totalEntries; i++) {
    const view = new DataView(cd.buffer, cd.byteOffset + cursor);
    const sig = readU32(view, 0);
    if (sig !== 0x02014b50) {
      throw new Error(`Invalid ZIP: bad central directory entry at offset ${cursor}.`);
    }

    const compressionMethod = readU16(view, 10);
    const compressedSize = readU32(view, 20);
    const uncompressedSize = readU32(view, 24);
    const fileNameLength = readU16(view, 28);
    const extraLength = readU16(view, 30);
    const commentLength = readU16(view, 32);
    const localHeaderOffset = readU32(view, 42);

    const nameStart = cursor + 46;
    const nameEnd = nameStart + fileNameLength;
    const path = decoder.decode(cd.subarray(nameStart, nameEnd));

    entries[path] = {
      path,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    };

    cursor = nameEnd + extraLength + commentLength;
  }

  return { file, entries };
}

export function listJsonPaths(archive: ZipArchive): string[] {
  return Object.keys(archive.entries)
    .filter((p) => p.toLowerCase().endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));
}

export function listMediaPaths(archive: ZipArchive): string[] {
  return Object.keys(archive.entries).filter((p) => /\.(png|jpe?g|webp)$/i.test(p));
}

async function readCompressedBytes(archive: ZipArchive, meta: ZipEntryMeta): Promise<Uint8Array> {
  const localHeaderBuf = await archive.file
    .slice(meta.localHeaderOffset, meta.localHeaderOffset + 30)
    .arrayBuffer();
  const localHeader = new DataView(localHeaderBuf);
  const sig = readU32(localHeader, 0);
  if (sig !== 0x04034b50) {
    throw new Error(`Invalid ZIP: bad local header for ${meta.path}`);
  }

  const fileNameLength = readU16(localHeader, 26);
  const extraLength = readU16(localHeader, 28);
  const dataStart = meta.localHeaderOffset + 30 + fileNameLength + extraLength;
  const dataEnd = dataStart + meta.compressedSize;
  const buf = await archive.file.slice(dataStart, dataEnd).arrayBuffer();
  return new Uint8Array(buf);
}

export async function readBinaryFile(archive: ZipArchive, path: string): Promise<Uint8Array> {
  const meta = archive.entries[path];
  if (!meta) throw new Error(`File not found in zip: ${path}`);

  const compressed = await readCompressedBytes(archive, meta);
  switch (meta.compressionMethod) {
    case 0:
      return compressed;
    case 8:
      return inflateSync(compressed);
    default:
      throw new Error(`Unsupported ZIP compression method (${meta.compressionMethod}) for ${path}`);
  }
}

export async function readJsonText(archive: ZipArchive, path: string): Promise<string> {
  const u8 = await readBinaryFile(archive, path);
  return strFromU8(u8);
}

export async function createBlobUrlFromPath(archive: ZipArchive, path: string): Promise<string | null> {
  const u8 = await readBinaryFile(archive, path);
  if (!u8) return null;

  const ext = path.toLowerCase().split(".").pop() || "png";
  const mime =
    ext === "jpg" || ext === "jpeg"
      ? "image/jpeg"
      : ext === "webp"
      ? "image/webp"
      : "image/png";

  const blob = new Blob([u8], { type: mime });
  return URL.createObjectURL(blob);
}

export function parseJsonSafe(text: string): { ok: true; value: any } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}
