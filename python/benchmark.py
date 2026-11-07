"""Measured synthetic benchmark based on rasterized production PDFs."""
from __future__ import annotations

import json
import resource
import subprocess
import tempfile
import time
from pathlib import Path

import cv2
from omr.engine import OmrError, recognize
from omr.layout import LAYOUT
from tests.test_engine import marked, scan

ROOT = Path(__file__).resolve().parent.parent


def main():
    with tempfile.TemporaryDirectory() as temp:
        pdf = Path(temp) / "cards.pdf"
        prefix = Path(temp) / "page"
        subprocess.run(["node","--import","tsx","scripts/generate-omr-fixture.ts",str(pdf),"40","2"],cwd=ROOT,check=True)
        subprocess.run(["pdftoppm","-f","1","-l","1","-scale-to","2600","-png","-singlefile",str(pdf),str(prefix)],check=True)
        page = cv2.imread(str(prefix)+".png")
        cases = [
            ("blank", page, {}),
            ("all_A", marked(page,40,{i:["A"] for i in range(1,41)}), {i:["A"] for i in range(1,41)}),
            ("all_B", marked(page,40,{i:["B"] for i in range(1,41)}), {i:["B"] for i in range(1,41)}),
            ("random", marked(page,40,{i:["ABCDE"[(i*7)%5]] for i in range(1,41)}), {i:["ABCDE"[(i*7)%5]] for i in range(1,41)}),
            ("multiple", marked(page,40,{1:["A","C"],2:["B","D","E"]}), {1:["A","C"],2:["B","D","E"]}),
            ("weak", marked(page,40,{1:["C"]},fill="weak"), {1:["C"]}),
        ]
        summary = {"cardsAnalyzed":0,"cardsRecognized":0,"questionsAnalyzed":0,"questionsCorrectlyRecognized":0,"falseMarks":0,"missedMarks":0,"incorrectMultiple":0,"reviewQuestions":0,"wrongSelections":0,"rejectedImages":0,"durationsSeconds":[]}
        details = []
        for name,image,expected in cases:
            card_image = image[:image.shape[0]//2]
            start = time.perf_counter()
            summary["cardsAnalyzed"] += 1
            try:
                reading = recognize(scan(card_image),40)["cards"][0]["questions"]
                summary["cardsRecognized"] += 1
                summary["questionsAnalyzed"] += len(reading)
                for item in reading:
                    truth = expected.get(item["number"],[])
                    found = item["marked"]
                    if item["status"] == "UNCERTAIN":
                        summary["reviewQuestions"] += 1
                    elif found == truth:
                        summary["questionsCorrectlyRecognized"] += 1
                    elif not truth and found:
                        summary["falseMarks"] += 1
                    elif truth and not found:
                        summary["missedMarks"] += 1
                    else:
                        summary["wrongSelections"] += 1
                    if len(truth)>1 and item["status"] not in ("MULTIPLE","UNCERTAIN"):
                        summary["incorrectMultiple"] += 1
                details.append({"case":name,"result":"recognized","reviews":sum(q["status"]=="UNCERTAIN" for q in reading)})
            except OmrError as exc:
                summary["rejectedImages"] += 1
                details.append({"case":name,"result":"rejected","code":exc.code})
            summary["durationsSeconds"].append(round(time.perf_counter()-start,3))
        # Explicit rejection cases are recorded separately from incorrect marks.
        cut = page[:page.shape[0]//2].copy()
        factor = cut.shape[1]/LAYOUT["width"]
        cv2.rectangle(cut,(0,0),(round(43*factor),round(43*factor)),(255,255,255),-1)
        for name,image in (("missing_marker",cut),("blur",cv2.GaussianBlur(page[:page.shape[0]//2],(23,23),8))):
            summary["cardsAnalyzed"] += 1
            start = time.perf_counter()
            try:
                recognize(scan(image),40)
                details.append({"case":name,"result":"unexpected_acceptance"})
            except OmrError as exc:
                summary["rejectedImages"] += 1
                details.append({"case":name,"result":"rejected","code":exc.code})
            summary["durationsSeconds"].append(round(time.perf_counter()-start,3))
        times = summary.pop("durationsSeconds")
        summary["meanSeconds"] = round(sum(times)/len(times),3)
        summary["maxSeconds"] = round(max(times),3)
        summary["peakRssMiB"] = round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024,1)
        print(json.dumps({"sample":"8 rasterized cards from actual generated PDF; 6 answer scenarios and 2 rejection scenarios, not physical photos","summary":summary,"cases":details},ensure_ascii=False,indent=2))


if __name__ == "__main__":
    main()
