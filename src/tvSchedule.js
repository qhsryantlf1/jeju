import { getEventColor, extractGrade, isHolidayEvent } from './colorTag.js';
import { expandDayEvents } from './eventExpand.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const DEPT_NAMES = [
  '교무부', '학생부', '행정실', '학년부', '학년진학부',
  '과학영재부', '교육연구부', '진로입학상담부',
];

const MIN_LINE_H = 26;
const MIN_DAY_ROW_H = 26;
const COMPACT_ROW_H = 26;

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
    applyScheduleRowHeights(root, leftDays, rightDays);
    requestAnimationFrame(() => applyUnifiedEventFontSize(root));
  });
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

  if (hasActivity(dayInfo)) {
    return events.map((event, idx) => ({
      event: event?.trim() ?? '',
      dept: depts[idx] ?? '',
      guide: guides[idx] ?? (guides.length === 1 ? guides[0] : ''),
    }));
  }

  return guides
    .filter((guide) => guide?.trim())
    .map((guide) => ({ event: '', dept: '', guide }));
}

function hasActivity(dayInfo) {
  return (dayInfo.events || []).some((event) => event?.trim());
}

function isCompactDay(dayInfo) {
  return !hasActivity(dayInfo);
}

function isDepartureDay(dayInfo, lines) {
  if (dayInfo.weekday === '토') return false;
  return !lines.some((line) => line.guide?.trim());
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

  const wdCell = document.createElement('div');
  wdCell.className = `tv-wd${isHoliday ? ' holiday' : ''}${isSaturday ? ' saturday' : ''}`;
  wdCell.textContent = dayInfo.weekday;

  const eventsCell = document.createElement('div');
  eventsCell.className = 'tv-events';

  lines.forEach((line) => {
    const ev = document.createElement('div');
    const title = line.event?.trim() ?? '';
    if (title) {
      const color = getEventColor(title);
      const grade = extractGrade(title);
      ev.className = `tv-event${color !== 'default' ? ` color-${color}` : ''}`;

      const text = document.createElement('span');
      text.className = 'tv-event-text';
      text.textContent = title;
      text.title = title;
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
    }
    deptCell.appendChild(el);
  });

  const guideCell = document.createElement('div');
  guideCell.className = 'tv-guide';
  lines.forEach((line) => {
    const guide = line.guide?.trim() ?? '';
    const el = document.createElement('span');
    el.className = 'tv-guide-line';
    if (guide) {
      el.textContent = guide;
      el.title = guide;
    }
    guideCell.appendChild(el);
  });

  row.append(dateCell, wdCell, eventsCell, deptCell, guideCell);
  return row;
}

function applyScheduleRowHeights(root, leftDays, rightDays) {
  const bodies = [...root.querySelectorAll('.tv-col-body')];
  const bodyHeight = bodies[0]?.clientHeight ?? 0;
  if (bodyHeight <= 0) return;

  [
    { body: bodies[0], days: leftDays },
    { body: bodies[1], days: rightDays },
  ].forEach(({ body, days }) => {
    if (!body) return;

    let compactCount = 0;
    let activityUnits = 0;
    for (const day of days) {
      if (isCompactDay(day)) compactCount += 1;
      else activityUnits += buildRowLines(day).length;
    }

    const remaining = Math.max(
      bodyHeight - compactCount * COMPACT_ROW_H,
      activityUnits * MIN_LINE_H,
    );
    const lineH = activityUnits > 0 ? remaining / activityUnits : MIN_LINE_H;

    const rows = [...body.querySelectorAll('.tv-day-row')];
    rows.forEach((row, i) => {
      const day = days[i];
      const lines = buildRowLines(day);

      if (isCompactDay(day)) {
        row.style.height = `${COMPACT_ROW_H}px`;
        row.style.flex = 'none';

        if (lines.length === 0) return;

        const perLine = COMPACT_ROW_H / lines.length;
        row.querySelectorAll('.tv-event, .tv-dept-line, .tv-guide-line').forEach((el) => {
          el.style.height = `${perLine}px`;
          el.style.minHeight = `${perLine}px`;
          el.style.maxHeight = `${perLine}px`;
          el.style.lineHeight = '1';
        });
        return;
      }

      const lc = lines.length;
      const rowH = Math.max(lc * lineH, MIN_DAY_ROW_H);
      const perLine = rowH / lc;
      row.style.height = `${rowH}px`;
      row.style.flex = 'none';

      row.querySelectorAll('.tv-event, .tv-dept-line').forEach((el) => {
        el.style.height = `${perLine}px`;
        el.style.minHeight = `${perLine}px`;
        el.style.maxHeight = `${perLine}px`;
        el.style.lineHeight = '1';
      });
      row.querySelectorAll('.tv-guide-line').forEach((el) => {
        el.style.height = `${perLine}px`;
        el.style.minHeight = `${perLine}px`;
        el.style.maxHeight = 'none';
        el.style.lineHeight = '1.15';
      });
    });
  });
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
      el.style.lineHeight = '1';
    });
    row.querySelectorAll('.tv-guide-line').forEach((el) => {
      el.style.height = `${perLine}px`;
      el.style.minHeight = `${perLine}px`;
      el.style.maxHeight = 'none';
      el.style.lineHeight = '1.15';
    });
  });
}

function applyUnifiedEventFontSize(root) {
  const items = [...root.querySelectorAll('.tv-event-text')]
    .filter((textEl) => textEl.textContent?.trim())
    .map((textEl) => ({
      textEl,
      cell: textEl.closest('.tv-event'),
      text: textEl.textContent,
    }))
    .filter((item) => item.cell);

  if (items.length === 0) return;

  const fontFamily = getComputedStyle(items[0].textEl).fontFamily || 'sans-serif';
  const unifiedSize = items.reduce((minSize, item) => {
    const cellMax = maxFontSizeForCell(item.cell, item.text, fontFamily);
    return Math.min(minSize, cellMax);
  }, 22);

  items.forEach(({ textEl }) => {
    textEl.style.whiteSpace = 'nowrap';
    textEl.style.overflow = 'hidden';
    textEl.style.textOverflow = 'clip';
    textEl.style.fontSize = `${unifiedSize}px`;
    textEl.style.lineHeight = `${unifiedSize}px`;
  });
}

function maxFontSizeForCell(cellEl, text, fontFamily) {
  const maxW = cellEl.clientWidth - 6;
  const maxH = cellEl.clientHeight - 2;
  if (maxW <= 0 || maxH <= 0) return 9;

  let lo = 9;
  let hi = Math.floor(Math.min(maxH * 0.92, 22));
  let best = lo;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const textW = measureTextWidth(text, mid, fontFamily);
    if (textW <= maxW && mid <= maxH) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return best;
}

function measureTextWidth(text, fontSize, fontFamily) {
  const canvas = measureTextWidth._canvas ??= document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `700 ${fontSize}px ${fontFamily}`;
  return ctx.measureText(text).width;
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
