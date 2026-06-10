import json
import os
import sys
from http.server import BaseHTTPRequestHandler

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "lib"))

from parse_sheet_lib import DEFAULT_SHEET_ID, parse_status_sheets  # noqa: E402

SHEET_ID = os.environ.get("GOOGLE_SHEET_ID", DEFAULT_SHEET_ID)


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        try:
            payload = parse_status_sheets(SHEET_ID)
            self._send_json(200, {"ok": True, **payload})
        except Exception as err:
            self._send_json(500, {"error": str(err) or "학생/학교 정보 불러오기 실패"})
