function hexToHue(hex) {
  const clean = String(hex ?? '').replace('#', '');
  if (clean.length !== 6) return null;

  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta < 0.08) return null;

  let h;
  if (max === r) h = ((g - b) / delta) % 6;
  else if (max === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;
  h *= 60;
  if (h < 0) h += 360;
  return h;
}

/** 시트에서 지정한 실제 글자색의 색조를 기준으로 강조 색상을 분류한다. */
export function classifyEventColor(hex) {
  const hue = hexToHue(hex);
  if (hue === null) return 'default';
  if (hue >= 340 || hue < 15) return 'red';
  if (hue >= 280 && hue < 340) return 'pink';
  return 'default';
}
