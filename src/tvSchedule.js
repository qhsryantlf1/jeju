import { getEventColor, extractGrade, isHolidayEvent } from './colorTag.js';
import { expandDayEvents } from './eventExpand.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const DEPT_COL_LABEL = '진로입학상담부';
const BASE_MAX_FONT = 18;
const REF_PANEL = { width: 900, height: 700 };
const REF_COL = { day: 34, wd: 34, guide: 58 };
const REF_FONT = { header: 13, date: 16 };
const BASE_MIN_LINE_H = 26;

const DEPT_NAMES = [
  '교무부', '학생부', '행정실', '학년부', '학년진학부',
  '과학영재부', '교육연구부', '진로입학상담부',
];

const MIN_LINE_H = BASE_MIN_LINE_H;
const MIN_DAY_ROW_H = BASE_MIN_LINE_H;
const COMPACT_ROW_H = BASE_MIN_LINE_H;

export function renderTvSchedule(container, dayData, onGradeHover, options = {}) {
  const year = options.year ?? 2026;
  const month = options.month ?? 6;
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = getToday(year, month);

  const dataMap = new Map(dayData.map((d) => [d.day, expandDayEvents(d)]));
  const allDays = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const existing = dataMap.get(d);
    const weekday = existing?.weekday ?? WEEKDAYS[new Date(year, month - 1, d).getDay()];
    if (weekday === '일') continue;
    allDays.push(existing ?? { day: d, weekday, events: [], departments: [], lifeGuides: [] });
  }

  const leftDays = allDays.filter((d) => d.day <= 15);
  const rightDays = allDays.filter((d) => d.day > 15);

  container.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'tv-schedule';

  root.appendChild(buildColumn(leftDays, today, onGradeHover));
  root.appendChild(buildColumn(rightDays, today, onGradeHover));

  container.appendChild(root);

  const titleEl = document.getElementById('schedule-title');
  if (titleEl) titleEl.textContent = formatScheduleTitle(year, month);

  requestAnimationFrame(() => {
    layoutScheduleContent(root, leftDays, rightDays);
  });
}

