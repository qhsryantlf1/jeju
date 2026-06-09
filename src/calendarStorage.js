const STORAGE_KEY = 'jeju-tv-uploaded-calendar';
const STORAGE_VERSION = 2;

export function saveUploadedCalendar(data, meta = {}) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: STORAGE_VERSION,
      savedAt: Date.now(),
      data,
      meta: { source: 'pdfplumber', ...meta },
    }));
    return true;
  } catch (err) {
    console.warn('업로드 일정 저장 실패:', err);
    return false;
  }
}

export function loadUploadedCalendar() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (parsed.version !== STORAGE_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (!Array.isArray(parsed?.data) || parsed.data.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch (err) {
    console.warn('저장된 일정 불러오기 실패:', err);
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}
