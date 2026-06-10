import { loadCalendarData } from './pdfParser.js';
import { fetchSheetCalendar } from './sheetCalendar.js';
import { fetchSheetStatus } from './sheetStatus.js';
import { saveUploadedCalendar, loadUploadedCalendar } from './calendarStorage.js';
import { fetchSharedCalendar } from './calendarServer.js';
import { renderTvSchedule, getScheduleOptions, syncStatusLayout, reapplyScheduleFonts } from './tvSchedule.js';
import { renderStatusPanel, setStatusGradeHighlight, refitStatusTables } from './statusPanel.js';

const WEEKDAY_LABELS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

const pdfViewerEl = document.getElementById('pdf-viewer');
const statusClockEl = document.getElementById('status-clock');
let scheduleMeta = {};
let lastTodayKey = '';
let todayRefreshTimer = null;
let currentBuffer = null;
let cachedCalendarData = null;
let useCachedLayout = true;
let sharedSavedAt = 0;
let calendarDataHash = '';

function cloneBuffer(buffer) {
  return buffer.slice(0);
}
const fullscreenBtn = document.getElementById('fullscreen-btn');
const toast = document.getElementById('toast');
const modal = document.getElementById('modal');
const modalText = document.getElementById('modal-text');
const modalClose = document.getElementById('modal-close');

function setGradeHighlight(grade) {
  setStatusGradeHighlight(grade);
}

function showViewerError(message) {
  pdfViewerEl.innerHTML = `<div class="viewer-error"><p>⚠️ ${message}</p><p class="viewer-error-hint">개발 서버로 접속해 주세요: <code>npm run dev</code> → http://localhost:5173</p></div>`;
}

async function renderBoard(buffer, reparsing = true) {
  currentBuffer = cloneBuffer(buffer);
  try {
    if (reparsing) {
      pdfViewerEl.innerHTML = '<div class="viewer-loading">일정 불러오는 중...</div>';
      cachedCalendarData = await loadCalendarData(cloneBuffer(currentBuffer), {
        forceParse: !useCachedLayout,
      });
    }
    renderTvSchedule(pdfViewerEl, cachedCalendarData, setGradeHighlight, getScheduleOptions(scheduleMeta));
    lastTodayKey = new Date().toDateString();
  } catch (err) {
    console.error('게시판 렌더 실패:', err);
    showViewerError(err.message || '일정을 표시할 수 없습니다.');
  }
}

function renderCachedSchedule() {
  renderTvSchedule(pdfViewerEl, cachedCalendarData, setGradeHighlight, getScheduleOptions(scheduleMeta));
  lastTodayKey = new Date().toDateString();
}

function applyCalendarData(data, meta = {}) {
  const hash = JSON.stringify(data);
  if (hash === calendarDataHash && cachedCalendarData) return false;

  cachedCalendarData = data;
  scheduleMeta = meta;
  calendarDataHash = hash;
  useCachedLayout = false;
  saveUploadedCalendar(cachedCalendarData, scheduleMeta);
  renderCachedSchedule();
  return true;
}

function applySharedCalendar(shared) {
  applyCalendarData(shared.data, shared.meta ?? {});
  sharedSavedAt = shared.savedAt ?? 0;
}

async function loadSheetCalendar() {
  const sheet = await fetchSheetCalendar();
  applyCalendarData(sheet.data, sheet.meta ?? {});
  return true;
}

async function loadSheetStatus() {
  const status = await fetchSheetStatus();
  await renderStatusPanel(status);
  syncStatusLayout();
  refitStatusTables();
  reapplyScheduleFonts();
  return true;
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
        applySharedCalendar(shared);
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
      sharedSavedAt = stored.savedAt ?? 0;
      useCachedLayout = false;
      renderCachedSchedule();
      await statusPromise;
      return;
    }

    const res = await fetch('/assets/calendar.pdf');
    if (!res.ok) throw new Error(`PDF 파일을 찾을 수 없습니다 (${res.status})`);
    await renderBoard(await res.arrayBuffer());
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

function showModal(msg) {
  modalText.innerHTML = msg;
  modal.classList.remove('hidden');
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
  fullscreenBtn.textContent = active ? '나가기' : '전체화면';
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
document.addEventListener('fullscreenchange', () => {
  updateFullscreenButton();
  if (cachedCalendarData) {
    requestAnimationFrame(() => {
      renderCachedSchedule();
      reapplyScheduleFonts();
    });
  }
});
document.addEventListener('webkitfullscreenchange', () => {
  updateFullscreenButton();
  if (cachedCalendarData) {
    requestAnimationFrame(() => {
      renderCachedSchedule();
      reapplyScheduleFonts();
    });
  }
});
updateFullscreenButton();

modalClose.addEventListener('click', () => modal.classList.add('hidden'));
modal.addEventListener('click', (e) => {
  if (e.target === modal) modal.classList.add('hidden');
});

function updateStatusClock() {
  if (!statusClockEl) return;
  const now = new Date();
  const dateEl = statusClockEl.querySelector('.status-clock-date');
  const timeEl = statusClockEl.querySelector('.status-clock-time');
  if (dateEl) {
    dateEl.textContent = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${WEEKDAY_LABELS[now.getDay()]}`;
  }
  if (timeEl) {
    timeEl.textContent = now.toLocaleTimeString('ko-KR', {
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

setInterval(() => {
  const todayKey = new Date().toDateString();
  if (todayKey !== lastTodayKey && cachedCalendarData) {
    renderCachedSchedule();
  }
}, 60_000);

setInterval(async () => {
  try {
    await loadSheetCalendar();
  } catch {
    /* 시트 동기화 실패는 무시 */
  }
}, 60_000);

setInterval(async () => {
  try {
    await loadSheetStatus();
  } catch {
    /* 학생/학교 정보 동기화 실패는 무시 */
  }
}, 60_000);

updateStatusClock();
setInterval(updateStatusClock, 1000);
scheduleTodayRefresh();
requestAnimationFrame(() => syncStatusLayout());

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