function getTvScale(root) {
  const raw = root.style.getPropertyValue('--tv-scale');
  const scale = Number.parseFloat(raw);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function syncScheduleScale(root) {
  const panel = root.parentElement;
  if (!panel) return BASE_MAX_FONT;

  const scale = Math.min(
    panel.clientWidth / REF_PANEL.width,
    panel.clientHeight / REF_PANEL.height,
  );
  const s = Math.max(0.9, Math.min(2.4, scale));

  root.style.setProperty('--tv-scale', s.toFixed(3));
  root.style.setProperty('--tv-col-day', `${Math.round(REF_COL.day * s)}px`);
  root.style.setProperty('--tv-col-wd', `${Math.round(REF_COL.wd * s)}px`);
  root.style.setProperty('--tv-col-guide', `${Math.round(REF_COL.guide * s)}px`);
  root.style.setProperty('--tv-header-font', `${Math.max(11, Math.round(REF_FONT.header * s))}px`);
  root.style.setProperty('--tv-date-font', `${Math.max(12, Math.round(REF_FONT.date * s))}px`);

  return Math.max(10, Math.round(BASE_MAX_FONT * s));
}

function layoutScheduleContent(root, leftDays, rightDays) {
  const applyLayout = () => {
    const maxFont = syncScheduleScale(root);
    const scale = getTvScale(root);
    applyScheduleRowHeights(root, leftDays, rightDays, scale);
    syncDeptColumnWidth(root, maxFont);
    requestAnimationFrame(() => {
      const fontSize = applyColumnFonts(root, maxFont);
      syncDeptColumnWidth(root, fontSize);
      refreshDeptTextWidths(root);
    });
  };

  syncStatusLayout();
  applyLayout();
  requestAnimationFrame(() => {
    syncStatusLayout();
    applyLayout();
  });
}

export function syncStatusLayout() {
  const panel = document.querySelector('.status-panel');
  const wrap = document.querySelector('.status-image-wrap');
  const frame = document.querySelector('.status-image-frame');
  const title = document.getElementById('schedule-title');
  const clock = document.getElementById('status-clock');
  if (!panel || !wrap || !frame || !title) return;

  const imageHeight = wrap.clientHeight;
  if (imageHeight <= 0) return;

  const imageWidth = Math.floor(imageHeight * (724 / 1024));
  frame.style.height = `${imageHeight}px`;
  frame.style.width = `${imageWidth}px`;

  title.style.width = `${imageWidth}px`;
  if (clock) clock.style.width = `${imageWidth}px`;

  panel.style.width = `${imageWidth}px`;
}

function formatScheduleTitle(_calendarYear, month) {
  return `${month}월 학사 운영 계획`;
}

function buildColumn(days, today, onGradeHover) {
  const col = document.createElement('div');
  col.className = 'tv-col';

  const head = document.createElement('div');
  head.className = 'tv-col-head';
  head.innerHTML = `
    <div class="tv-col-headers">
      <span class="tv-th">일</span>
      <span class="tv-th">요일</span>
      <span class="tv-th events">주요활동</span>
      <span class="tv-th dept">담당</span>
      <span class="tv-th guide">생활지도</span>
    </div>
  `;
  col.appendChild(head);

  const body = document.createElement('div');
  body.className = 'tv-col-body';

  for (const dayInfo of days) {
    body.appendChild(buildDayRow(dayInfo, today, onGradeHover));
  }

  col.appendChild(body);
  return col;
}

function buildRowLines(dayInfo) {
  const events = dayInfo.events || [];
  const depts = (dayInfo.departments || []).map(extractDeptName);
  const guides = dayInfo.lifeGuides || [];
  const eventColors = dayInfo.eventColors || [];
  const deptColors = dayInfo.departmentColors || [];
  const guideColors = dayInfo.lifeGuideColors || [];

  if (hasActivity(dayInfo)) {
    return events.map((event, idx) => ({
      event: event?.trim() ?? '',
      dept: depts[idx] ?? '',
      guide: guides[idx] ?? (guides.length === 1 ? guides[0] : ''),
      eventColor: eventColors[idx] ?? eventColors[0] ?? '',
      deptColor: deptColors[idx] ?? deptColors[0] ?? '',
      guideColor: guideColors[idx] ?? guideColors[0] ?? '',
    }));
  }

  return guides
    .filter((guide) => guide?.trim())
    .map((guide, idx) => ({
      event: '',
      dept: '',
      guide,
      eventColor: '',
      deptColor: '',
      guideColor: guideColors[idx] ?? guideColors[0] ?? '',
    }));
}

function applyTextColor(el, color) {
  if (color && color !== '#000000') {
    el.style.color = color;
  }
}

function hasActivity(dayInfo) {
  return (dayInfo.events || []).some((event) => event?.trim());
}

function isCompactDay(dayInfo) {
  return !hasActivity(dayInfo);
}

function isDepartureDay(dayInfo, lines) {
  if (dayInfo.weekday === '토') return false;
  if (lines.some((line) => line.event && isHolidayEvent(line.event))) return false;
  return !lines.some((line) => line.guide?.trim());
}

function getMergedGuide(lines) {
  const guides = lines.map((line) => line.guide?.trim() ?? '');
  const nonEmpty = guides.filter(Boolean);
  if (nonEmpty.length === 0) return null;
  const unique = [...new Set(nonEmpty)];
  if (unique.length === 1) return unique[0];
  return null;
}

function buildDayRow(dayInfo, today, onGradeHover) {
  const row = document.createElement('div');
  const lines = buildRowLines(dayInfo);
  const isSaturday = dayInfo.weekday === '토';
  const isHoliday = lines.some((line) => line.event && isHolidayEvent(line.event));
  const isDeparture = isDepartureDay(dayInfo, lines);
  const isCompact = isCompactDay(dayInfo);
  const isToday = today
    && today.day === dayInfo.day
    && today.weekday === dayInfo.weekday;
  const lineCount = lines.length;

  row.className = `tv-day-row${isToday ? ' today' : ''}${isCompact ? ' compact-day' : ' has-events'}${isDeparture ? ' departure-day' : ''}`;
  row.dataset.lines = String(lineCount);

  const dateCell = document.createElement('div');
  dateCell.className = `tv-date${isHoliday ? ' holiday' : ''}${isSaturday ? ' saturday' : ''}`;
  dateCell.textContent = dayInfo.day;
  applyTextColor(dateCell, dayInfo.dayColor);

  const wdCell = document.createElement('div');
  wdCell.className = `tv-wd${isHoliday ? ' holiday' : ''}${isSaturday ? ' saturday' : ''}`;
  wdCell.textContent = dayInfo.weekday;
  applyTextColor(wdCell, dayInfo.weekdayColor);

  const eventsCell = document.createElement('div');
  eventsCell.className = 'tv-events';

  lines.forEach((line) => {
    const ev = document.createElement('div');
    const title = line.event?.trim() ?? '';
    if (title) {
      const color = getEventColor(title);
      const grade = extractGrade(title);
      const useSheetColor = line.eventColor && line.eventColor !== '#000000';
      ev.className = `tv-event${!useSheetColor && color !== 'default' ? ` color-${color}` : ''}`;

      const text = document.createElement('span');
      text.className = 'tv-event-text';
      text.textContent = title;
      text.title = title;
      applyTextColor(text, line.eventColor);
      ev.appendChild(text);

      if (grade) {
        ev.addEventListener('mouseenter', () => onGradeHover?.(grade));
        ev.addEventListener('mouseleave', () => onGradeHover?.(null));
      }
    } else {
      ev.className = 'tv-event tv-event-blank';
    }

    eventsCell.appendChild(ev);
  });

  const deptCell = document.createElement('div');
  deptCell.className = 'tv-dept';
  lines.forEach((line) => {
    const dept = line.dept?.trim() ?? '';
    const el = document.createElement('span');
    el.className = 'tv-dept-line';
    if (dept) {
      el.textContent = dept;
      el.title = dept;
      applyTextColor(el, line.deptColor);
    }
    deptCell.appendChild(el);
  });

  const guideCell = document.createElement('div');
  guideCell.className = 'tv-guide';
  const mergedGuide = getMergedGuide(lines);

  if (mergedGuide) {
    const el = document.createElement('span');
    el.className = 'tv-guide-merged';
    el.textContent = mergedGuide;
    el.title = mergedGuide;
    applyTextColor(el, lines.find((line) => line.guide?.trim())?.guideColor);
    guideCell.appendChild(el);
  } else {
    lines.forEach((line) => {
      const guide = line.guide?.trim() ?? '';
      const el = document.createElement('span');
      el.className = 'tv-guide-line';
      if (guide) {
        el.textContent = guide;
        el.title = guide;
        applyTextColor(el, line.guideColor);
      }
      guideCell.appendChild(el);
    });
  }

  row.append(dateCell, wdCell, eventsCell, deptCell, guideCell);
  return row;
}

function applyScheduleRowHeights(root, leftDays, rightDays, _scale = 1) {
  const bodies = [...root.querySelectorAll('.tv-col-body')];
  const bodyHeight = bodies[0]?.clientHeight ?? 0;
  if (bodyHeight <= 0) return;

  [
    { body: bodies[0], days: leftDays },
    { body: bodies[1], days: rightDays },
  ].forEach(({ body, days }) => {
    if (!body) return;
    layoutColumnRows(body, days, bodyHeight);
  });
}

function layoutColumnRows(body, days, bodyHeight) {
  const rows = [...body.querySelectorAll('.tv-day-row')];
  const specs = days.map((day, i) => {
    const lines = buildRowLines(day);
    const compact = isCompactDay(day);
    return {
      row: rows[i],
      lines,
      compact,
      weight: compact ? 1 : Math.max(lines.length, 1),
    };
  });

  const totalWeight = specs.reduce((sum, spec) => sum + spec.weight, 0);
  if (totalWeight <= 0) return;

  const unitH = bodyHeight / totalWeight;

  specs.forEach(({ row, lines, compact }) => {
    if (!row) return;

    const rowH = compact ? unitH : unitH * lines.length;
    const lineCount = Math.max(lines.length, 1);
    const perLine = rowH / lineCount;

    row.style.height = `${rowH}px`;
    row.style.flex = 'none';

    row.querySelectorAll('.tv-event, .tv-dept-line').forEach((el) => {
      el.style.height = `${perLine}px`;
      el.style.minHeight = `${perLine}px`;
      el.style.maxHeight = `${perLine}px`;
      el.style.lineHeight = '1.15';
    });
    row.querySelectorAll('.tv-guide-line').forEach((el) => {
      el.style.height = `${perLine}px`;
      el.style.minHeight = `${perLine}px`;
      el.style.maxHeight = `${perLine}px`;
      el.style.lineHeight = '1.15';
    });
    row.querySelectorAll('.tv-guide-merged').forEach((el) => {
      el.style.height = '100%';
      el.style.minHeight = `${rowH}px`;
    });
  });
}

function applyCellTextStyle(textEl, fontSize, { nowrap = false } = {}) {
  textEl.style.whiteSpace = nowrap ? 'nowrap' : 'normal';
  textEl.style.wordBreak = nowrap ? 'normal' : 'keep-all';
  textEl.style.overflowWrap = nowrap ? 'normal' : 'break-word';
  textEl.style.overflow = 'hidden';
  textEl.style.textOverflow = nowrap ? 'ellipsis' : 'clip';
  textEl.style.fontSize = `${fontSize}px`;
  textEl.style.fontWeight = '700';
  textEl.style.lineHeight = '1.15';
}

function measureTextWidth(text, fontSizePx) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return text.length * fontSizePx * 0.9;
  ctx.font = `700 ${fontSizePx}px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`;
  return ctx.measureText(text).width;
}

