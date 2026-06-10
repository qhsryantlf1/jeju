export async function fetchSheetCalendar() {
  const res = await fetch('/api/sheet-calendar', { cache: 'no-store' });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || `구글 시트 로드 실패 (HTTP ${res.status})`);
  }

  const payload = await res.json();
  if (!Array.isArray(payload?.data) || payload.data.length === 0) {
    throw new Error('시트에 표시할 일정이 없습니다.');
  }

  return payload;
}
