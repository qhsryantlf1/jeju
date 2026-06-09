import { loadCalendarData } from './pdfParser.js';
import { saveUploadedCalendar, loadUploadedCalendar } from './calendarStorage.js';
import { renderTvSchedule } from './tvSchedule.js';

const SCHEDULE_OPTIONS = { year: 2026, month: 6 };

const pdfViewerEl = document.getElementById('pdf-viewer');
let currentBuffer = null;
let cachedCalendarData = null;
let useCachedLayout = true;

function cloneBuffer(buffer) {
  return buffer.slice(0);
}
const pdfUpload = document.getElementById('pdf-upload');
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
    renderTvSchedule(pdfViewerEl, cachedCalendarData, setGradeHighlight, SCHEDULE_OPTIONS);
  } catch (err) {
    console.error('게시판 렌더 실패:', err);
    showViewerError(err.message || '일정을 표시할 수 없습니다.');
  }
}

function renderCachedSchedule() {
  renderTvSchedule(pdfViewerEl, cachedCalendarData, setGradeHighlight, SCHEDULE_OPTIONS);
}

async function init() {
  try {
    const stored = loadUploadedCalendar();
    if (stored) {
      cachedCalendarData = stored.data;
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
    cachedCalendarData = await loadCalendarData(cloneBuffer(buffer), { forceParse: true });
    saveUploadedCalendar(cachedCalendarData, { fileName: file.name });
    renderCachedSchedule();
    showToast(`${file.name} 업로드 완료`);
  } catch (err) {
    console.error('PDF 업로드 실패:', err);
    showViewerError(err.message || 'PDF를 인식하지 못했습니다.');
    showToast('PDF 인식 실패');
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

modalClose.addEventListener('click', () => modal.classList.add('hidden'));
modal.addEventListener('click', (e) => {
  if (e.target === modal) modal.classList.add('hidden');
});

setupHotspots();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