function syncDeptColumnWidth(root, fontSizePx) {
  const width = Math.ceil(measureTextWidth(DEPT_COL_LABEL, fontSizePx)) + 8;
  root.style.setProperty('--tv-col-dept', `${width}px`);
}

function refreshDeptTextWidths(root) {
  root.querySelectorAll('.tv-dept-line').forEach((el) => {
    el.style.maxWidth = `${Math.max(el.clientWidth - 4, 0)}px`;
  });
}

function cellPadding(cellEl) {
  return cellEl.classList.contains('tv-event') ? { w: 6, h: 4 } : { w: 4, h: 2 };
}

function maxFontSizeForWrappedCell(cellEl, textEl, maxCap = 18) {
  const text = textEl.textContent?.trim() ?? '';
  if (!text) return 9;

  const pad = cellPadding(cellEl);
  const maxW = cellEl.clientWidth - pad.w;
  const maxH = cellEl.clientHeight - pad.h;
  if (maxW <= 0 || maxH <= 0) return 9;

  let lo = 8;
  let hi = maxCap;
  let best = lo;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    applyCellTextStyle(textEl, mid);
    textEl.style.maxWidth = `${maxW}px`;

    const fits = textEl.scrollHeight <= maxH && textEl.scrollWidth <= maxW + 1;
    if (fits) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  applyCellTextStyle(textEl, best);
  textEl.style.maxWidth = `${maxW}px`;
  return best;
}

