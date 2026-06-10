function inferGrade(value) {
  const text = String(value ?? '').trim();
  if (/^[123]-\d/.test(text)) return text.charAt(0);
  if (text.includes('1학년')) return '1';
  if (text.includes('2학년')) return '2';
  if (text.includes('3학년')) return '3';
  return null;
}

function applyCellStyle(td, cell) {
  if (cell.bg) td.style.backgroundColor = cell.bg;
  if (cell.color) td.style.color = cell.color;
  if (cell.bold) td.style.fontWeight = '700';
  if (cell.colspan) td.colSpan = cell.colspan;
  if (cell.rowspan) td.rowSpan = cell.rowspan;
}

function buildTable(tableData, { headerRowIndex = null, gradeRows = false } = {}) {
  const table = document.createElement('table');
  table.className = 'status-table';

  if (gradeRows) {
    const colgroup = document.createElement('colgroup');
    ['15%', '22%', '22%', '11%', '11%', '13%'].forEach((width) => {
      const col = document.createElement('col');
      col.style.width = width;
      colgroup.appendChild(col);
    });
    table.appendChild(colgroup);
  }

  tableData.rows.forEach((row, rowIndex) => {
    const tr = document.createElement('tr');

    if (gradeRows) {
      const grade = row.cells.map((cell) => inferGrade(cell.value)).find(Boolean);
      if (grade) tr.dataset.grade = grade;
    }

    if (headerRowIndex !== null && rowIndex === headerRowIndex) {
      tr.className = 'status-header-row';
    }

    if (rowIndex === 0 && row.cells.some((cell) => cell.colspan && cell.colspan > 1)) {
      tr.className = 'status-title-row';
    }

    row.cells.forEach((cell) => {
      const td = document.createElement('td');
      td.textContent = cell.value;
      applyCellStyle(td, cell);
      tr.appendChild(td);
    });

    table.appendChild(tr);
  });

  return table;
}

function tuneStudentColWidths(table) {
  const wrap = table.closest('.status-sheet-inner');
  const colgroup = table.querySelector('colgroup');
  if (!wrap || !colgroup || colgroup.children.length < 6 || wrap.clientWidth <= 0) return;

  const fontSize = Number.parseFloat(getComputedStyle(table).fontSize) || 12;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.font = `700 ${fontSize}px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`;

  let maxTextW = 0;
  table.querySelectorAll('tr:not(.status-title-row) td:first-child').forEach((td) => {
    const text = td.textContent?.trim() ?? '';
    if (!text) return;
    maxTextW = Math.max(maxTextW, ctx.measureText(text).width);
  });

  const tableWidth = wrap.clientWidth;
  const gradeWidth = Math.min(
    Math.ceil(maxTextW) + 10,
    Math.floor(tableWidth * 0.17),
  );
  const remain = Math.max(tableWidth - gradeWidth, 0);
  const restRatios = [0.24, 0.24, 0.12, 0.12, 0.14];
  const ratioSum = restRatios.reduce((sum, ratio) => sum + ratio, 0);

  colgroup.children[0].style.width = `${gradeWidth}px`;
  restRatios.forEach((ratio, index) => {
    colgroup.children[index + 1].style.width = `${(remain * ratio) / ratioSum}px`;
  });
}

let cachedSchoolFontPx = 16;

function fitTableFont(table, maxPx = 21, minPx = 9) {
  const wrap = table.closest('.status-sheet-inner');
  if (!wrap || wrap.clientHeight <= 0) return maxPx;

  let size = maxPx;
  table.style.fontSize = `${size}px`;

  while (size > minPx && (
    table.scrollHeight > wrap.clientHeight + 1
    || table.scrollWidth > wrap.clientWidth + 1
  )) {
    size -= 1;
    table.style.fontSize = `${size}px`;
  }

  if (table.closest('#school-info')) {
    cachedSchoolFontPx = size;
  }

  return size;
}

export function getSchoolInfoFontSize() {
  const table = document.querySelector('#school-info .status-table');
  if (table) {
    const px = Number.parseFloat(getComputedStyle(table).fontSize);
    if (Number.isFinite(px) && px > 0) {
      cachedSchoolFontPx = px;
      return px;
    }
  }
  return cachedSchoolFontPx;
}

export function renderStatusPanel(payload) {
  const studentEl = document.getElementById('student-status');
  const schoolEl = document.getElementById('school-info');
  if (!studentEl || !schoolEl) return Promise.resolve();

  studentEl.innerHTML = '';
  schoolEl.innerHTML = '';

  if (payload.student.titleImage?.dataUrl) {
    const banner = document.createElement('div');
    banner.className = 'status-student-title';
    banner.setAttribute('role', 'img');
    banner.setAttribute('aria-label', payload.student.title || '제주과학고등학교 학생 현황');
    banner.style.backgroundImage = `url(${payload.student.titleImage.dataUrl})`;
    if (payload.student.titleImage.aspect) {
      banner.style.aspectRatio = `${1 / payload.student.titleImage.aspect}`;
    }
    studentEl.appendChild(banner);
  }

  const studentInner = document.createElement('div');
  studentInner.className = 'status-sheet-inner';
  const studentTable = buildTable(payload.student, { headerRowIndex: 0, gradeRows: true });
  studentInner.appendChild(studentTable);
  studentEl.appendChild(studentInner);

  const schoolInner = document.createElement('div');
  schoolInner.className = 'status-sheet-inner';
  const schoolTable = buildTable(payload.school);
  schoolInner.appendChild(schoolTable);
  schoolEl.appendChild(schoolInner);

  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      fitTableFont(studentTable, 21, 8);
      tuneStudentColWidths(studentTable);
      fitTableFont(schoolTable, 16, 8);
      resolve();
    });
  });
}

export function setStatusGradeHighlight(grade) {
  document.querySelectorAll('#student-status tr[data-grade]').forEach((row) => {
    row.classList.toggle('grade-active', grade !== null && row.dataset.grade === String(grade));
  });
}

export function refitStatusTables() {
  document.querySelectorAll('.status-table').forEach((table) => {
    const isStudent = table.closest('#student-status');
    fitTableFont(table, isStudent ? 21 : 16, 8);
    if (isStudent) tuneStudentColWidths(table);
  });
}
