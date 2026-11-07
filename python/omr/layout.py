import json
from pathlib import Path

LAYOUT = json.loads((Path(__file__).resolve().parent.parent / "shared" / "card-layout.v2.json").read_text())
LETTERS = "ABCDE"
SCALE = LAYOUT["normalizationScale"]
WIDTH = round(LAYOUT["width"] * SCALE)
HEIGHT = round(LAYOUT["height"] * SCALE)


def bubbles(questions: int):
    if questions < 1 or questions > LAYOUT["maxQuestions"]:
        raise ValueError("Quantidade de questões inválida")
    rows = (questions + 3) // 4
    for index in range(questions):
        col, row = divmod(index, rows)
        for letter, offset in zip(LETTERS, LAYOUT["bubbleX"]):
            yield index + 1, letter, (LAYOUT["columnX"][col] + offset) * SCALE, (LAYOUT["firstRowY"] + row * LAYOUT["rowStep"]) * SCALE
