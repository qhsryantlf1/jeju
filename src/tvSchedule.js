import { getEventColor, extractGrade, isHolidayEvent } from './colorTag.js';
import { expandDayEvents } from './eventExpand.js';
import { getSchoolInfoFontSize } from './statusPanel.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const REF_PANEL = { width: 750, height: 700 };
const STATUS_WIDTH_RATIO = 0.50;
const REF_COL = { day: 34, wd: 34, guide: 58 };
const REF_FONT = { header: 13, date: 16, event: 16 };
const EVENT_FONT_MAX_PX = 30;
const EVENT_TV_BOOST = 1.3;
const GUIDE_FONT_BOOST = 1.22;
const GUIDE_FONT_MAX_PX = 22;
const BASE_MIN_LINE_H = 26;

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

  const columnLabels = {
    events: options.eventColumnLabel ?? '주요활동',
    guide: options.guideColumnLabel ?? '생활지도',
  };

  root.appendChild(buildColumn(leftDays, today, onGradeHover, columnLabels));
  root.appendChild(buildColumn(rightDays, today, onGradeHover, columnLabels));

  container.appendChild(root);

  const titleEl = document.getElementById('schedule-title');
  if (titleEl) titleEl.textContent = formatScheduleTitle();

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
  if (!panel) return;

  const scale = Math.min(
    panel.clientWidth / REF_PANEL.width,
    panel.clientHeight / REF_PANEL.height,
  );
  const s = Math.max(0.95, Math.min(2.7, scale));

  root.style.setProperty('--tv-scale', s.toFixed(3));
  root.style.setProperty('--tv-col-day', `${Math.round(REF_COL.day * s)}px`);
  root.style.setProperty('--tv-col-wd', `${Math.round(REF_COL.wd * s)}px`);
  root.style.setProperty('--tv-col-guide', `${Math.round(REF_COL.guide * s)}px`);
  root.style.setProperty('--tv-header-font', `${Math.max(11, Math.round(REF_FONT.header * s))}px`);
  root.style.setProperty('--tv-date-font', `${Math.max(12, Math.round(REF_FONT.date * s))}px`);
}

function layoutScheduleContent(root, leftDays, rightDays) {
  const run = () => {
    syncScheduleScale(root);
    applyScheduleRowHeights(root, leftDays, rightDays, getTvScale(root));
    applyColumnFonts(root);
    syncGuideColumnWidth(root);
  };

  syncStatusLayout();
  requestAnimationFrame(run);
}

export function reapplyScheduleFonts() {
  const root = document.querySelector('.tv-schedule');
  if (!root) return;
  applyColumnFonts(root);
  syncGuideColumnWidth(root);
}

export function syncStatusLayout() {
  const panel = document.querySelector('.status-panel');
  const wrap = document.querySelector('.status-sheets-wrap');
  const title = document.getElementById('schedule-title');
  const clock = document.getElementById('status-clock');
  if (!panel || !wrap || !title) return;

  const contentHeight = wrap.clientHeight;
  if (contentHeight <= 0) return;

  const contentWidth = Math.floor(contentHeight * STATUS_WIDTH_RATIO);
  wrap.style.height = `${contentHeight}px`;
  wrap.style.width = `${contentWidth}px`;

  title.style.width = `${contentWidth}px`;
  if (clock) clock.style.width = `${contentWidth}px`;

  panel.style.width = `${contentWidth}px`;
}

function formatScheduleTitle() {
  return `${new Date().getMonth() + 1}월 학사 운영 계획`;
}

export function updateScheduleTitle() {
  const titleEl = document.getElementById('schedule-title');
  if (titleEl) titleEl.textContent = formatScheduleTitle();
}

