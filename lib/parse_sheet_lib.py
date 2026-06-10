import io
import re
import urllib.parse
import urllib.request

from openpyxl import load_workbook
from openpyxl.cell.rich_text import CellRichText

WEEKDAYS = {"일", "월", "화", "수", "목", "금", "토"}
DEFAULT_SHEET_ID = "1iF35MTE-aRmYOaAWhUpTypASiI030VJV6rCGbcATF0I"
DEFAULT_COLOR = "#000000"
THEME_COLORS = {
    0: "#000000",
    1: "#000000",
    2: "#ff0000",
    3: "#00ff00",
    4: "#0000ff",
    5: "#ffff00",
    6: "#ff00ff",
    7: "#00ffff",
    9: "#ff9900",
    10: "#666666",
}


def sheet_xlsx_url(sheet_id: str, tab_name: str) -> str:
    query = urllib.parse.urlencode({"format": "xlsx", "sheet": tab_name})
    return f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?{query}"


def fetch_sheet_xlsx(sheet_id: str, tab_name: str) -> bytes:
    url = sheet_xlsx_url(sheet_id, tab_name)
    request = urllib.request.Request(url, headers={"User-Agent": "jeju-tv-bulletin/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def font_color_hex(font) -> str:
    if not font or not font.color:
        return DEFAULT_COLOR

    color = font.color
    if color.type == "rgb" and color.rgb:
        rgb = color.rgb[-6:].lower()
        if rgb in {"ffffff", "000000"}:
            return DEFAULT_COLOR
        return f"#{rgb}"

    if color.type == "theme":
        return THEME_COLORS.get(color.theme, DEFAULT_COLOR)

    return DEFAULT_COLOR


def parse_styled_lines(cell) -> list[dict]:
    lines = []
    default_color = font_color_hex(cell.font)

    if isinstance(cell.value, CellRichText):
        for block in cell.value:
            text = str(block)
            color = font_color_hex(block.font) or default_color
            for part in text.split("\n"):
                part = part.strip()
                if part:
                    lines.append({"text": part, "color": color})
        return lines

    if cell.value in (None, ""):
        return lines

    text = str(cell.value).strip()
    color = default_color
    for part in text.split("\n"):
        part = part.strip()
        if part:
            lines.append({"text": part, "color": color})
    return lines


def expand_slash_styled(event_lines, dept_lines, guide_lines):
    out_events, out_event_colors = [], []
    out_depts, out_dept_colors = [], []
    out_guides, out_guide_colors = [], []

    if not event_lines:
        for guide in guide_lines:
            if not guide["text"]:
                continue
            out_events.append("")
            out_event_colors.append(DEFAULT_COLOR)
            out_depts.append("")
            out_dept_colors.append(DEFAULT_COLOR)
            out_guides.append(guide["text"])
            out_guide_colors.append(guide["color"])
        return (
            out_events,
            out_event_colors,
            out_depts,
            out_dept_colors,
            out_guides,
            out_guide_colors,
        )

    for idx, event in enumerate(event_lines):
        dept = dept_lines[idx] if idx < len(dept_lines) else (dept_lines[0] if len(dept_lines) == 1 else {"text": "", "color": DEFAULT_COLOR})
        guide = guide_lines[idx] if idx < len(guide_lines) else (guide_lines[0] if len(guide_lines) == 1 else {"text": "", "color": DEFAULT_COLOR})

        parts = [p.strip() for p in re.split(r"\s+/\s+", event["text"]) if p.strip()]
        split_events = parts if len(parts) > 1 else [event["text"]]

        for part in split_events:
            out_events.append(part)
            out_event_colors.append(event["color"])
            out_depts.append(dept["text"])
            out_dept_colors.append(dept["color"])
            out_guides.append(guide["text"])
            out_guide_colors.append(guide["color"])

    return (
        out_events,
        out_event_colors,
        out_depts,
        out_dept_colors,
        out_guides,
        out_guide_colors,
    )


def parse_title_meta(ws) -> dict:
    for row in range(1, 6):
        title = str(ws.cell(row, 1).value or "").strip()
        if not title:
            continue
        match = re.search(r"(\d{4})학년도\s*(\d{1,2})월", title)
        if match:
            return {
                "title": title,
                "year": int(match.group(1)),
                "month": int(match.group(2)),
            }
        match = re.search(r"(\d{1,2})월", title)
        if match:
            return {"title": title, "month": int(match.group(1))}
    return {}


def normalize_day(value) -> int | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return int(value)
    text = str(value).strip()
    if text.isdigit():
        return int(text)
    return None


def parse_sheet_workbook(ws) -> tuple[list, dict]:
    meta = parse_title_meta(ws)
    days = []

    for row in range(1, ws.max_row + 1):
        day = normalize_day(ws.cell(row, 1).value)
        weekday = str(ws.cell(row, 2).value or "").strip()
        if day is None or weekday not in WEEKDAYS:
            continue

        event_lines = parse_styled_lines(ws.cell(row, 3))
        dept_lines = parse_styled_lines(ws.cell(row, 4))
        guide_lines = parse_styled_lines(ws.cell(row, 5))

        (
            events,
            event_colors,
            departments,
            department_colors,
            life_guides,
            life_guide_colors,
        ) = expand_slash_styled(event_lines, dept_lines, guide_lines)

        days.append({
            "day": day,
            "weekday": weekday,
            "events": events,
            "eventColors": event_colors,
            "departments": departments,
            "departmentColors": department_colors,
            "lifeGuides": life_guides,
            "lifeGuideColors": life_guide_colors,
            "dayColor": font_color_hex(ws.cell(row, 1).font),
            "weekdayColor": font_color_hex(ws.cell(row, 2).font),
        })

    days.sort(key=lambda item: item["day"])
    return days, meta


def parse_google_sheet(sheet_id: str, tab_name: str) -> dict:
    workbook = load_workbook(
        io.BytesIO(fetch_sheet_xlsx(sheet_id, tab_name)),
        data_only=False,
        rich_text=True,
    )
    worksheet = workbook[tab_name] if tab_name in workbook.sheetnames else workbook.worksheets[0]
    data, meta = parse_sheet_workbook(worksheet)
    if not data:
        raise ValueError("시트에서 일정 데이터를 찾지 못했습니다.")

    return {
        "data": data,
        "meta": {
            "source": "google-sheet",
            "sheetId": sheet_id,
            "tab": tab_name,
            **meta,
        },
    }
