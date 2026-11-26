import json
import os

import openpyxl

SRC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "source", "农业经理人四级试题集.xlsx")
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "source", "question_bank.json")


def clean(value):
    return "" if value is None else str(value).strip()


wb = openpyxl.load_workbook(SRC, data_only=True)

theory = []
for row in wb["理论"].iter_rows(min_row=2, values_only=True):
    if not (clean(row[0]) or clean(row[1])):
        continue
    theory.append(
        dict(
            zip(
                [
                    "序号",
                    "试题内容",
                    "可选答案A",
                    "可选答案B",
                    "可选答案C",
                    "可选答案D",
                    "可选答案E",
                    "答案",
                    "题型",
                    "所属要素知识点",
                ],
                [clean(x) for x in row[:10]],
            )
        )
    )

practical = []
for row in wb["实操"].iter_rows(min_row=2, values_only=True):
    if not (clean(row[0]) or clean(row[1])):
        continue
    practical.append(
        dict(
            zip(
                ["序号", "试题内容", "参考答案", "题型", "所属要素知识点"],
                [clean(x) for x in row[:5]],
            )
        )
    )

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump({"理论": theory, "实操": practical}, f, ensure_ascii=False, indent=2)

print("理论", len(theory), "实操", len(practical), "->", OUT)
