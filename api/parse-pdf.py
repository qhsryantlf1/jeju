import cgi
import io
import json
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "lib"))

from parse_pdf_lib import parse_pdf_bytes  # noqa: E402


def read_pdf_payload(handler):
    content_type = handler.headers.get("Content-Type", "")
    length = int(handler.headers.get("Content-Length", 0))
    if length <= 0:
        return b""

    body = handler.rfile.read(length)
    if "multipart/form-data" in content_type:
        environ = {
            "REQUEST_METHOD": "POST",
            "CONTENT_TYPE": content_type,
            "CONTENT_LENGTH": str(length),
        }
        form = cgi.FieldStorage(fp=io.BytesIO(body), environ=environ, keep_blank_values=True)
        if "file" in form:
            return form["file"].file.read()
    return body


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
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        self._send_json(200, {"ok": True, "service": "parse-pdf"})

    def do_POST(self):
        try:
            pdf_bytes = read_pdf_payload(self)
            if not pdf_bytes:
                self._send_json(400, {"error": "PDF 데이터가 비어 있습니다."})
                return
            self._send_json(200, parse_pdf_bytes(pdf_bytes))
        except Exception as err:
            self._send_json(500, {"error": str(err) or "PDF 파싱 실패"})
