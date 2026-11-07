"""Scenarios start from the production PDF generator, then alter its rasterization."""
from __future__ import annotations

from pathlib import Path
import json
import os
import subprocess
import time

import cv2
import numpy as np
import pytest
import asyncio
from starlette.requests import Request
from fastapi import HTTPException

from main import analyze
from omr.engine import OmrError, recognize
from omr.layout import LAYOUT, bubbles

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="session")
def pdf_pages(tmp_path_factory):
    directory = tmp_path_factory.mktemp("pdf-cards")
    pages = {}
    for questions, count in ((10, 2), (40, 2), (40, 3)):
        pdf = directory / f"cards-{questions}-{count}.pdf"
        subprocess.run(["node", "--import", "tsx", "scripts/generate-omr-fixture.ts", str(pdf), str(questions), str(count)], cwd=ROOT, check=True)
        prefix = directory / f"page-{questions}-{count}"
        subprocess.run(["pdftoppm", "-scale-to", "2600", "-png", str(pdf), str(prefix)], check=True)
        files = sorted(directory.glob(f"page-{questions}-{count}-*.png"))
        pages[questions, count] = [cv2.imread(str(path)) for path in files]
    return pages


def marked(page, questions, selections, half=0, fill="solid"):
    image = page.copy()
    factor = image.shape[1] / LAYOUT["width"]
    card_top = half * image.shape[0] / 2
    by_question = {(number, letter): (x / 3, y / 3) for number, letter, x, y in bubbles(questions)}
    for question, letters in selections.items():
        for letter in letters:
            x, y = by_question[question, letter]
            center = (round(x*factor), round(card_top+y*factor))
            radius = round(3.5*factor)
            if fill == "weak":
                cv2.circle(image, center, radius, (188,188,188), -1)
            elif fill == "partial":
                cv2.ellipse(image, center, (radius, radius), 0, 20, 285, (15,15,15), -1)
            elif fill == "edge":
                cv2.circle(image, (center[0]+round(1.1*factor),center[1]), round(2.7*factor), (0,0,0), -1)
            else:
                cv2.circle(image, center, radius, (0,0,0), -1)
    return image


def scan(image, quality=87):
    ok, output = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, quality])
    assert ok
    return output.tobytes()


def responses(image, questions, half=0):
    result = recognize(scan(image), questions)
    return result["cards"][half]["questions"]


def selected(readings):
    return {item["number"]: item["marked"] for item in readings if item["marked"]}


def test_blank_and_two_independent_cards(pdf_pages):
    result = recognize(scan(pdf_pages[40,2][0]), 40)
    assert len(result["cards"]) == 2
    assert result["cards"][0]["qrRaw"] != result["cards"][1]["qrRaw"]
    assert all(question["status"] == "BLANK" for card in result["cards"] for question in card["questions"])


@pytest.mark.parametrize("questions", [10,40])
def test_all_correct_and_incorrect(pdf_pages, questions):
    page = pdf_pages[questions,2][0]
    for letter in ("A","B"):
        expected = {number:[letter] for number in range(1,questions+1)}
        reading = responses(marked(page, questions, expected), questions, 1)
        assert selected(reading) == expected
        assert all(item["status"] == "MARKED" for item in reading)


def test_random_multiple_partial_and_edge_marks(pdf_pages):
    page = pdf_pages[40,2][0]
    expected = {i:["ABCDE"[(i*7)%5]] for i in range(1,41)}
    expected[2] = ["A","C"]
    expected[3] = ["A","C","E"]
    reading = responses(marked(page,40,expected),40,1)
    assert selected(reading) == expected
    assert reading[1]["status"] == reading[2]["status"] == "MULTIPLE"
    for fill in ("partial","edge"):
        reading = responses(marked(page,40,{1:["D"]},fill=fill),40,1)
        assert reading[0]["marked"] == ["D"] or reading[0]["status"] == "UNCERTAIN"
        assert not any(item["marked"] for item in reading[1:])


def test_weak_mark_requires_review(pdf_pages):
    reading = responses(marked(pdf_pages[40,2][0],40,{1:["C"]},fill="weak"),40,1)
    assert reading[0]["status"] == "UNCERTAIN"
    assert reading[0]["marked"] == []


