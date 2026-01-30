import * as zip from "@zip.js/zip.js";

const MimeTypes: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  png: "image/png",
};

export class ZipManager {
  private zipReader: zip.ZipReader;
  private entries: zip.Entry[] | null = null;

  constructor(blob: Blob) {
    const reader = new zip.BlobReader(blob);
    this.zipReader = new zip.ZipReader(reader);
  }

  async getEntries(): Promise<zip.Entry[]> {
    if (!this.entries) {
      this.entries = await this.zipReader.getEntries();
    }
    return this.entries;
  }

  async readText(filename: string): Promise<string> {
    const entries = await this.getEntries();
    const entry = entries.find((e) => e.filename === filename);
    if (!entry) throw new Error(`File not found in zip: ${filename}`);
    return await entry.getData(new zip.TextWriter());
  }

  async readBlobUrl(filename: string): Promise<string | null> {
    const entries = await this.getEntries();
    const entry = entries.find((e) => e.filename === filename);
    if (!entry) {
      console.warn(`Image file not found in zip: ${filename}`);
      return null;
    }

    const ext = filename.toLowerCase().split(".").pop() || "png";
    const mime = MimeTypes[ext] || "application/octet-stream";

    const blob = await entry.getData(new zip.BlobWriter(mime));
    return URL.createObjectURL(blob);
  }

  async close(): Promise<void> {
    await this.zipReader.close();
  }
}