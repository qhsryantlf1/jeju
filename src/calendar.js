import { getEventColor, extractGrade } from './colorTag.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const YEAR = 2026;
const MONTH = 6;

export function renderCalendar(container, dayData, onGradeHover) {
  container.innerHTML = '';

  WEEKDAYS.forEach((wd, idx) => {
    const header = document.createElement('div');
    header.className = `weekday-header${idx === 0 ? ' sun' : ''}`;
    header.textContent = wd;
    container.appendChild(header);
  });

  const dataMap = new Map(dayData.map((d) => [d.day, d]));
  const firstDay = new Date(YEAR, MONTH - 1, 1).getDay();
  const daysInMonth = new Date(YEAR, MONTH, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === YEAR && today.getMonth() + 1 === MONTH;
  const todayDate = isCurrentMonth ? today.getDate() : null;

  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  for (let i = 0; i < totalCells; i++) {
    const cell = document.createElement('div');
    cell.className = 'day-cell';

    const dayNum = i - firstDay + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      cell.classList.add('empty');
      container.appendChild(cell);
      continue;
    }

    const weekdayIdx = i % 7;
    const isSunday = weekdayIdx === 0;
    const dayInfo = dataMap.get(dayNum) || { events: [], departments: [] };

    if (todayDate === dayNum) cell.classList.add('today');

    const numEl = document.createElement('div');
    numEl.className = `day-number${isSunday ? ' sun' : ''}`;
    const hasHoliday = dayInfo.events.some((e) => /지방선거일|현충일/.test(e));
    if (hasHoliday) numEl.classList.add('holiday');
    numEl.textContent = dayNum;
    cell.appendChild(numEl);

    const eventsEl = document.createElement('div');
    eventsEl.className = 'day-events';

    const events = dayInfo.events || [];
    const depts = dayInfo.departments || [];

    events.forEach((title, idx) => {
      const card = document.createElement('div');
      const color = getEventColor(title, isSunday);
      card.className = `event-card color-${color}`;
      card.dataset.grade = extractGrade(title) ?? '';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'event-title';
      titleSpan.textContent = title;
      card.appendChild(titleSpan);

      if (depts[idx]) {
        const deptSpan = document.createElement('span');
        deptSpan.className = 'event-dept';
        deptSpan.textContent = `담당: ${depts[idx]}`;
        card.appendChild(deptSpan);
      } else if (depts.length === 1 && events.length > 1) {
        const deptSpan = document.createElement('span');
        deptSpan.className = 'event-dept';
        deptSpan.textContent = `담당: ${depts[0]}`;
        card.appendChild(deptSpan);
      }

      const grade = extractGrade(title);
      if (grade) {
        card.addEventListener('mouseenter', () => onGradeHover?.(grade));
        card.addEventListener('mouseleave', () => onGradeHover?.(null));
      }

      eventsEl.appendChild(card);
    });

    cell.appendChild(eventsEl);
    container.appendChild(cell);
  }
}