function computeBaselineSize(baselineItems, maxCap = 18) {
  if (baselineItems.length === 0) return maxCap;
  return baselineItems.reduce((minSize, item) => {
    const cellMax = maxFontSizeForWrappedCell(item.cell, item.textEl, maxCap);
    return Math.min(minSize, cellMax);
  }, maxCap);
}

function applyUnifiedFont(baselineItems, allItems, maxCap = BASE_MAX_FONT) {
  if (allItems.length === 0) return maxCap;

  const targetSize = computeBaselineSize(baselineItems, maxCap);

  allItems.forEach(({ textEl, cell }) => {
    const pad = cellPadding(cell);
    const nowrap = textEl.classList.contains('tv-dept-line');
    applyCellTextStyle(textEl, targetSize, { nowrap });
    textEl.style.maxWidth = `${Math.max(cell.clientWidth - pad.w, 0)}px`;
  });

  return targetSize;
}

export function applyColumnFonts(root, maxCap = BASE_MAX_FONT) {
  const eventItems = [...root.querySelectorAll('.tv-event-text')]
    .filter((textEl) => textEl.textContent?.trim())
    .map((textEl) => ({
      textEl,
      cell: textEl.closest('.tv-event'),
    }))
    .filter((item) => item.cell);

  const deptItems = [...root.querySelectorAll('.tv-dept-line')]
    .filter((el) => el.textContent?.trim())
    .map((el) => ({ textEl: el, cell: el }));

  const guideItems = [
    ...[...root.querySelectorAll('.tv-guide-line')].filter((el) => el.textContent?.trim()),
    ...[...root.querySelectorAll('.tv-guide-merged')].filter((el) => el.textContent?.trim()),
  ].map((el) => ({ textEl: el, cell: el }));

  const allItems = [...eventItems, ...deptItems, ...guideItems];
  return applyUnifiedFont(eventItems, allItems, maxCap);
}

