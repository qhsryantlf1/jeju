import { loadCalendarData } from './pdfParser.js';
import { saveUploadedCalendar, loadUploadedCalendar } from './calendarStorage.js';
import { fetchSharedCalendar, saveSharedCalendar } from './calendarServer.js';
import { renderTvSchedule, getScheduleOptions } from './tvSchedule.js';

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

function cloneBuffer(buffer) {
  return buffer.slice(0);
}
const pdfUpload = document.getElementById('pdf-upload');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const toast = document.getElementById('toast');
const modal = document.getElementById('modal');
const modalText = document.getElementById('modal-text');
const modalClose = document.getElementById('modal-close');

function setGradeHighlight(grade) {
  document.querySelectorAll('.grade-highlight').forEach((el) => {
    el.classList.toggle('active', grade !== null && el.dataset.grade === String(grade));
  });
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

function applySharedCalendar(shared) {
  cachedCalendarData = shared.data;
  scheduleMeta = shared.meta ?? {};
  sharedSavedAt = shared.savedAt ?? 0;
  useCachedLayout = false;
  saveUploadedCalendar(cachedCalendarData, scheduleMeta);
  renderCachedSchedule();
}

async function init() {
  try {
    pdfViewerEl.innerHTML = '<div class="viewer-loading">일정 불러오는 중...</div>';

    try {
      const shared = await fetchSharedCalendar();
      if (shared?.data?.length) {
        applySharedCalendar(shared);
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
      return;
    }

    const res = await fetch('/assets/calendar.pdf');
    if (!res.ok) throw new Error(`PDF 파일을 찾을 수 없습니다 (${res.status})`);
    await renderBoard(await res.arrayBuffer());
  } catch (err) {
    console.error('초기화 실패:', err);
    showViewerError(err.message || '초기화에 실패했습니다.');
  }
}

async function handlePdfUpload(file) {
  if (!file?.name?.toLowerCase().endsWith('.pdf')) {
    showToast('PDF 파일만 업로드할 수 있습니다');
    return;
  }
  useCachedLayout = false;
  try {
    pdfViewerEl.innerHTML = '<div class="viewer-loading">PDF 분석 중...</div>';
    const buffer = await file.arrayBuffer();
    currentBuffer = cloneBuffer(buffer);
    cachedCalendarData = await loadCalendarData(cloneBuffer(buffer), { forceParse: true, file });
    const now = new Date();
    scheduleMeta = { fileName: file.name, year: now.getFullYear(), month: now.getMonth() + 1 };
    await saveSharedCalendar({ data: cachedCalendarData, meta: scheduleMeta });
    saveUploadedCalendar(cachedCalendarData, scheduleMeta);
    sharedSavedAt = Date.now();
    renderCachedSchedule();
    showToast(`${file.name} 업로드 완료 (전체 공유)`);
  } catch (err) {
    console.error('PDF 업로드 실패:', err);
    const msg = err.message || 'PDF를 인식하지 못했습니다.';
    showViewerError(msg);
    showToast(msg.length > 40 ? 'PDF 인식 실패' : msg);
  }
  pdfUpload.value = '';
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (cachedCalendarData) renderCachedSchedule();
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

async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

function setupHotspots() {
  document.querySelectorAll('.hotspot').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      if (action === 'xroshot') {
        await copyText('ID: jejusms\nPW: 과학고2014?');
        showToast('xroshot 계정 정보가 복사되었습니다');
        window.open('https://www.xroshot.com', '_blank');
      } else if (action === 'wifi') {
        await copyText('jejushs191876');
        showToast('와이파이 비밀번호 복사 완료📋');
      } else if (action === 'happynet') {
        showModal('<strong>해피넷</strong><br><span style="font-size:2rem;color:#e74c3c">📞 748-2257</span>');
      }
    });
  });
}

pdfUpload.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) handlePdfUpload(file);
});

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
document.addEventListener('fullscreenchange', updateFullscreenButton);
document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
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
    const shared = await fetchSharedCalendar();
    if (!shared?.data?.length) return;
    const savedAt = shared.savedAt ?? 0;
    if (savedAt > sharedSavedAt) {
      applySharedCalendar(shared);
    }
  } catch {
    /* 서버 동기화 실패는 무시 */
  }
}, 60_000);

setupHotspots();
updateStatusClock();
setInterval(updateStatusClock, 1000);
scheduleTodayRefresh();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
