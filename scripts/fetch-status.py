"""학생정보·학교 정보 시트 → JSON (로컬 API / CLI용)"""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "lib"))

from parse_sheet_lib import DEFAULT_SHEET_ID, parse_status_sheets  # noqa: E402

SHEET_ID = os.environ.get("GOOGLE_SHEET_ID", DEFAULT_SHEET_ID)

if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    payload = parse_status_sheets(SHEET_ID)
    sys.stdout.write(json.dumps({"ok": True, **payload}, ensure_ascii=False))
