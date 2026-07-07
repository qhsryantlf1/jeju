import { fetchSheetCalendar } from './sheetCalendar.js';
import { fetchSheetStatus } from './sheetStatus.js';
import { saveUploadedCalendar, loadUploadedCalendar } from './calendarStorage.js';
import { fetchSharedCalendar } from './calendarServer.js';
import { renderTvSchedule, getScheduleOptions, syncStatusLayout, reapplyScheduleFonts } from './tvSchedule.js';
import { renderStatusPanel, setStatusGradeHighlight, refitStatusTables } from './statusPanel.js';

const WEEKDAY_LABELS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

const pdfViewerEl = document.getElementById('pdf-viewer');
const statusClockEl = document.getElementById('status-clock');
const clockDateEl = statusClockEl?.querySelector('.status-clock-date');
const clockTimeEl = statusClockEl?.querySelector('.status-clock-time');
let scheduleMeta = {};
let lastTodayKey = '';
let todayRefreshTimer = null;
let cachedCalendarData = null;
let calendarDataHash = '';
let statusDataHash = '';

const fullscreenBtn = document.getElementById('fullscreen-btn');
const toast = document.getElementById('toast');

function showViewerError(message) {
  pdfViewerEl.innerHTML = `<div class="viewer-error"><p>⚠️ ${message}</p><p class="viewer-error-hint">개발 서버로 접속해 주세요: <code>npm run dev</code> → http://localhost:5173</p></div>`;
}

function renderCachedSchedule() {
  renderTvSchedule(pdfViewerEl, cachedCalendarData, setStatusGradeHighlight, getScheduleOptions(scheduleMeta));
  lastTodayKey = new Date().toDateString();
}

/** PDF 파싱은 최후 수단이므로 pdfjs-dist는 이때만 동적 로드 */
async function renderPdfFallback() {
  const res = await fetch('/assets/calendar.pdf');
  if (!res.ok) throw new Error(`PDF 파일을 찾을 수 없습니다 (${res.status})`);
  const buffer = await res.arrayBuffer();

  pdfViewerEl.innerHTML = '<div class="viewer-loading">일정 불러오는 중...</div>';
  const { loadCalendarData } = await import('./pdfParser.js');
  cachedCalendarData = await loadCalendarData(buffer);
  renderCachedSchedule();
}

function applyCalendarData(data, meta = {}) {
  const hash = JSON.stringify(data);
  if (hash === calendarDataHash && cachedCalendarData) return false;

  cachedCalendarData = data;
  scheduleMeta = meta;
  calendarDataHash = hash;
  saveUploadedCalendar(cachedCalendarData, scheduleMeta);
  renderCachedSchedule();
  return true;
}

async function loadSheetCalendar() {
  const sheet = await fetchSheetCalendar();
  applyCalendarData(sheet.data, sheet.meta ?? {});
}

async function loadSheetStatus() {
  const status = await fetchSheetStatus();
  const hash = JSON.stringify(status);
  if (hash === statusDataHash) return;

  statusDataHash = hash;
  await renderStatusPanel(status);
  syncStatusLayout();
  refitStatusTables();
  reapplyScheduleFonts();
}

async function init() {
  try {
    pdfViewerEl.innerHTML = '<div class="viewer-loading">일정 불러오는 중...</div>';

    const statusPromise = loadSheetStatus().catch((err) => {
      console.warn('학생/학교 정보 로드 실패:', err);
    });

    try {
      await loadSheetCalendar();
      await statusPromise;
      return;
    } catch (err) {
      console.warn('구글 시트 로드 실패:', err);
    }

    try {
      const shared = await fetchSharedCalendar();
      if (shared?.data?.length) {
        applyCalendarData(shared.data, shared.meta ?? {});
        await statusPromise;
        return;
      }
    } catch (err) {
      console.warn('서버 일정 로드 실패:', err);
    }

    const stored = loadUploadedCalendar();
    if (stored) {
      cachedCalendarData = stored.data;
      scheduleMeta = stored.meta ?? {};
      renderCachedSchedule();
      await statusPromise;
      return;
    }

    await renderPdfFallback();
    await statusPromise;
  } catch (err) {
    console.error('초기화 실패:', err);
    showViewerError(err.message || '초기화에 실패했습니다.');
  }
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (cachedCalendarData) renderCachedSchedule();
    syncStatusLayout();
    refitStatusTables();
    reapplyScheduleFonts();
  }, 200);
});

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2500);
}

function isFullscreenActive() {
  return Boolean(
    document.fullscreenElement
    || document.webkitFullscreenElement
    || document.msFullscreenElement,
  );
}

function updateFullscreenButton() {
  if (!fullscreenBtn) return;
  const active = isFullscreenActive();
  fullscreenBtn.textContent = '⛶';
  fullscreenBtn.title = active ? '전체화면 나가기 (Esc)' : '전체화면 (F11)';
}

async function toggleFullscreen() {
  try {
    if (isFullscreenActive()) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      else if (document.msExitFullscreen) document.msExitFullscreen();
    } else {
      const el = document.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (el.msRequestFullscreen) el.msRequestFullscreen();
      else showToast('이 브라우저는 전체화면을 지원하지 않습니다');
    }
  } catch (err) {
    console.warn('전체화면 전환 실패:', err);
    showToast('전체화면을 사용할 수 없습니다');
  }
}

fullscreenBtn?.addEventListener('click', toggleFullscreen);

const fullscreenEvent = 'onfullscreenchange' in document ? 'fullscreenchange' : 'webkitfullscreenchange';
document.addEventListener(fullscreenEvent, () => {
  updateFullscreenButton();
  if (cachedCalendarData) {
    requestAnimationFrame(() => {
      renderCachedSchedule();
      reapplyScheduleFonts();
    });
  }
});
updateFullscreenButton();

function updateStatusClock() {
  const now = new Date();
  if (clockDateEl) {
    clockDateEl.textContent = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${WEEKDAY_LABELS[now.getDay()]}`;
  }
  if (clockTimeEl) {
    clockTimeEl.textContent = now.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
}

function scheduleTodayRefresh() {
  clearTimeout(todayRefreshTimer);
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  todayRefreshTimer = setTimeout(() => {
    if (cachedCalendarData) renderCachedSchedule();
    scheduleTodayRefresh();
  }, nextMidnight - now + 1000);
}

/** 1분 주기: 날짜 변경 감지 (로컬 연산만, 네트워크 없음) */
setInterval(() => {
  const todayKey = new Date().toDateString();
  if (todayKey !== lastTodayKey && cachedCalendarData) {
    renderCachedSchedule();
  }
}, 60_000);

/** 5분 주기: 시트 동기화 (서버 캐시 TTL과 맞춤, 데이터가 같으면 재렌더 없음) */
setInterval(() => {
  loadSheetCalendar().catch(() => { /* 시트 동기화 실패는 무시 */ });
  loadSheetStatus().catch(() => { /* 학생/학교 정보 동기화 실패는 무시 */ });
}, 5 * 60_000);

updateStatusClock();
setInterval(updateStatusClock, 1000);
scheduleTodayRefresh();
requestAnimationFrame(() => syncStatusLayout());

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
