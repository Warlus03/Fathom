"""文をまとめて追加する道具。

使い方:
    python tools/add_sentences.py まとめファイル.json

まとめファイルは、文（README の「文のデータ」の形）を並べた JSON 配列。
1文ずつ data/sentences/<id>.json に書き出し、data/index.json の末尾に id を足す。
すでにある id は上書きする（index の順番は変えない）。
内容の検査はアプリ側（js/data.js の validate）が行う。tests.html を開くと結果が見える。
"""
import json
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parent.parent
index_path = root / "data" / "index.json"
sent_dir = root / "data" / "sentences"


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    batch = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
    if index_path.exists():
        index = json.loads(index_path.read_text(encoding="utf-8"))
    else:
        index = {"formatVersion": 1, "audio": [], "sentences": []}
    sent_dir.mkdir(parents=True, exist_ok=True)
    seen = set()
    for s in batch:
        sid = s["id"]
        if sid in seen:
            sys.exit(f"まとめファイルの中で id が重複: {sid}")
        seen.add(sid)
        (sent_dir / f"{sid}.json").write_text(
            json.dumps(s, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n"
        )
        if sid not in index["sentences"]:
            index["sentences"].append(sid)
    ids = ",\n".join(f'    "{i}"' for i in index["sentences"])
    text = (
        "{\n"
        f'  "formatVersion": {index.get("formatVersion", 1)},\n'
        f'  "audio": {json.dumps(index.get("audio", []))},\n'
        f'  "sentences": [\n{ids}\n  ]\n'
        "}\n"
    )
    index_path.write_text(text, encoding="utf-8", newline="\n")
    print(f"{len(batch)} 文を書き出しました。合計 {len(index['sentences'])} 文。")


if __name__ == "__main__":
    main()
