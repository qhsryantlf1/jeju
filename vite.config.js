import { defineConfig } from 'vite';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PARSE_SCRIPT = path.join(__dirname, 'scripts', 'parse-pdf.py');

function runPdfParse(buffer) {
  return new Promise((resolve, reject) => {
    const tmpPdf = path.join(os.tmpdir(), `jeju-upload-${Date.now()}.pdf`);
    const tmpJson = path.join(os.tmpdir(), `jeju-parsed-${Date.now()}.json`);

    fs.writeFileSync(tmpPdf, buffer);

    const proc = spawn('python', [PARSE_SCRIPT, tmpPdf, tmpJson], {
      cwd: __dirname,
      windowsHide: true,
    });

    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      try { fs.unlinkSync(tmpPdf); } catch { /* ignore */ }

      if (code !== 0) {
        try { fs.unlinkSync(tmpJson); } catch { /* ignore */ }
        reject(new Error(stderr.trim() || 'PDF 파싱에 실패했습니다.'));
        return;
      }

      try {
        const json = fs.readFileSync(tmpJson, 'utf8');
        fs.unlinkSync(tmpJson);
        resolve(JSON.parse(json));
      } catch (err) {
        try { fs.unlinkSync(tmpJson); } catch { /* ignore */ }
        reject(err);
      }
    });
  });
}

const CALENDAR_FILE = path.join(__dirname, 'data', 'shared-calendar.json');

function calendarApiPlugin() {
  const handler = (req, res, next) => {
    if (req.url !== '/api/calendar') {
      next();
      return;
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.end();
      return;
    }

    if (req.method === 'GET') {
      if (!fs.existsSync(CALENDAR_FILE)) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: '저장된 일정이 없습니다.' }));
        return;
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(fs.readFileSync(CALENDAR_FILE, 'utf8'));
      return;
    }

    if (req.method === 'POST') {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        try {
          fs.mkdirSync(path.dirname(CALENDAR_FILE), { recursive: true });
          fs.writeFileSync(CALENDAR_FILE, Buffer.concat(chunks));
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: true, savedAt: Date.now() }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: err.message || '일정 저장 실패' }));
        }
      });
      return;
    }

    next();
  };

  return {
    name: 'calendar-api',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

const SHEET_SCRIPT = path.join(__dirname, 'scripts', 'fetch-sheet.py');
const STATUS_SCRIPT = path.join(__dirname, 'scripts', 'fetch-status.py');

function runPythonScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn('python', [scriptPath], {
      cwd: __dirname,
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
      },
    });

    const chunks = [];
    let stderr = '';
    proc.stdout.on('data', (chunk) => { chunks.push(chunk); });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || '구글 시트 불러오기에 실패했습니다.'));
        return;
      }

      try {
        const stdout = Buffer.concat(chunks).toString('utf8').trim();
        resolve(JSON.parse(stdout));
      } catch (err) {
        reject(err);
      }
    });
  });
}

function runSheetFetch() {
  return runPythonScript(SHEET_SCRIPT);
}

function runStatusFetch() {
  return runPythonScript(STATUS_SCRIPT);
}

/** 로컬 개발용 구글 시트 API */
function sheetCalendarApi() {
  const handler = async (req, res, next) => {
    if (req.url?.split('?')[0] !== '/api/sheet-calendar' || req.method !== 'GET') {
      next();
      return;
    }

    try {
      const data = await runSheetFetch();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(data));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: err.message || '구글 시트 불러오기 실패' }));
    }
  };

  return {
    name: 'sheet-calendar-api',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

/** 로컬 개발용 학생/학교 정보 API */
function sheetStatusApi() {
  const handler = async (req, res, next) => {
    if (req.url?.split('?')[0] !== '/api/sheet-status' || req.method !== 'GET') {
      next();
      return;
    }

    try {
      const data = await runStatusFetch();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(data));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: err.message || '학생/학교 정보 불러오기 실패' }));
    }
  };

  return {
    name: 'sheet-status-api',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

/** 로컬 개발용 PDF 파싱 API (배포는 api/parse-pdf.py 서버리스 함수 사용) */
function pdfParseApi() {
  const handler = (req, res, next) => {
    if (req.url !== '/api/parse-pdf' || req.method !== 'POST') {
      next();
      return;
    }

    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', async () => {
      try {
        const data = await runPdfParse(Buffer.concat(chunks));
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(data));
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: err.message || 'PDF 파싱 실패' }));
      }
    });
  };

  return {
    name: 'pdf-parse-api',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  plugins: [pdfParseApi(), calendarApiPlugin(), sheetCalendarApi(), sheetStatusApi()],
  server: { port: 5173, open: true },
});
