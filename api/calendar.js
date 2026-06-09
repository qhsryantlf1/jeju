import { get, put } from '@vercel/blob';

const BLOB_PATH = 'calendar/current.json';

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(payload));
}

async function loadSharedCalendar() {
  const result = await get(BLOB_PATH, { access: 'private' });
  if (!result || result.statusCode !== 200) return null;

  const text = await new Response(result.stream).text();
  return JSON.parse(text);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.end();
    return;
  }

  if (req.method === 'GET') {
    try {
      const payload = await loadSharedCalendar();
      if (!payload) {
        sendJson(res, 404, { error: '저장된 일정이 없습니다.' });
        return;
      }
      sendJson(res, 200, payload);
    } catch (err) {
      sendJson(res, 500, { error: err.message || '일정 불러오기 실패' });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const chunks = [];
      await new Promise((resolve, reject) => {
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', resolve);
        req.on('error', reject);
      });

      const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!Array.isArray(payload?.data) || payload.data.length === 0) {
        sendJson(res, 400, { error: '일정 데이터가 올바르지 않습니다.' });
        return;
      }

      const stored = {
        version: 2,
        savedAt: Date.now(),
        data: payload.data,
        meta: payload.meta ?? {},
      };

      await put(BLOB_PATH, JSON.stringify(stored), {
        access: 'private',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true,
      });

      sendJson(res, 200, { ok: true, savedAt: stored.savedAt });
    } catch (err) {
      const message = err.message || '일정 저장 실패';
      const hint = /token|credential|unauthorized|authentication/i.test(message)
        ? 'Vercel 대시보드에서 Blob Storage를 연결한 뒤 재배포해 주세요.'
        : message;
      sendJson(res, 500, { error: hint });
    }
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed' });
}
