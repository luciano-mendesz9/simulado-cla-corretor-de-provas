"""Conservative OMR for CLA's framed, dot-numbered markers (not ArUco)."""
from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from itertools import combinations
import base64

import cv2
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

from .layout import HEIGHT, LAYOUT, LETTERS, SCALE, WIDTH, bubbles


class OmrError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class Candidate:
    x: float
    y: float
    size: float
    solid: bool


def decode_image(data: bytes) -> np.ndarray:
    if len(data) > 3_700_000:
        raise OmrError("FILE_TOO_LARGE", "A imagem excede 3,7 MB.")
    try:
        image = Image.open(BytesIO(data))
        if image.format not in ("JPEG", "PNG", "WEBP"):
            raise OmrError("INVALID_FORMAT", "Use JPEG, PNG ou WebP.")
        width, height = image.size
        if min(width, height) < 700 or width * height > 24_000_000:
            raise OmrError("BAD_RESOLUTION", "A imagem precisa ter ao menos 700 pixels no lado menor e no máximo 24 megapixels.")
        image = ImageOps.exif_transpose(image)
        image.load()
        width, height = image.size
        ratio = min(1.0, 3000 / max(width, height))
        if ratio < 1:
            image = image.resize((round(width * ratio), round(height * ratio)), Image.Resampling.LANCZOS)
        gray = cv2.cvtColor(np.asarray(image.convert("RGB")), cv2.COLOR_RGB2GRAY)
        if cv2.Laplacian(gray, cv2.CV_64F).var() < 8:
            raise OmrError("BLURRY_IMAGE", "A fotografia está desfocada. Refaça a captura com a câmera estável e boa luz.")
        return gray
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise OmrError("INVALID_IMAGE", "Imagem inválida ou danificada.") from exc


