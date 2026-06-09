const RULES = [
  { color: 'red', keywords: ['지방선거일', '현충일', '선거일', '공휴일'] },
  { color: 'pink', keywords: ['전일제'] },
];

const PRIORITY = { red: 0, pink: 1, default: 2 };

export const HOLIDAY_KEYWORDS = ['지방선거일', '현충일', '선거일', '공휴일'];

export function isHolidayEvent(title) {
  return HOLIDAY_KEYWORDS.some((k) => title.includes(k));
}

export function getEventColor(title) {
  let best = 'default';
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => title.includes(kw))) {
      if (PRIORITY[rule.color] < PRIORITY[best]) {
        best = rule.color;
      }
    }
  }
  return best;
}

export function extractGrade(title) {
  const match = title.match(/(\d)학년/);
  return match ? parseInt(match[1], 10) : null;
}
