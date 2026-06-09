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
  plugins: [pdfParseApi()],
  server: { port: 5173, open: true },
});
