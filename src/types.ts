export type ChatThread = {
  id: string;
  title?: string;
  startTime?: number;
  endTime?: number;
  hasImages: boolean;
  messageCount: number;
  messages?: ChatMessage[];

  // ✅ 추가
  imageAssetPointers?: string[]; // asset_pointer 리스트
  imagePaths?: string[]; // zip 내부 경로들 (png/jpg/webp)
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt?: number;
  assetPointers?: string[];
};

export type Filters = {
  keyword: string;
  dateFrom: string; // yyyy-mm-dd
  dateTo: string;   // yyyy-mm-dd
  imagesOnly: boolean;
};
