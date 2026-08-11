import { classifyEventColor } from './colorTag.js';
import { expandDayEvents } from './eventExpand.js';
import { getSchoolInfoFontSize } from './statusPanel.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const REF_PANEL = { width: 750, height: 700 };
const STATUS_WIDTH_RATIO = 0.50;
const REF_COL = { day: 34, wd: 34 };
const REF_FONT = { header: 13, date: 16, event: 16 };
const EVENT_FONT_MAX_PX = 30;
const EVENT_TV_BOOST = 1.3;
const EVENT_CELL_PAD_W = 6;
const EVENT_CELL_PAD_H = 4;

export function renderTvSchedule(container, dayData, options = {}) {
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
    allDays.push(existing ?? { day: d, weekday, events: [], departments: [] });
  }

  const leftDays = allDays.filter((d) => d.day <= 15);
  const rightDays = allDays.filter((d) => d.day > 15);

  container.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'tv-schedule';

  const columnLabels = {
    events: options.eventColumnLabel ?? '주요활동',
  };

  root.appendChild(buildColumn(leftDays, today, columnLabels));
  root.appendChild(buildColumn(rightDays, today, columnLabels));

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
  const s = Math.max(0.95, Math.min(3.5, scale));

  root.style.setProperty('--tv-scale', s.toFixed(3));
  root.style.setProperty('--tv-col-day', `${Math.round(REF_COL.day * s)}px`);
  root.style.setProperty('--tv-col-wd', `${Math.round(REF_COL.wd * s)}px`);
  root.style.setProperty('--tv-header-font', `${Math.max(11, Math.round(REF_FONT.header * s))}px`);
  root.style.setProperty('--tv-date-font', `${Math.max(12, Math.round(REF_FONT.date * s))}px`);
}

function layoutScheduleContent(root, leftDays, rightDays) {
  const run = () => {
    syncScheduleScale(root);
    applyScheduleRowHeights(root, leftDays, rightDays);
    applyColumnFonts(root);
  };

  syncStatusLayout();
  requestAnimationFrame(run);
}

export function reapplyScheduleFonts() {
  const root = document.querySelector('.tv-schedule');
  if (!root) return;
  applyColumnFonts(root);
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

function buildColumn(days, today, columnLabels = {}) {
  const eventLabel = columnLabels.events ?? '주요활동';

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
    body.appendChild(buildDayRow(dayInfo, today));
  }

  col.appendChild(body);
  return col;
}

function buildRowLines(dayInfo) {
  const events = dayInfo.events || [];
  const eventColors = dayInfo.eventColors || [];

  return events
    .map((event, idx) => ({
      event: event?.trim() ?? '',
      eventColor: eventColors[idx] ?? eventColors[0] ?? '',
    }))
    .filter(({ event }) => event);
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

function buildDayRow(dayInfo, today) {
  const row = document.createElement('div');
  const lines = buildRowLines(dayInfo);
  const isSaturday = dayInfo.weekday === '토';
  const isHoliday = classifyEventColor(dayInfo.dayColor) === 'red'
    || lines.some((line) => classifyEventColor(line.eventColor) === 'red');
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
    const title = line.event.trim();
    const color = classifyEventColor(line.eventColor);
    ev.className = `tv-event${color !== 'default' ? ` color-${color}` : ''}`;

    const text = document.createElement('span');
    text.className = 'tv-event-text';
    text.textContent = title;
    text.title = title;
    applyTextColor(text, line.eventColor);
    ev.appendChild(text);

    eventsCell.appendChild(ev);
  });

  row.append(dateCell, wdCell, eventsCell);
  return row;
}

function applyScheduleRowHeights(root, leftDays, rightDays) {
  const bodies = [...root.querySelectorAll('.tv-col-body')];
  const bodyHeight = bodies[0]?.clientHeight ?? 0;
  if (bodyHeight <= 0) return;
  const [leftBody, rightBody] = bodies;
  if (!leftBody || !rightBody) return;

  // The per-line height budget and the event font size are circular: the
  // budget depends on how many rows need to wrap, and wrapping depends on
  // the font size, which is capped by the budget. Iterate until they agree,
  // so TV boost never demands a font taller than the row it has to fit in.
  let unitH = Math.min(
    baselineUnitHeight(bodyHeight, leftDays),
    baselineUnitHeight(bodyHeight, rightDays),
  );

  for (let i = 0; i < 5; i += 1) {
    root.dataset.eventUnitH = String(unitH);
    const { minPx } = getEventFontSizeRange(root);
    const nextUnitH = Math.min(
      bodyHeight / columnWeight(leftBody, leftDays, minPx),
      bodyHeight / columnWeight(rightBody, rightDays, minPx),
    );
    const settled = Math.abs(nextUnitH - unitH) < 0.25;
    unitH = nextUnitH;
    if (settled) break;
  }
  root.dataset.eventUnitH = String(unitH);

  [
    { body: leftBody, days: leftDays },
    { body: rightBody, days: rightDays },
  ].forEach(({ body, days }) => {
    layoutColumnRows(body, days, bodyHeight, root);
  });
}

