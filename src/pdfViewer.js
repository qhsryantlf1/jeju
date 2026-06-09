import { pdfjsLib } from './pdfSetup.js';
import { getEventColor, extractGrade } from './colorTag.js';
import { extractLayoutFromPdf } from './layoutExtractor.js';

const YEAR = 2026;
const MONTH = 6;

export async function renderPdfViewer(container, buffer, dayData, onGradeHover, options = {}) {
  if (!container) throw new Error('PDF 뷰어 컨테이너를 찾을 수 없습니다.');

  await waitForSize(container);

  const doc = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
  const page = await doc.getPage(1);

  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'pdf-viewer-wrap';

  const { width, height, scale } = getRenderSize(container, page);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.className = 'pdf-canvas';
  canvas.width = width;
  canvas.height = height;
  wrap.appendChild(canvas);

  const renderTask = page.render({ canvas, viewport });
  await renderTask.promise;

  const overlay = document.createElement('div');
  overlay.className = 'pdf-overlay';
  overlay.style.width = `${width}px`;
  overlay.style.height = `${height}px`;
  wrap.appendChild(overlay);

  const tooltip = document.createElement('div');
  tooltip.className = 'pdf-tooltip hidden';
  wrap.appendChild(tooltip);

  const layout = await loadLayout(dayData, page, viewport, options.useCachedLayout !== false);
  const today = getTodayDate();
  const layoutMap = new Map(layout.rows.map((r) => [r.day, r]));

  for (const dayInfo of dayData) {
    const rowLayout = layoutMap.get(dayInfo.day);
    if (!rowLayout) continue;

    const isSunday = dayInfo.weekday === '일';
    const events = dayInfo.events || [];
    const depts = dayInfo.departments || [];

    if (today === dayInfo.day && rowLayout.rowBox) {
      addBox(overlay, 'today-row-border', rowLayout.rowBox);
    }

    events.forEach((title, idx) => {
      const region = rowLayout.events?.[idx] || estimateEventRegion(rowLayout, idx, events.length);
      const color = getEventColor(title, isSunday);
      if (color === 'default') return;

      const dept = depts[idx] ?? (depts.length === 1 ? depts[0] : '');
      const grade = extractGrade(title);

      const hl = addBox(overlay, `hl-strip color-${color}`, region);

      hl.addEventListener('mouseenter', (e) => {
        showTooltip(tooltip, title, dept, e, wrap);
        if (grade) onGradeHover?.(grade);
      });
      hl.addEventListener('mouseleave', () => {
        tooltip.classList.add('hidden');
        onGradeHover?.(null);
      });
    });
  }

  container.appendChild(wrap);
}

function getRenderSize(container, page) {
  const base = page.getViewport({ scale: 1 });
  const cw = container.clientWidth || container.parentElement?.clientWidth || window.innerWidth * 0.65;
  const ch = container.clientHeight || container.parentElement?.clientHeight || window.innerHeight - 80;
  const scale = Math.max(Math.min(cw / base.width, ch / base.height), 0.5);
  const viewport = page.getViewport({ scale });
  return { width: viewport.width, height: viewport.height, scale };
}

function waitForSize(el, maxWait = 3000) {
  return new Promise((resolve) => {
    const start = performance.now();
    const check = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        resolve();
        return;
      }
      if (performance.now() - start > maxWait) {
        resolve();
        return;
      }
      requestAnimationFrame(check);
    };
    check();
  });
}

function addBox(parent, className, box) {
  const el = document.createElement('div');
  el.className = className;
  el.style.left = `${box.x * 100}%`;
  el.style.top = `${box.y * 100}%`;
  el.style.width = `${box.w * 100}%`;
  el.style.height = `${box.h * 100}%`;
  parent.appendChild(el);
  return el;
}

function estimateEventRegion(rowLayout, idx, total) {
  const { rowBox } = rowLayout;
  const lineH = rowBox.h / Math.max(total, 1);
  return {
    x: 0.121,
    y: rowBox.y + lineH * idx,
    w: 0.518,
    h: lineH,
  };
}

function showTooltip(tooltip, title, dept, event, wrap) {
  tooltip.innerHTML = `<strong>${title}</strong>${dept ? `<br><span class="tooltip-dept">담당: ${dept}</span>` : ''}`;
  tooltip.classList.remove('hidden');

  const wrapRect = wrap.getBoundingClientRect();
  const x = event.clientX - wrapRect.left + 12;
  const y = event.clientY - wrapRect.top - 8;
  tooltip.style.left = `${Math.min(x, wrapRect.width - 320)}px`;
  tooltip.style.top = `${Math.max(y, 4)}px`;
}

function getTodayDate() {
  const now = new Date();
  if (now.getFullYear() === YEAR && now.getMonth() + 1 === MONTH) {
    return now.getDate();
  }
  return null;
}

async function loadLayout(dayData, page, viewport, useCached) {
  if (useCached) {
    try {
      const res = await fetch('/assets/pdf-layout.json');
      if (res.ok) {
        const cached = await res.json();
        if (cached.rows?.length >= 5) return cached;
      }
    } catch { /* fallback below */ }
  }
  return extractLayoutFromPdf(page, viewport, dayData);
}