def test_clear_screenshot_below_old_resolution_limit(pdf_pages):
    selections = {1: ["A"], 2: ["A"], 3: ["C", "D"], 5: ["B"], 6: ["E"], 7: ["A"], 8: ["B"], 9: ["D"], 10: ["A", "E"]}
    page = marked(pdf_pages[10,2][0], 10, selections)
    screenshot = cv2.resize(page[:page.shape[0]//2], (1045, 728), interpolation=cv2.INTER_AREA)
    result = recognize(scan(screenshot), 10)
    assert len(result["cards"]) == 1
    reading = result["cards"][0]["questions"]
    assert selected(reading) == selections
    assert reading[2]["status"] == reading[9]["status"] == "MULTIPLE"
    assert reading[3]["status"] == "BLANK"


def test_images_below_minimum_resolution_still_rejected(pdf_pages):
    page = pdf_pages[10,2][0]
    smaller = cv2.resize(page[:page.shape[0]//2], (1003, 699), interpolation=cv2.INTER_AREA)
    with pytest.raises(OmrError) as error:
        recognize(scan(smaller), 10)
    assert error.value.code == "BAD_RESOLUTION"


@pytest.mark.parametrize("mode", ["rotate","perspective","shadow","noise","low_resolution"])
def test_photographic_changes(pdf_pages, mode):
    original = marked(pdf_pages[40,2][0],40,{1:["A"],2:["D"]},half=0)
    # Work on one physical half; both halves originate from the actual A4 PDF.
    image = original[:original.shape[0]//2].copy()
    if mode == "rotate":
        image = cv2.rotate(image,cv2.ROTATE_90_CLOCKWISE)
    elif mode == "perspective":
        h,w = image.shape[:2]
        source = np.float32([[0,0],[w-1,0],[w-1,h-1],[0,h-1]])
        target = np.float32([[130,110],[w+10,40],[w+70,h+110],[80,h+150]])
        matrix = cv2.getPerspectiveTransform(source,target)
        image = cv2.warpPerspective(image,matrix,(w+180,h+220),borderValue=(255,255,255))
    elif mode == "shadow":
        gradient = np.linspace(.57,1.,image.shape[1],dtype=np.float32)[None,:,None]
        image = np.uint8(np.clip(image*gradient,0,255))
    elif mode == "noise":
        rng = np.random.default_rng(7)
        image = np.uint8(np.clip(image.astype(np.int16)+rng.normal(0,11,image.shape).astype(np.int16),0,255))
    elif mode == "low_resolution":
        image = cv2.resize(image,(1200,round(image.shape[0]*1200/image.shape[1])),interpolation=cv2.INTER_AREA)
    result = recognize(scan(image),40)
    assert len(result["cards"]) == 1
    reading = result["cards"][0]["questions"]
    assert reading[0]["marked"] == ["A"]
    assert reading[1]["marked"] == ["D"]
    assert all(item["status"] == "BLANK" for item in reading[2:])


def test_missing_marker_and_blur_reject(pdf_pages):
    image = pdf_pages[40,2][0][:1300].copy()
    factor = image.shape[1]/LAYOUT["width"]
    cv2.rectangle(image,(0,0),(round(43*factor),round(43*factor)),(255,255,255),-1)
    with pytest.raises(OmrError) as missing:
        recognize(scan(image),40)
    assert missing.value.code == "MARKERS_MISSING"
    blurred = cv2.GaussianBlur(pdf_pages[40,2][0][:1300],(23,23),8)
    with pytest.raises(OmrError) as blurry:
        recognize(scan(blurred),40)
    assert blurry.value.code == "BLURRY_IMAGE"


def test_multi_page_pdf_generator(pdf_pages):
    assert len(pdf_pages[40,3]) == 2
    assert len(recognize(scan(pdf_pages[40,3][0]),40)["cards"]) == 2
    assert len(recognize(scan(pdf_pages[40,3][1]),40)["cards"]) == 1


def test_unreadable_qr_and_other_exam(pdf_pages, tmp_path):
    image = pdf_pages[40,2][0][:1300].copy()
    factor = image.shape[1]/LAYOUT["width"]
    qr = LAYOUT["qr"]
    cv2.rectangle(image,(round(qr["x"]*factor),round(qr["y"]*factor)),(round((qr["x"]+qr["size"])*factor),round((qr["y"]+qr["size"])*factor)),(255,255,255),-1)
    with pytest.raises(OmrError) as unreadable:
        recognize(scan(image),40)
    assert unreadable.value.code == "QR_UNREADABLE"
    other_id = "08e6f6dd-197d-4ceb-bf67-399bfaadc102"
    pdf = tmp_path / "other.pdf"
    subprocess.run(["node","--import","tsx","scripts/generate-omr-fixture.ts",str(pdf),"10","1",other_id],cwd=ROOT,check=True)
    prefix = tmp_path / "other"
    subprocess.run(["pdftoppm","-f","1","-l","1","-scale-to","2600","-png","-singlefile",str(pdf),str(prefix)],check=True)
    detected = recognize(scan(cv2.imread(str(prefix)+".png")),10)
    assert other_id in detected["cards"][0]["qrRaw"]


def test_private_endpoint_authentication(pdf_pages, monkeypatch):
    monkeypatch.setenv("OMR_SHARED_SECRET", "test-internal-secret-0123456789012345")
    image = scan(pdf_pages[10,2][0])
    import hashlib, hmac
    timestamp = int(time.time())
    signature = hmac.new(os.environ["OMR_SHARED_SECRET"].encode(),f"v1:{timestamp}:10:{hashlib.sha256(image).hexdigest()}".encode(),hashlib.sha256).hexdigest()
    async def verify():
        async def receive():
            return {"type": "http.request", "body": image, "more_body": False}
        request = Request({"type":"http","method":"POST","path":"/analyze","headers":[(b"content-type",b"image/jpeg")]},receive)
        with pytest.raises(HTTPException) as denied:
            await analyze(request,10,timestamp,"bad")
        assert denied.value.status_code == 401
        request = Request({"type":"http","method":"POST","path":"/analyze","headers":[(b"content-type",b"image/jpeg")]},receive)
        response = await analyze(request,10,timestamp,signature)
        assert response["version"] == 1
    asyncio.run(verify())
