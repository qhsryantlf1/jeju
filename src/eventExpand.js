/** 주요활동 문자열의 " / " 구분을 별도 일정 줄로 분리 */
export function expandDayEvents(day) {
  const events = [];
  const departments = [];
  const lifeGuides = [];

  const rawEvents = day.events || [];
  const rawDepts = day.departments || [];
  const rawGuides = day.lifeGuides || [];

  if (rawEvents.length === 0) {
    rawGuides
      .filter((guide) => guide?.trim())
      .forEach((guide) => {
        events.push('');
        departments.push('');
        lifeGuides.push(guide);
      });
    return { ...day, events, departments, lifeGuides };
  }

  rawEvents.forEach((event, idx) => {
    const dept = rawDepts[idx] ?? (rawDepts.length === 1 ? rawDepts[0] : '');
    const guide = rawGuides[idx] ?? (rawGuides.length === 1 ? rawGuides[0] : '');
    const parts = event.split(/\s+\/\s+/).map((s) => s.trim()).filter(Boolean);
    const lines = parts.length > 1 ? parts : [event.trim()];

    lines.forEach((line) => {
      events.push(line);
      departments.push(dept);
      lifeGuides.push(guide);
    });
  });

  return { ...day, events, departments, lifeGuides };
}

export function expandAllDays(dayData) {
  return dayData.map(expandDayEvents);
}
