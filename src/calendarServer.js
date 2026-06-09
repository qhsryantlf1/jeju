export async function fetchSharedCalendar() {
  const res = await fetch('/api/calendar', { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || `서버 일정 로드 실패 (HTTP ${res.status})`);
  }
  return res.json();
}

export async function saveSharedCalendar(payload) {
  const res = await fetch('/api/calendar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `서버 일정 저장 실패 (HTTP ${res.status})`);
  }

  return res.json();
}
