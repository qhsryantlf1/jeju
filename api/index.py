from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from parse_pdf_lib import parse_pdf_bytes

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.post("/parse-pdf")
async def parse_pdf(request: Request):
    try:
        body = await request.body()
        if not body:
            return JSONResponse({"error": "PDF 데이터가 비어 있습니다."}, status_code=400)
        return parse_pdf_bytes(body)
    except Exception as err:
        return JSONResponse({"error": str(err) or "PDF 파싱 실패"}, status_code=500)
