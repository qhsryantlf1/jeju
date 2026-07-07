"""Render 등 상시 실행 환경용 통합 서버.

정적 파일(dist/)과 시트 API를 한 프로세스로 서빙한다.
시트 파싱 결과를 메모리에 TTL 캐시해 CPU 사용을 최소화한다
(파싱은 캐시 만료 시에만 실행, 실패 시 마지막 정상 데이터로 응답).
"""

import json
import os
import sys
import tempfile
import threading
import time

from flask import Flask, jsonify, request, send_from_directory

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, "lib"))

from parse_sheet_lib import DEFAULT_SHEET_ID, parse_google_sheet, parse_status_sheets  # noqa: E402

DIST_DIR = os.path.join(ROOT, "dist")
SHEET_ID = os.environ.get("GOOGLE_SHEET_ID", DEFAULT_SHEET_ID)
SHEET_TAB = os.environ.get("GOOGLE_SHEET_TAB", "6월")
CACHE_TTL = int(os.environ.get("SHEET_CACHE_TTL", "300"))
SHARED_CALENDAR_FILE = os.path.join(
    os.environ.get("DATA_DIR", tempfile.gettempdir()), "jeju-shared-calendar.json"
)

app = Flask(__name__)

_cache: dict[str, tuple[float, dict]] = {}
_cache_locks: dict[str, threading.Lock] = {}
_locks_guard = threading.Lock()


def _get_lock(key: str) -> threading.Lock:
    with _locks_guard:
        return _cache_locks.setdefault(key, threading.Lock())


def cached_fetch(key: str, fetch):
    """TTL 캐시. 만료 후 갱신에 실패하면 마지막 정상 데이터를 유지한다."""
    now = time.time()
    hit = _cache.get(key)
    if hit and hit[0] > now:
        return hit[1]

    with _get_lock(key):
        hit = _cache.get(key)
        if hit and hit[0] > time.time():
            return hit[1]
        try:
            payload = fetch()
        except Exception:
            if hit:  # 갱신 실패 → 일단 이전 데이터로 버티고 1분 뒤 재시도
                _cache[key] = (time.time() + 60, hit[1])
                return hit[1]
            raise
        _cache[key] = (time.time() + CACHE_TTL, payload)
        return payload


def _json_error(err: Exception, fallback: str):
    return jsonify({"error": str(err) or fallback}), 500


@app.get("/api/sheet-calendar")
def sheet_calendar():
    tab = request.args.get("tab") or SHEET_TAB
    sheet_id = request.args.get("sheetId") or SHEET_ID
    try:
        payload = cached_fetch(
            f"calendar:{sheet_id}:{tab}",
            lambda: parse_google_sheet(sheet_id, tab),
        )
        return jsonify({"ok": True, **payload})
    except Exception as err:
        return _json_error(err, "시트 불러오기 실패")


@app.get("/api/sheet-status")
def sheet_status():
    try:
        payload = cached_fetch(
            f"status:{SHEET_ID}",
            lambda: parse_status_sheets(SHEET_ID),
        )
        return jsonify({"ok": True, **payload})
    except Exception as err:
        return _json_error(err, "학생/학교 정보 불러오기 실패")


@app.get("/api/calendar")
def shared_calendar_get():
    if not os.path.isfile(SHARED_CALENDAR_FILE):
        return jsonify({"error": "저장된 일정이 없습니다."}), 404
    with open(SHARED_CALENDAR_FILE, encoding="utf-8") as f:
        return app.response_class(f.read(), mimetype="application/json")


@app.post("/api/calendar")
def shared_calendar_post():
    try:
        body = request.get_json(force=True)
        with open(SHARED_CALENDAR_FILE, "w", encoding="utf-8") as f:
            json.dump(body, f, ensure_ascii=False)
        return jsonify({"ok": True, "savedAt": int(time.time() * 1000)})
    except Exception as err:
        return _json_error(err, "일정 저장 실패")


@app.get("/")
@app.get("/<path:path>")
def static_files(path="index.html"):
    if path != "index.html" and os.path.isfile(os.path.join(DIST_DIR, path)):
        return send_from_directory(DIST_DIR, path)
    return send_from_directory(DIST_DIR, "index.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
