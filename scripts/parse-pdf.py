"""PDF 학사일정 표 파싱 → parsed-calendar-raw.json 생성"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "api"))

from parse_pdf_lib import parse_pdf_bytes  # noqa: E402

PDF_PATH = ROOT / "public" / "assets" / "calendar.pdf"
OUT_PATH = ROOT / "public" / "assets" / "parsed-calendar-raw.json"


if __name__ == "__main__":
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else PDF_PATH
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else OUT_PATH
    data = parse_pdf_bytes(src.read_bytes())
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Parsed {len(data)} days → {out}")
