import hashlib
import hmac
import os
import time
from typing import Literal

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from omr.engine import OmrError, recognize

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Point(StrictModel):
    x: float
    y: float


class Scores(StrictModel):
    A: float = Field(ge=0, le=1)
    B: float = Field(ge=0, le=1)
    C: float = Field(ge=0, le=1)
    D: float = Field(ge=0, le=1)
    E: float = Field(ge=0, le=1)


class Centers(StrictModel):
    A: Point
    B: Point
    C: Point
    D: Point
    E: Point


class Question(StrictModel):
    number: int = Field(ge=1, le=40)
    marked: list[Literal["A", "B", "C", "D", "E"]] = Field(max_length=5)
    status: Literal["MARKED", "BLANK", "MULTIPLE", "UNCERTAIN"]
    scores: Scores
    fillRatios: Scores
    centers: Centers
    needsReview: bool
    confidence: float = Field(ge=0, le=1)


class Geometry(StrictModel):
    width: int = Field(gt=0)
    height: int = Field(gt=0)


class Quality(StrictModel):
    markerError: int = Field(ge=0, le=2)
    markerSpan: float = Field(gt=0)
    scale: float = Field(gt=0)


class Card(StrictModel):
    layoutVersion: Literal[2]
    qrRaw: str
    geometry: Geometry
    questions: list[Question] = Field(min_length=1, max_length=40)
    quality: Quality
    previewJpegBase64: str


class Success(StrictModel):
    version: Literal[1]
    status: Literal["SUCCESS"]
    cards: list[Card] = Field(min_length=1, max_length=2)


@app.post("/analyze", response_model=Success)
async def analyze(
    request: Request,
    x_omr_questions: int = Header(...),
    x_omr_timestamp: int = Header(...),
    x_omr_signature: str = Header(...),
):
    secret = os.getenv("OMR_SHARED_SECRET", "")
    if len(secret.encode()) < 32:
        raise HTTPException(503, "Serviço OMR sem autenticação configurada.")
    if abs(time.time() - x_omr_timestamp) > 120:
        raise HTTPException(401, "Requisição expirada.")
    if not 1 <= x_omr_questions <= 40:
        raise HTTPException(422, "Quantidade de questões inválida.")
    if request.headers.get("content-type") not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(415, "Formato de imagem inválido.")
    body = await request.body()
    if not body or len(body) > 3_700_000:
        raise HTTPException(413, "Imagem vazia ou acima do limite.")
    digest = hashlib.sha256(body).hexdigest()
    message = f"v1:{x_omr_timestamp}:{x_omr_questions}:{digest}".encode()
    expected = hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, x_omr_signature):
        raise HTTPException(401, "Assinatura interna inválida.")
    try:
        return recognize(body, x_omr_questions)
    except OmrError as exc:
        return JSONResponse(status_code=422, content={"version": 1, "status": "ERROR", "code": exc.code, "message": str(exc)})