function buildColumn(days, today, onGradeHover, columnLabels = {}) {
  const eventLabel = columnLabels.events ?? '주요활동';
  const guideLabel = columnLabels.guide ?? '생활지도';

  const col = document.createElement('div');
  col.className = 'tv-col';

  const head = document.createElement('div');
  head.className = 'tv-col-head';

  const headerRow = document.createElement('div');
  headerRow.className = 'tv-col-headers';

  [
    ['일', ''],
    ['요일', ''],
    [eventLabel, 'events'],
    [guideLabel, 'guide'],
  ].forEach(([text, extraClass]) => {
    const th = document.createElement('span');
    th.className = extraClass ? `tv-th ${extraClass}` : 'tv-th';
    th.textContent = text;
    headerRow.appendChild(th);
  });

  head.appendChild(headerRow);
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
  const guides = dayInfo.lifeGuides || [];
  const eventColors = dayInfo.eventColors || [];
  const guideColors = dayInfo.lifeGuideColors || [];

  const activityLines = events
    .map((event, idx) => ({
      event: event?.trim() ?? '',
      idx,
    }))
    .filter(({ event }) => event);

  if (activityLines.length > 0) {
    return activityLines.map(({ event, idx }) => ({
      event,
      guide: guides[idx] ?? (guides.length === 1 ? guides[0] : ''),
      eventColor: eventColors[idx] ?? eventColors[0] ?? '',
      guideColor: guideColors[idx] ?? guideColors[0] ?? '',
    }));
  }

  return guides
    .filter((guide) => guide?.trim())
    .map((guide, idx) => ({
      event: '',
      guide,
      eventColor: '',
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

function getMergedGuide(lines) {
  const guides = lines.map((line) => line.guide?.trim() ?? '');
  const nonEmpty = guides.filter(Boolean);
  if (nonEmpty.length === 0) return null;
  const unique = [...new Set(nonEmpty)];
  if (unique.length === 1) return unique[0];
  return null;
}

function createGuideText(name, color) {
  const text = document.createElement('span');
  text.className = 'tv-guide-text';
  text.textContent = name;
  text.title = name;
  applyTextColor(text, color);
  return text;
}

function buildDayRow(dayInfo, today, onGradeHover) {
  const row = document.createElement('div');
  const lines = buildRowLines(dayInfo);
  const isSaturday = dayInfo.weekday === '토';
  const isHoliday = lines.some((line) => line.event && isHolidayEvent(line.event));
  const isCompact = isCompactDay(dayInfo);
  const isToday = today
    && today.day === dayInfo.day
    && today.weekday === dayInfo.weekday;
  const lineCount = lines.length;

  row.className = `tv-day-row${isToday ? ' today' : ''}${isCompact ? ' compact-day' : ' has-events'}`;
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

  const guideCell = document.createElement('div');
  guideCell.className = 'tv-guide';
  const mergedGuide = getMergedGuide(lines);

  if (mergedGuide) {
    const el = document.createElement('span');
    el.className = 'tv-guide-merged';
    el.appendChild(createGuideText(
      mergedGuide,
      lines.find((line) => line.guide?.trim())?.guideColor,
    ));
    guideCell.appendChild(el);
  } else {
    lines.forEach((line) => {
      const guide = line.guide?.trim() ?? '';
      const el = document.createElement('span');
      el.className = 'tv-guide-line';
      if (guide) {
        el.appendChild(createGuideText(guide, line.guideColor));
      }
      guideCell.appendChild(el);
    });
  }

  row.append(dateCell, wdCell, eventsCell, guideCell);
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

    row.querySelectorAll('.tv-event').forEach((el) => {
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

function isTvDisplayMode() {
  return Boolean(
    document.fullscreenElement
    || document.webkitFullscreenElement
    || document.msFullscreenElement,
  );
}

function getEventFontBoost() {
  return isTvDisplayMode() ? EVENT_TV_BOOST : 1;
}

function getEventFontSizeRange(root) {
  const scale = getTvScale(root);
  const schoolSize = getSchoolInfoFontSize();
  const boost = getEventFontBoost();
  const base = REF_FONT.event * scale * boost;
  const minPx = Math.max(schoolSize, Math.round(base * 0.85));
  const maxPx = Math.min(EVENT_FONT_MAX_PX, Math.round(base * 1.15));
  return {
    minPx: Math.min(minPx, maxPx),
    maxPx: Math.max(minPx, maxPx),
  };
}

function applyEventCellFont(textEl, cell, root) {
  const { minPx, maxPx } = getEventFontSizeRange(root);
  const pad = cellPadding(cell);
  textEl.style.maxWidth = `${Math.max(cell.clientWidth - pad.w, 0)}px`;

  for (let size = maxPx; size >= minPx; size -= 1) {
    applyCellTextStyle(textEl, size, { nowrap: false });
    textEl.style.letterSpacing = '0px';
    if (cellFits(textEl, cell)) return;
  }

  applyCellTextStyle(textEl, minPx, { nowrap: false });
  tightenLetterSpacing(textEl, cell);
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
  textEl.style.letterSpacing = '0px';
}

function cellFits(textEl, cell) {
  const pad = cellPadding(cell);
  const maxW = cell.clientWidth - pad.w;
  const maxH = cell.clientHeight - pad.h;
  return textEl.scrollHeight <= maxH + 2 && textEl.scrollWidth <= maxW + 2;
}

function tightenLetterSpacing(textEl, cell) {
  const pad = cellPadding(cell);
  textEl.style.maxWidth = `${Math.max(cell.clientWidth - pad.w, 0)}px`;
  textEl.style.letterSpacing = '0px';
  if (cellFits(textEl, cell)) return;

  for (let step = 1; step <= 12; step += 1) {
    textEl.style.letterSpacing = `${-(step * 0.008)}em`;
    if (cellFits(textEl, cell)) return;
  }
}

function applyGuideCellFont(textEl, cell) {
  const schoolSize = getSchoolInfoFontSize();
  const pad = cellPadding(cell);
  const maxH = cell.clientHeight - pad.h;
  const heightCap = maxH > 0 ? Math.floor(maxH / 1.15) : GUIDE_FONT_MAX_PX;
  const minPx = schoolSize;
  const maxPx = Math.max(
    minPx,
    Math.min(GUIDE_FONT_MAX_PX, Math.round(schoolSize * GUIDE_FONT_BOOST), heightCap),
  );

  for (let size = maxPx; size >= minPx; size -= 1) {
    applyCellTextStyle(textEl, size, { nowrap: true });
    textEl.style.letterSpacing = '0px';
    if (cellFits(textEl, cell)) {
      applyGuideStyle(textEl);
      return size;
    }
  }

  applyCellTextStyle(textEl, minPx, { nowrap: true });
  tightenLetterSpacing(textEl, cell);
  applyGuideStyle(textEl);
  return minPx;
}

function applyGuideStyle(textEl) {
  textEl.style.fontWeight = '800';
  textEl.style.textAlign = 'center';
  textEl.style.width = '100%';
  textEl.style.display = 'block';
}

function measureTextWidth(text, fontSizePx) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return text.length * fontSizePx * 0.9;
  ctx.font = `800 ${fontSizePx}px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`;
  return ctx.measureText(text).width;
}

function syncGuideColumnWidth(root) {
  const scale = getTvScale(root);
  let maxW = REF_COL.guide * scale;

  root.querySelectorAll('.tv-guide-text').forEach((el) => {
    const text = el.textContent?.trim();
    if (!text) return;
    const px = Number.parseFloat(getComputedStyle(el).fontSize) || getSchoolInfoFontSize();
    maxW = Math.max(maxW, measureTextWidth(text, px));
  });

  const guideHeader = root.querySelector('.tv-th.guide');
  if (guideHeader?.textContent?.trim()) {
    const headerPx = Number.parseFloat(getComputedStyle(root).getPropertyValue('--tv-header-font')) || 13;
    maxW = Math.max(maxW, measureTextWidth(guideHeader.textContent.trim(), headerPx * 0.92));
  }

  root.style.setProperty('--tv-col-guide', `${Math.ceil(maxW) + 8}px`);
}

function cellPadding(cellEl) {
  return cellEl.classList.contains('tv-event') ? { w: 6, h: 4 } : { w: 4, h: 2 };
}

export function applyColumnFonts(root) {
  const targetSize = getSchoolInfoFontSize();

  const eventItems = [...root.querySelectorAll('.tv-event-text')]
    .filter((textEl) => textEl.textContent?.trim())
    .map((textEl) => ({
      textEl,
      cell: textEl.closest('.tv-event'),
    }))
    .filter((item) => item.cell);

  const guideItems = [...root.querySelectorAll('.tv-guide-text')]
    .filter((el) => el.textContent?.trim())
    .map((textEl) => ({
      textEl,
      cell: textEl.closest('.tv-guide-line, .tv-guide-merged'),
    }))
    .filter((item) => item.cell);

  eventItems.forEach((item) => {
    applyEventCellFont(item.textEl, item.cell, root);
  });

  guideItems.forEach((item) => {
    applyGuideCellFont(item.textEl, item.cell);
  });

  return targetSize;
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

    row.querySelectorAll('.tv-event').forEach((el) => {
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
  const columns = meta.columns ?? {};
  return {
    year: meta.year ?? now.getFullYear(),
    month: meta.month ?? now.getMonth() + 1,
    eventColumnLabel: columns.events ?? meta.eventColumnLabel ?? '주요활동',
    guideColumnLabel: columns.guide ?? meta.guideColumnLabel ?? '생활지도',
  };
}

export { applyRowHeights, applyScheduleRowHeights };
