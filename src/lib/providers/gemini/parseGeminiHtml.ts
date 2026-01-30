export interface GeminiTurn {
  userPrompt: string;
  assistantResponse: string;
  timestamp: number;
  attachedImages: string[];
}

export function parseMyActivityHtml(html: string): GeminiTurn[] {
  console.log(`Parsing Gemini HTML (${(html.length / 1024 / 1024).toFixed(2)}MB)...`);

  // Use regex-based parsing instead of DOMParser to avoid memory issues with large files
  const turns: GeminiTurn[] = [];

  // Match all outer-cell divs
  const outerCellRegex = /<div class="outer-cell[^>]*>([\s\S]*?)<\/div>\s*(?=<div class="outer-cell|$)/g;
  const matches = html.matchAll(outerCellRegex);

  let count = 0;
  let skipped = 0;
  for (const match of matches) {
    try {
      const cellHtml = match[1];
      const turn = parseTurnFromHtml(cellHtml);

      // ONLY include turns that have images (user input images)
      if (turn && turn.attachedImages.length > 0) {
        turns.push(turn);
      } else if (turn) {
        skipped++;
      }

      count++;

      if (count % 500 === 0) {
        console.log(`Parsed ${count} turns (${turns.length} with images, ${skipped} without)...`);
      }
    } catch {
      // Skip invalid turns
    }
  }

  console.log(`Successfully parsed ${turns.length} turns with images (skipped ${skipped} without images)`);
  return turns;
}

function parseTurnFromHtml(html: string): GeminiTurn | null {
  // Extract user prompt (starts with "Prompted ")
  const promptMatch = html.match(/Prompted\s+([^\n<]+)/);
  if (!promptMatch) return null;

  const userPrompt = promptMatch[1].trim();

  // Extract timestamp (e.g., "Jan 28, 2026, 4:13:48 PM KST")
  const timestamp = parseGeminiTimestamp(html);

  // Extract assistant response (text within <p> tags)
  const assistantResponse = extractTextFromHtml(html);

  // Extract images
  const attachedImages = extractImageReferencesFromHtml(html);

  return {
    userPrompt,
    assistantResponse,
    timestamp,
    attachedImages,
  };
}

function extractTextFromHtml(html: string): string {
  // Extract text from paragraph tags
  const pTagRegex = /<p[^>]*>([\s\S]*?)<\/p>/g;
  const matches = html.matchAll(pTagRegex);

  const textParts: string[] = [];
  for (const match of matches) {
    // Strip HTML tags and decode entities
    const text = match[1]
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .trim();

    if (text && text.length > 0) {
      textParts.push(text);
    }
  }

  return textParts.join("\n\n");
}

export function parseGeminiTimestamp(text: string): number {
  // Match pattern like "Jan 28, 2026, 4:13:48 PM KST"
  const match = text.match(
    /([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4},\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M)\s+[A-Z]{3}/
  );

  if (!match) {
    return Date.now();
  }

  try {
    // Parse the date string (without timezone)
    const dateStr = match[1];
    const parsed = new Date(dateStr);

    if (isNaN(parsed.getTime())) {
      return Date.now();
    }

    return parsed.getTime();
  } catch {
    return Date.now();
  }
}

function extractImageReferencesFromHtml(html: string): string[] {
  const images: string[] = [];

  // Extract from <img src="..."> tags
  const imgRegex = /<img[^>]+src="([^"]+)"/g;
  const imgMatches = html.matchAll(imgRegex);
  for (const match of imgMatches) {
    const src = match[1];
    if (src && !src.startsWith("http")) {
      images.push(src);
    }
  }

  // Extract from <a href="..."> tags (image file links)
  const linkRegex = /<a[^>]+href="([^"]+\.(?:png|jpe?g|webp|gif))"/gi;
  const linkMatches = html.matchAll(linkRegex);
  for (const match of linkMatches) {
    images.push(match[1]);
  }

  // Deduplicate
  return Array.from(new Set(images));
}