function baselineUnitHeight(bodyHeight, days) {
  const totalWeight = days.reduce((sum, day) => {
    const lineCount = isCompactDay(day) ? 1 : Math.max(buildRowLines(day).length, 1);
    return sum + lineCount;
  }, 0);
  return totalWeight > 0 ? bodyHeight / totalWeight : bodyHeight;
}

function getColumnWidth(body) {
  const eventsWidth = body.querySelector('.tv-events')?.clientWidth ?? 0;
  return Math.max(eventsWidth - EVENT_CELL_PAD_W, 0);
}

function dayLineNeeds(day, minPx, colWidth) {
  return buildRowLines(day).map((line) => estimateWrappedLines(line.event, minPx, colWidth));
}

function columnWeight(body, days, minPx) {
  const colWidth = getColumnWidth(body);
  const total = days.reduce((sum, day) => {
    if (isCompactDay(day)) return sum + 1;
    const units = dayLineNeeds(day, minPx, colWidth).reduce((s, n) => s + n, 0);
    return sum + Math.max(units, 1);
  }, 0);
  return total > 0 ? total : 1;
}

// Measures how many visual lines an event title needs at the given font size
// and column width, so wrapped text gets enough row height instead of being
// clipped by the fixed-height cell.
function estimateWrappedLines(text, fontSizePx, widthPx) {
  if (!text || widthPx <= 0) return 1;

  let probe = estimateWrappedLines._probe;
  if (!probe) {
    probe = document.createElement('div');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    probe.style.left = '-9999px';
    probe.style.top = '0';
    probe.style.wordBreak = 'keep-all';
    probe.style.overflowWrap = 'break-word';
    probe.style.fontWeight = '700';
    document.body.appendChild(probe);
    estimateWrappedLines._probe = probe;
  }

  probe.style.width = `${widthPx}px`;
  probe.style.fontSize = `${fontSizePx}px`;
  probe.style.lineHeight = '1.15';
  probe.textContent = text;

  const lineH = fontSizePx * 1.15;
  return Math.max(1, Math.ceil(probe.scrollHeight / lineH - 0.15));
}

function layoutColumnRows(body, days, bodyHeight, root) {
  const rows = [...body.querySelectorAll('.tv-day-row')];
  const colWidth = getColumnWidth(body);
  const { minPx } = getEventFontSizeRange(root);

  const specs = days.map((day, i) => {
    const compact = isCompactDay(day);
    const lineNeeds = compact ? [] : dayLineNeeds(day, minPx, colWidth);
    const units = lineNeeds.reduce((sum, n) => sum + n, 0);
    return {
      row: rows[i],
      lineNeeds,
      compact,
      weight: compact ? 1 : Math.max(units, 1),
    };
  });

  const totalWeight = specs.reduce((sum, spec) => sum + spec.weight, 0);
  if (totalWeight <= 0) return;

  const unitH = bodyHeight / totalWeight;

  specs.forEach(({ row, lineNeeds, compact }) => {
    if (!row) return;

    const units = compact ? 1 : Math.max(lineNeeds.reduce((s, n) => s + n, 0), 1);
    const rowH = unitH * units;

    row.style.height = `${rowH}px`;
    row.style.flex = 'none';

    [...row.querySelectorAll('.tv-event')].forEach((el, idx) => {
      const h = unitH * (lineNeeds[idx] ?? 1);
      el.style.height = `${h}px`;
      el.style.minHeight = `${h}px`;
      el.style.maxHeight = `${h}px`;
      el.style.lineHeight = '1.15';
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

  // TV boost can push the font past what a single row actually has room
  // for; cap it so even a one-line entry never exceeds its row height.
  const unitH = Number.parseFloat(root.dataset.eventUnitH);
  const heightCap = Number.isFinite(unitH) && unitH > 0
    ? Math.max(schoolSize, Math.floor((unitH - EVENT_CELL_PAD_H) / 1.15))
    : Infinity;

  const minPx = Math.min(Math.max(schoolSize, Math.round(base * 0.85)), heightCap);
  const maxPx = Math.min(EVENT_FONT_MAX_PX, Math.round(base * 1.15), heightCap);
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

function cellPadding(cellEl) {
  return cellEl.classList.contains('tv-event') ? { w: EVENT_CELL_PAD_W, h: EVENT_CELL_PAD_H } : { w: 4, h: 2 };
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

  eventItems.forEach((item) => {
    applyEventCellFont(item.textEl, item.cell, root);
  });

  return targetSize;
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
  };
}
