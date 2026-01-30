// Quick test script to verify Gemini parsing logic
import { readFileSync } from 'fs';
import { unzipSync } from 'fflate';

const zipPath = '/Users/junheekim/Desktop/Noonchi/takeout-20260129T061351Z-3-001.zip';

console.log('Reading ZIP file...');
const zipData = readFileSync(zipPath);
const unzipped = unzipSync(new Uint8Array(zipData));

console.log('\nFiles in ZIP:');
const files = Object.keys(unzipped);
console.log(`Total files: ${files.length}`);

const htmlFile = files.find(f => /MyActivity\.html$/i.test(f));
console.log(`\nHTML file found: ${htmlFile}`);

if (htmlFile) {
  const htmlBytes = unzipped[htmlFile];
  const decoder = new TextDecoder('utf-8');
  const html = decoder.decode(htmlBytes);

  console.log(`\nHTML file size: ${html.length} characters`);

  // Count conversation blocks
  const outerCells = html.match(/<div class="outer-cell[^>]*>/g);
  console.log(`Number of conversation turns: ${outerCells ? outerCells.length : 0}`);

  // Count images
  const images = files.filter(f => /\.(png|jpe?g|webp)$/i.test(f));
  console.log(`Number of image files: ${images.length}`);

  // Sample first few image names
  console.log(`\nSample image files:`);
  images.slice(0, 5).forEach(img => console.log(`  - ${img}`));
}
