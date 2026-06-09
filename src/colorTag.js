const RULES = [
  { color: 'red', keywords: ['지방선거일', '현충일', '선거일'] },
  { color: 'pink', keywords: ['전일제'] },
  { color: 'blue', keywords: ['모의수능', '학력평가', '시험'] },
  {
    color: 'green',
    keywords: [
      '입학설명회', '카이스트', '고려대', '서울과기대', '캔텍',
      '성균관대', '중앙대', '지스트', '한양대', 'POSTECH',
    ],
  },
  { color: 'yellow', keywords: ['훈련', '축전', '감사', '점검', '회의', '협의회'] },
  { color: 'purple', keywords: ['동아리', '탐구', '특강'] },
];

const PRIORITY = { red: 0, pink: 1, blue: 2, green: 3, yellow: 4, purple: 5, default: 6 };

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
