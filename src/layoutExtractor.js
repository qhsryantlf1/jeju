import { pdfjsLib } from './pdfSetup.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const ACT_X0 = 72;
const ACT_X1 = 380;

export async function extractLayoutFromPdf(page, viewport, dayData) {
  const textContent = await page.getTextContent();
  const pw = viewport.width / viewport.scale;
  const ph = viewport.height / viewport.scale;
  const canvasH = viewport.height;

  const anchors = [];
  for (const item of textContent.items) {
    const text = item.str.trim();
    if (!/^\d{1,2}$/.test(text)) continue;
    const day = parseInt(text, 10);
    if (day < 1 || day > 31) continue;

    const pos = transformPos(item, viewport);
    const hasWeekday = textContent.items.some((it) => {
      const t = it.str.trim();
      if (!WEEKDAYS.includes(t)) return false;
      const p = transformPos(it, viewport);
      return Math.abs(p.y - pos.y) < 8 && p.x > pos.x && p.x < pos.x + 40;
    });

    if (hasWeekday) {
      anchors.push({ day, y: pos.y / canvasH, rawY: pos.y });
    }
  }

  anchors.sort((a, b) => a.rawY - b.rawY);
  const unique = [];
  const seen = new Set();
  for (const a of anchors) {
    if (!seen.has(a.day)) {
      seen.add(a.day);
      unique.push(a);
    }
  }

  const dataMap = new Map(dayData.map((d) => [d.day, d]));
  const rows = [];

  for (let i = 0; i < unique.length; i++) {
    const { day, y } = unique[i];
    const nextY = unique[i + 1]?.y ?? y + 0.03;
    const rowH = Math.max(nextY - y, 0.018);
    const info = dataMap.get(day) || { events: [], weekday: '' };
    const events = info.events || [];
    const depts = info.departments || [];
    const lineH = rowH / Math.max(events.length, 1);

    rows.push({
      day,
      weekday: info.weekday || '',
      rowBox: { x: 0.057, y, w: 0.892, h: rowH },
      events: events.map((ev, ei) => ({
        event: ev,
        dept: depts[ei] ?? '',
        x: ACT_X0 / pw,
        y: y + lineH * ei,
        w: (ACT_X1 - ACT_X0) / pw,
        h: lineH,
      })),
    });
  }

  return { pageWidth: pw, pageHeight: ph, rows };
}

function transformPos(item, viewport) {
  const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
  return { x: tx[4], y: tx[5] };
}
