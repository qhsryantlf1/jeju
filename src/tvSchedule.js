import { getEventColor, extractGrade, isHolidayEvent } from './colorTag.js';
import { expandDayEvents } from './eventExpand.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const DEPT_NAMES = [
  '교무부', '학생부', '행정실', '학년부', '학년진학부',
  '과학영재부', '교육연구부', '진로입학상담부',
];

const MIN_LINE_H = 26;
const MIN_DAY_ROW_H = 26;

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

  requestAnimationFrame(() => {
    root.querySelectorAll('.tv-col').forEach((col, idx) => {
      const body = col.querySelector('.tv-col-body');
      applyRowHeights(body, idx === 0 ? leftDays : rightDays);
    });
  });
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

function buildDayRow(dayInfo, today, onGradeHover) {
  const row = document.createElement('div');
  const events = dayInfo.events || [];
  const depts = (dayInfo.departments || []).map(extractDeptName);
  const guides = dayInfo.lifeGuides || [];
  const isSaturday = dayInfo.weekday === '토';
  const isHoliday = events.some(isHolidayEvent);
  const isToday = today
    && today.day === dayInfo.day
    && today.weekday === dayInfo.weekday;
  const lineCount = events.length;

  row.className = `tv-day-row${isToday ? ' today' : ''}${lineCount === 0 ? ' empty-day' : ' has-events'}`;
  row.dataset.lines = String(lineCount);

  const dateCell = document.createElement('div');
  dateCell.className = `tv-date${isHoliday ? ' holiday' : ''}${isSaturday ? ' saturday' : ''}${isToday ? ' today-mark' : ''}`;
  dateCell.textContent = dayInfo.day;

  const wdCell = document.createElement('div');
  wdCell.className = `tv-wd${isHoliday ? ' holiday' : ''}${isSaturday ? ' saturday' : ''}${isToday ? ' today-mark' : ''}`;
  wdCell.textContent = dayInfo.weekday;

  const eventsCell = document.createElement('div');
  eventsCell.className = 'tv-events';

  events.forEach((title) => {
    const color = getEventColor(title);
    const grade = extractGrade(title);

    const ev = document.createElement('div');
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

    eventsCell.appendChild(ev);
  });

  const deptCell = document.createElement('div');
  deptCell.className = 'tv-dept';
  events.forEach((_, idx) => {
    const dept = depts[idx] ?? '';
    if (!dept) return;
    const line = document.createElement('span');
    line.className = 'tv-dept-line';
    line.textContent = dept;
    line.title = dept;
    deptCell.appendChild(line);
  });

  const guideCell = document.createElement('div');
  guideCell.className = 'tv-guide';
  events.forEach((_, idx) => {
    const guide = guides[idx] ?? '';
    if (!guide) return;
    const line = document.createElement('span');
    line.className = 'tv-guide-line';
    line.textContent = guide;
    line.title = guide;
    guideCell.appendChild(line);
  });

  row.append(dateCell, wdCell, eventsCell, deptCell, guideCell);
  return row;
}

function applyRowHeights(body, days) {
  if (!body) return;
  const bodyHeight = body.clientHeight;
  if (bodyHeight <= 0) return;

  const rows = [...body.querySelectorAll('.tv-day-row')];
  const lineCounts = days.map((d) => d.events?.length || 0);
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
      el.style.lineHeight = `${Math.max(perLine - 2, 14)}px`;
    });
    row.querySelectorAll('.tv-guide-line').forEach((el) => {
      el.style.height = `${perLine}px`;
      el.style.minHeight = `${perLine}px`;
      el.style.maxHeight = 'none';
      el.style.lineHeight = '1.15';
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

export { applyRowHeights };
