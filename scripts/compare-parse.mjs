import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDocument, Util } from 'pdfjs-dist/legacy/build/pdf.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const pdfPath = path.join(root, 'public/assets/calendar.pdf');
const jsonPath = path.join(root, 'public/assets/parsed-calendar-raw.json');

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const COL = {
  day: [28, 52],
  weekday: [52, 76],
  events: [76, 460],
  dept: [460, 522],
  guide: [522, 600],
};

function colOf(x) {
  for (const [name, [min, max]] of Object.entries(COL)) {
    if (x >= min && x < max) return name;
  }
  return null;
}

function clusterLines(items) {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines = [];
  let bucket = [];
  let lastY = null;
  for (const item of sorted) {
    if (lastY !== null && item.y - lastY > 6) {
      lines.push(bucket.sort((a, b) => a.x - b.x).map((i) => i.text).join(' ').trim());
      bucket = [];
    }
    bucket.push(item);
    lastY = item.y;
  }
  if (bucket.length) {
    lines.push(bucket.sort((a, b) => a.x - b.x).map((i) => i.text).join(' ').trim());
  }
  return lines.filter(Boolean);
}

async function parsePdfBuffer(buffer) {
  const doc = await getDocument({ data: buffer }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const textContent = await page.getTextContent();
  const items = textContent.items
    .map((item) => {
      const tx = Util.transform(viewport.transform, item.transform);
      return { text: item.str.trim(), x: tx[4], y: tx[5] };
    })
    .filter((i) => i.text && i.y > 105);

  const anchors = items
    .filter((i) => colOf(i.x) === 'day' && /^\d{1,2}$/.test(i.text))
    .sort((a, b) => a.y - b.y);

  const seen = new Set();
  const uniqueAnchors = anchors.filter((a) => {
    const day = parseInt(a.text, 10);
    if (seen.has(day)) return false;
    seen.add(day);
    return true;
  });

  const rows = [];
  for (let i = 0; i < uniqueAnchors.length; i++) {
    const anchor = uniqueAnchors[i];
    const day = parseInt(anchor.text, 10);
    const yMin = anchor.y - 4;
    const yMax = i + 1 < uniqueAnchors.length ? uniqueAnchors[i + 1].y - 4 : anchor.y + 120;
    const rowItems = items.filter((it) => it.y >= yMin && it.y < yMax);
    const weekdayItem = rowItems.find((it) => colOf(it.x) === 'weekday' && WEEKDAYS.includes(it.text));
    rows.push({
      day,
      weekday: weekdayItem?.text ?? '',
      events: clusterLines(rowItems.filter((it) => colOf(it.x) === 'events')),
    });
  }
  return rows.sort((a, b) => a.day - b.day);
}

const buffer = fs.readFileSync(pdfPath);
const pdfjs = await parsePdfBuffer(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const jsonMap = new Map(json.map((d) => [d.day, d.events]));
let diffs = 0;
for (const row of pdfjs) {
  const expected = jsonMap.get(row.day) || [];
  const got = row.events;
  const same = JSON.stringify(expected) === JSON.stringify(got);
  if (!same) {
    diffs++;
    console.log(`\n=== Day ${row.day} ===`);
    console.log('JSON:', expected);
    console.log('PDFJS:', got);
  }
}
console.log(`\nTotal mismatched days: ${diffs}/${pdfjs.length}`);
