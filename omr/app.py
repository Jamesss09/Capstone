"""
Code Nexus - OMR/AI service
FastAPI microservice that detects shaded bubbles from answer sheet images,
compares against an answer key, and returns scores.
"""
from fastapi import FastAPI, UploadFile, File
import io

from core.sheet_config import SHEET_SECTIONS, OPTION_COUNT

app = FastAPI(title="Code Nexus OMR Service", version="0.1.0")


@app.get("/health")
def health():
    return {"status": "ok", "service": "code-nexus-omr"}


@app.get("/sheet-config")
def sheet_config():
    """Return the expected section/option layout of the TMC answer sheet."""
    return {"sections": SHEET_SECTIONS, "option_counts": OPTION_COUNT}


@app.post("/recognize")
async def recognize(file: UploadFile = File(...), answer_key_id: int | None = None):
    """Endpoint placeholder: accept an image, return recognized answers + score."""
    contents = await file.read()
    # Phase 2 will implement: preprocess -> detect bubbles -> compare with key
    return {
        "filename": file.filename,
        "size_bytes": len(contents),
        "status": "recognized",
        "answers": {},
        "score": 0,
    }