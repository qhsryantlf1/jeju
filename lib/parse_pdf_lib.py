import io
import re

import pdfplumber


def expand_slash(events, depts, guides):
    out_e, out_d, out_g = [], [], []
    for i, ev in enumerate(events):
        dept = depts[i] if i < len(depts) else (depts[0] if len(depts) == 1 else "")
        guide = guides[i] if i < len(guides) else (guides[0] if len(guides) == 1 else "")
        parts = [p.strip() for p in re.split(r"\s+/\s+", ev) if p.strip()]
        lines = parts if len(parts) > 1 else [ev]
        for line in lines:
            out_e.append(line)
            out_d.append(dept)
            out_g.append(guide)
    return out_e, out_d, out_g


def parse_pdf_bytes(pdf_bytes: bytes) -> list:
    rows = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for table in pdf.pages[0].extract_tables():
            for row in table:
                if not row or not row[0] or not str(row[0]).strip().isdigit():
                    continue
                raw_events = [e.strip() for e in (row[2] or "").split("\n") if e.strip()]
                raw_depts = [d.strip() for d in (row[3] or "").split("\n") if d.strip()]
                raw_guides = (
                    [g.strip() for g in (row[4] or "").split("\n") if g.strip()]
                    if len(row) > 4 and row[4]
                    else []
                )
                events, depts, guides = expand_slash(raw_events, raw_depts, raw_guides)
                rows.append({
                    "day": int(str(row[0]).strip()),
                    "weekday": (row[1] or "").strip(),
                    "events": events,
                    "departments": depts,
                    "lifeGuides": guides,
                })
    return rows
