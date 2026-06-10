export async function fetchSheetStatus() {
  const res = await fetch('/api/sheet-status', { cache: 'no-store' });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || `학생/학교 정보 로드 실패 (HTTP ${res.status})`);
  }

  const payload = await res.json();
  if (!payload?.student?.rows?.length) {
    throw new Error('학생 현황 데이터가 없습니다.');
  }

  return payload;
}