function applyRowHeights(body, days) {
  if (!body) return;
  const bodyHeight = body.clientHeight;
  if (bodyHeight <= 0) return;

  const rows = [...body.querySelectorAll('.tv-day-row')];
  const lineCounts = days.map((d) => buildRowLines(d).length);
  const unitCounts = lineCounts.map((c) => (c === 0 ? 1 : c));
  const totalUnits = unitCounts.reduce((s, c) => s + c, 0);
  const lineH = totalUnits > 0
    ? Math.max(MIN_LINE_H, bodyHeight / totalUnits)
    : MIN_LINE_H;

  rows.forEach((row, i) => {
    const lc = lineCounts[i];
    const units = unitCounts[i];

    if (lc === 0) {
      row.style.height = `${Math.max(lineH, MIN_DAY_ROW_H)}px`;
      row.style.flex = 'none';
      return;
    }

    const rowH = Math.max(units * lineH, MIN_DAY_ROW_H);
    const perLine = rowH / lc;
    row.style.height = `${rowH}px`;
    row.style.flex = 'none';

    row.querySelectorAll('.tv-event, .tv-dept-line').forEach((el) => {
      el.style.height = `${perLine}px`;
      el.style.minHeight = `${perLine}px`;
      el.style.maxHeight = `${perLine}px`;
      el.style.lineHeight = '1.15';
    });
    row.querySelectorAll('.tv-guide-line').forEach((el) => {
      el.style.height = `${perLine}px`;
      el.style.minHeight = `${perLine}px`;
      el.style.maxHeight = `${perLine}px`;
      el.style.lineHeight = '1.15';
    });
    row.querySelectorAll('.tv-guide-merged').forEach((el) => {
      el.style.height = '100%';
      el.style.minHeight = `${rowH}px`;
    });
  });
}

function extractDeptName(raw) {
  if (!raw) return '';
  const parts = raw.split('/').map((p) => p.trim());
  const deptParts = parts.filter((p) => DEPT_NAMES.includes(p) || (p.endsWith('부') && p.length >= 3));
  return [...new Set(deptParts)].join('/');
}

function getToday(year, month) {
  const now = new Date();
  if (now.getFullYear() !== year || now.getMonth() + 1 !== month) {
    return null;
  }
  if (now.getDay() === 0) return null;

  return {
    day: now.getDate(),
    weekday: WEEKDAYS[now.getDay()],
  };
}

export function getScheduleOptions(meta = {}) {
  const now = new Date();
  return {
    year: meta.year ?? now.getFullYear(),
    month: meta.month ?? now.getMonth() + 1,
  };
}

export { applyRowHeights, applyScheduleRowHeights };