def candidates(gray: np.ndarray) -> list[Candidate]:
    height, width = gray.shape
    local = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 41, 15)
    contours, _ = cv2.findContours(local, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    found: list[Candidate] = []
    low = max(12, min(width, height) / 105)
    high = min(width, height) / 8
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if not (low <= w <= high and low <= h <= high and .68 <= w / h <= 1.48):
            continue
        area = cv2.contourArea(contour)
        if area < w * h * .55:
            continue
        # Look at the printed frame, not the contour area: white center and dark ring.
        roi = gray[y:y+h, x:x+w]
        center = roi[round(h*.38):round(h*.62), round(w*.38):round(w*.62)]
        ring = np.concatenate((roi[:max(1, round(h*.12)), :].ravel(), roi[-max(1, round(h*.12)):, :].ravel()))
        if center.size == 0 or ring.size == 0:
            continue
        inner_light = float(np.mean(center > 140))
        edge_dark = float(np.mean(ring < 120))
        solid = inner_light < .22 and edge_dark > .68
        if not solid and (inner_light < .55 or edge_dark < .48):
            continue
        candidate = Candidate(x + w/2, y + h/2, float(max(w, h)), solid)
        if not any(np.hypot(candidate.x - old.x, candidate.y - old.y) < min(candidate.size, old.size) * .35 for old in found):
            found.append(candidate)
    return sorted(found, key=lambda c: c.size, reverse=True)[:16]


def _sample(gray: np.ndarray, x: float, y: float, radius: int = 2) -> float:
    ix, iy = round(x), round(y)
    h, w = gray.shape
    if ix-radius < 0 or iy-radius < 0 or ix+radius >= w or iy+radius >= h:
        return 0
    return float(np.median(gray[iy-radius:iy+radius+1, ix-radius:ix+radius+1]))


def marker_error(card: np.ndarray) -> int:
    error = 0
    for marker in LAYOUT["markers"]:
        x, y = marker["x"] * SCALE, marker["y"] * SCALE
        background = _sample(card, x, y, 2)
        if background < 115:
            return 99
        for dot, (dx, dy) in enumerate(((-3,-3),(3,-3),(-3,3),(3,3))):
            dark = _sample(card, x + dx*SCALE, y + dy*SCALE, 2) < background - 38
            if dark != (dot < marker["id"]):
                error += 1
        if _sample(card, x+7*SCALE, y, 2) > background-38:
            return 99
    return error


def alignments(gray: np.ndarray):
    found = [c for c in candidates(gray) if not c.solid]
    source = np.float32([[m["x"]*SCALE, m["y"]*SCALE] for m in LAYOUT["markers"]])
    matched = []
    for group in combinations(enumerate(found), 4):
        ids, points = zip(*group)
        if max(point.size for point in points) / min(point.size for point in points) > 1.45:
            continue
        center = np.mean([[p.x,p.y] for p in points], axis=0)
        order = sorted(range(4), key=lambda i: np.arctan2(points[i].y-center[1], points[i].x-center[0]))
        ordered = [points[i] for i in order]
        side = [np.hypot(ordered[i].x-ordered[(i+1)%4].x, ordered[i].y-ordered[(i+1)%4].y) for i in range(4)]
        paired = [side[0]+side[2], side[1]+side[3]]
        if min(paired) < 700 or not 1.12 < max(paired)/min(paired) < 2.15 or max(side)/min(side) > 2.1:
            continue
        for turn in range(4):
            positions = [order[(i+turn)%4] for i in range(4)]
            target = np.float32([[points[i].x,points[i].y] for i in positions])
            matrix = cv2.getPerspectiveTransform(target, source)
            card = cv2.warpPerspective(gray, matrix, (WIDTH, HEIGHT), flags=cv2.INTER_LINEAR, borderValue=255)
            error = marker_error(card)
            if error <= 2:
                matched.append((error, -min(paired), tuple(ids[i] for i in positions), card))
    matched.sort(key=lambda item: (item[0], item[1]))
    return matched


def read_qr(card: np.ndarray) -> str | None:
    qr = LAYOUT["qr"]
    pad = 7*SCALE
    x = max(0, round(qr["x"]*SCALE)-pad)
    y = max(0, round(qr["y"]*SCALE)-pad)
    size = round(qr["size"]*SCALE)+2*pad
    crop = card[y:y+size, x:x+size]
    reader = cv2.QRCodeDetector()
    for candidate in (crop, cv2.resize(crop, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC), cv2.adaptiveThreshold(crop,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY,31,7)):
        value, _, _ = reader.detectAndDecode(candidate)
        if value:
            return value
    return None


def read_questions(card: np.ndarray, questions: int):
    positions = list(bubbles(questions))
    result = []
    for number in range(1, questions+1):
        scores, centers, fill_ratios = {}, {}, {}
        for _, letter, x, y in positions[(number-1)*5:number*5]:
            radius = LAYOUT["bubbleInnerRadius"] * SCALE * .82
            left, top = round(x-radius), round(y-radius)
            right, bottom = round(x+radius+1), round(y+radius+1)
            roi = card[top:bottom,left:right]
            yy, xx = np.ogrid[top:bottom,left:right]
            mask = (xx-x)**2 + (yy-y)**2 <= radius**2
            ink = roi[mask]
            paper = np.array([_sample(card,x,y-6.5*SCALE,2), _sample(card,x,y+6.5*SCALE,2)])
            background = float(np.median(paper))
            dark = np.mean(ink < min(175, background-38))
            contrast = max(0., (background-float(np.mean(ink)))/max(80.,background-25.))
            score = round(float(min(1., .6*dark+.4*contrast)), 3)
            scores[letter] = score
            fill_ratios[letter] = round(float(dark),3)
            centers[letter] = {"x": round(x,2), "y": round(y,2)}
        ordered = sorted(scores.values())
        background = float(np.median(ordered[:3]))
        marked = [letter for letter in LETTERS if scores[letter] >= max(.30,background+.22)]
        uncertain = any(max(.07,background+.06) <= score < max(.30,background+.22) for score in scores.values())
        if len(marked) == 1 and any(letter not in marked and scores[letter] >= max(.20, background+.14) for letter in LETTERS):
            uncertain = True
        status = "UNCERTAIN" if uncertain else "MULTIPLE" if len(marked)>1 else "MARKED" if marked else "BLANK"
        result.append({"number":number,"marked":marked if status != "UNCERTAIN" else [],"status":status,"scores":scores,"fillRatios":fill_ratios,"centers":centers,"needsReview":status=="UNCERTAIN","confidence":round(min(1., max(0., min(abs(s-max(.30,background+.22)) for s in scores.values())/.22)),3)})
    return result


def recognize(data: bytes, questions: int) -> dict:
    image = decode_image(data)
    matches = alignments(image)
    if not matches:
        if len([c for c in candidates(image) if c.solid]) >= 4:
            raise OmrError("UNSUPPORTED_CARD_LAYOUT", "A imagem parece usar os quadrados sólidos da prévia antiga. Gere o PDF oficial com marcadores ópticos.")
        raise OmrError("MARKERS_MISSING", "Não foi possível localizar os quatro marcadores ópticos. Confira o PDF e os cantos do cartão.")
    cards, used = [], set()
    for error, span, ids, card in matches:
        if any(i in used for i in ids):
            continue
        qr = read_qr(card)
        if not qr:
            continue
        readings = read_questions(card, questions)
        ok, jpg = cv2.imencode(".jpg", card, [cv2.IMWRITE_JPEG_QUALITY, 72])
        if not ok or len(jpg) > 440_000:
            ok, jpg = cv2.imencode(".jpg", card, [cv2.IMWRITE_JPEG_QUALITY, 55])
        if not ok or len(jpg) > 440_000:
            raise OmrError("PREVIEW_TOO_LARGE", "Prévia grande demais; fotografe com menos ruído e melhor luz.")
        cards.append({"layoutVersion":LAYOUT["version"],"qrRaw":qr,"geometry":{"width":WIDTH,"height":HEIGHT},"questions":readings,"quality":{"markerError":error,"markerSpan":round(-span/2),"scale":SCALE},"previewJpegBase64":base64.b64encode(jpg).decode("ascii")})
        used.update(ids)
        if len(cards)==2:
            break
    if not cards:
        raise OmrError("QR_UNREADABLE", "Não foi possível ler o QR Code. Fotografe novamente com mais nitidez e iluminação uniforme.")
    return {"version":1,"status":"SUCCESS","cards":cards}
