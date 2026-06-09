import { pdfjsLib } from './pdfSetup.js';
import { expandAllDays } from './eventExpand.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const COL = {
  day: [28, 52],
  weekday: [52, 76],
  events: [76, 460],
  dept: [460, 522],
  guide: [522, 600],
};

export async function loadFallbackData() {
  const res = await fetch('/assets/parsed-calendar-raw.json');
  if (!res.ok) throw new Error('parsed-calendar-raw.json 없음');
  const data = await res.json();
  return expandAllDays(data);
}

/** pdfplumber 서버 파싱 (업로드용) */
export async function parsePdfViaApi(buffer, file = null) {
  let res;

  if (file) {
    const form = new FormData();
    form.append('file', file);
    res = await fetch('/api/parse-pdf', { method: 'POST', body: form });
  } else {
    res = await fetch('/api/parse-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf' },
      body: buffer,
    });
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    if (res.status === 404) {
      throw new Error('PDF 파싱 서버를 찾을 수 없습니다. Vercel 재배포 후 다시 시도해 주세요.');
    }
    throw new Error(
      payload.error || `PDF 파싱 실패 (HTTP ${res.status})`,
    );
  }

  return expandAllDays(await res.json());
}

/** 업로드 PDF는 서버(pdfplumber) 파싱, 기본은 JSON 사용 */
export async function loadCalendarData(buffer, { forceParse = false, file = null } = {}) {
  if (forceParse) {
    const parsed = await parsePdfViaApi(buffer, file);
    if (validateParsed(parsed)) return parsed;
    if (parsed.length >= 3 && parsed.some((d) => d.events?.length)) {
      console.warn('파싱 검증 일부 미통과, 결과 사용');
      return parsed;
    }
    throw new Error('업로드한 PDF를 인식하지 못했습니다. 학사일정 표 형식 PDF인지 확인해 주세요.');
  }

  try {
    const json = await loadFallbackData();
    if (validateParsed(json)) return json;
  } catch (err) {
    console.warn('JSON 로드 실패:', err);
  }

  const parsed = expandAllDays(await parsePdfBuffer(buffer));
  if (validateParsed(parsed)) return parsed;
  return loadFallbackData();
}

export async function parsePdfBuffer(buffer) {
  const doc = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const textContent = await page.getTextContent();

  const items = textContent.items
    .map((item) => {
      const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
      return { text: item.str.trim(), x: tx[4], y: tx[5] };
    })
    .filter((i) => i.text && i.y > 105);

  return parseByColumns(items);
}

function colOf(x) {
  for (const [name, [min, max]] of Object.entries(COL)) {
    if (x >= min && x < max) return name;
  }
  return null;
}

function parseByColumns(items) {
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

    const weekdayItem = rowItems.find(
      (it) => colOf(it.x) === 'weekday' && WEEKDAYS.includes(it.text),
    );

    rows.push({
      day,
      weekday: weekdayItem?.text ?? '',
      events: clusterLines(rowItems.filter((it) => colOf(it.x) === 'events')),
      departments: clusterLines(rowItems.filter((it) => colOf(it.x) === 'dept')),
      lifeGuides: clusterLines(rowItems.filter((it) => colOf(it.x) === 'guide')),
    });
  }

  return rows.sort((a, b) => a.day - b.day);
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

export function validateParsed(data) {
  if (!Array.isArray(data) || data.length < 5) return false;
  if (!data.some((d) => d.events?.some((e) => /[가-힣]/.test(e)))) return false;

  const hyunchung = data.filter((d) => d.events?.some((e) => e.includes('현충일')));
  const election = data.filter((d) => d.events?.some((e) => e.includes('지방선거일')));
  if (hyunchung.length > 1 || election.length > 1) return false;

  for (const d of data) {
    if ((d.events?.length || 0) > 12) return false;
    const unique = new Set(d.events);
    if (unique.size !== d.events.length) return false;
  }
  return true;
}
