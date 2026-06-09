import json
from http.server import BaseHTTPRequestHandler

from parse_pdf_lib import parse_pdf_bytes


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0:
                self._send_json(400, {"error": "PDF 데이터가 비어 있습니다."})
                return

            pdf_bytes = self.rfile.read(length)
            data = parse_pdf_bytes(pdf_bytes)
            self._send_json(200, data)
        except Exception as err:
            self._send_json(500, {"error": str(err) or "PDF 파싱 실패"})
