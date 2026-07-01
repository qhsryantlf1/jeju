const DEFAULT_COLOR = '#000000';

function pickColor(colors, idx, fallback = DEFAULT_COLOR) {
  return colors?.[idx] ?? colors?.[0] ?? fallback;
}

/** 주요활동 문자열을 줄바꿈·슬래시·중점 구분으로 분리 */
function splitActivityText(text) {
  const normalized = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/_x000D_/gi, '\n')
    .trim();
  if (!normalized) return [];

  const bySlash = normalized.split(/\s+\/\s+/).map((s) => s.trim()).filter(Boolean);
  if (bySlash.length > 1) return bySlash;

  const byNewline = normalized.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (byNewline.length > 1) return byNewline;

  const byDot = normalized.split(/\s*[·•]\s*/).map((s) => s.trim()).filter(Boolean);
  if (byDot.length > 1) return byDot;

  return [normalized];
}

/** 주요활동 문자열의 " / " 구분을 별도 일정 줄로 분리 */
export function expandDayEvents(day) {
  const events = [];
  const departments = [];
  const lifeGuides = [];
  const eventColors = [];
  const departmentColors = [];
  const lifeGuideColors = [];

  const rawEvents = day.events || [];
  const rawDepts = day.departments || [];
  const rawGuides = day.lifeGuides || [];
  const rawEventColors = day.eventColors || [];
  const rawDeptColors = day.departmentColors || [];
  const rawGuideColors = day.lifeGuideColors || [];

  if (rawEvents.length === 0) {
    rawGuides
      .filter((guide) => guide?.trim())
      .forEach((guide, idx) => {
        events.push('');
        departments.push('');
        lifeGuides.push(guide);
        eventColors.push(DEFAULT_COLOR);
        departmentColors.push(DEFAULT_COLOR);
        lifeGuideColors.push(pickColor(rawGuideColors, idx));
      });
    return {
      ...day,
      events,
      departments,
      lifeGuides,
      eventColors,
      departmentColors,
      lifeGuideColors,
    };
  }

  rawEvents.forEach((event, idx) => {
    const dept = rawDepts[idx] ?? (rawDepts.length === 1 ? rawDepts[0] : '');
    const guide = rawGuides[idx] ?? (rawGuides.length === 1 ? rawGuides[0] : '');
    const eventColor = pickColor(rawEventColors, idx);
    const deptColor = pickColor(rawDeptColors, idx);
    const guideColor = pickColor(rawGuideColors, idx);
    const lines = splitActivityText(event);

    lines.forEach((line) => {
      events.push(line);
      departments.push(dept);
      lifeGuides.push(guide);
      eventColors.push(eventColor);
      departmentColors.push(deptColor);
      lifeGuideColors.push(guideColor);
    });
  });

  return {
    ...day,
    events,
    departments,
    lifeGuides,
    eventColors,
    departmentColors,
    lifeGuideColors,
  };
}

export function expandAllDays(dayData) {
  return dayData.map(expandDayEvents);
}
