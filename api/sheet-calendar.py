import json
import os
import sys
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "lib"))

from parse_sheet_lib import DEFAULT_SHEET_ID, parse_google_sheet  # noqa: E402

SHEET_ID = os.environ.get("GOOGLE_SHEET_ID", DEFAULT_SHEET_ID)
SHEET_TAB = os.environ.get("GOOGLE_SHEET_TAB", "6월")


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
            query = parse_qs(urlparse(self.path).query)
            tab = query.get("tab", [SHEET_TAB])[0] or SHEET_TAB
            sheet_id = query.get("sheetId", [SHEET_ID])[0] or SHEET_ID
            payload = parse_google_sheet(sheet_id, tab)
            self._send_json(200, {"ok": True, **payload})
        except Exception as err:
            self._send_json(500, {"error": str(err) or "시트 불러오기 실패"})
