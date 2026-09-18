"""
古い映画からランダムに10秒クリップを切り出して選ぶローカルツール

使い方:
  pip install flask
  python clip_picker.py
  ブラウザで http://127.0.0.1:5000 を開く

フォルダ構成（このファイルと同じ場所に自動作成されます）:
  sources/   ... 元の映画を入れる（mp4 / webm / mkv / mov / ogv）
  _preview/  ... 候補の一時ファイル（再生成のたびに消えます）
  saved/     ... 保存した10秒クリップ（ゲームの本物ストック用）と clips.csv
  refs/      ... AI生成の参照用に短くしたクリップ（Seedanceなどに渡す用）
"""

import csv
import random
import re
import shutil
import subprocess
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

from flask import Flask, abort, jsonify, request, send_from_directory

BASE = Path(__file__).resolve().parent
SOURCE_DIR = BASE / "sources"
PREVIEW_DIR = BASE / "_preview"
SAVED_DIR = BASE / "saved"
REF_DIR = BASE / "refs"
EXTS = {".mp4", ".webm", ".mkv", ".mov", ".ogv", ".avi"}

CLIP_SEC = 10          # クリップの長さ
EDGE_SKIP = 60         # 冒頭・末尾のクレジットを避ける秒数
MAX_TRIES = 8          # 条件に合う場面を探す試行回数
WORKERS = 4            # 同時に切り出す本数

REF_SEC = 4.8          # 参照用クリップの長さ（3本で14.4秒。Seedanceの合計15秒制限に収まる）
REF_OFFSET = 2.5       # 保存クリップの何秒目から参照用を切り出すか（頭と終わりを避ける）
REF_HEIGHT = 480       # 参照用は軽くするため縦480pxに縮小
SAVE_FIRST_FRAME = False  # 画像→動画で作る場合だけ True（最初のコマをPNG保存）

for d in (SOURCE_DIR, PREVIEW_DIR, SAVED_DIR, REF_DIR):
    d.mkdir(exist_ok=True)

app = Flask(__name__)
candidates = {}        # id -> {"src": Path, "start": float, "file": str}
durations = {}
lock = threading.Lock()


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def duration_of(path: Path) -> float:
    if path not in durations:
        r = run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                 "-of", "default=nw=1:nk=1", str(path)])
        try:
            durations[path] = float(r.stdout.strip())
        except ValueError:
            durations[path] = 0.0
    return durations[path]


def list_sources():
    files = [p for p in sorted(SOURCE_DIR.iterdir()) if p.suffix.lower() in EXTS]
    return [p for p in files if duration_of(p) > CLIP_SEC + 5]


def looks_bad(preview: Path) -> bool:
    """カット切り替えを含む、またはほぼ静止（字幕カード・暗転）なら True"""
    r = run(["ffmpeg", "-i", str(preview), "-vf",
             "freezedetect=n=0.004:d=6,select='gt(scene,0.35)',showinfo",
             "-f", "null", "-"])
    cuts = len(re.findall(r"Parsed_showinfo.*\bn:\s*\d+", r.stderr))
    frozen = "freeze_start" in r.stderr
    return cuts > 0 or frozen


def make_candidate(sources, strict):
    weights = [duration_of(s) for s in sources]
    for _ in range(MAX_TRIES):
        src = random.choices(sources, weights=weights)[0]
        dur = duration_of(src)
        lo = min(EDGE_SKIP, dur * 0.1)
        hi = max(lo, dur - lo - CLIP_SEC)
        start = round(random.uniform(lo, hi), 2)
        cid = uuid.uuid4().hex[:10]
        out = PREVIEW_DIR / f"{cid}.mp4"
        r = run(["ffmpeg", "-y", "-ss", str(start), "-i", str(src), "-t", str(CLIP_SEC),
                 "-vf", "scale=-2:360", "-an", "-c:v", "libx264", "-preset", "veryfast",
                 "-crf", "26", "-movflags", "+faststart", str(out)])
        if r.returncode != 0 or not out.exists():
            continue
        if strict and looks_bad(out):
            out.unlink(missing_ok=True)
            continue
        with lock:
            candidates[cid] = {"src": src, "start": start, "file": out.name}
        return {"id": cid, "source": src.name, "start": start, "url": f"/preview/{out.name}"}
    return None


@app.post("/api/generate")
def generate():
    body = request.get_json(silent=True) or {}
    count = max(1, min(int(body.get("count", 10)), 30))
    strict = bool(body.get("strict", True))
    sources = list_sources()
    if not sources:
        return jsonify(error=f"sources フォルダに動画がありません: {SOURCE_DIR}"), 400

    with lock:
        candidates.clear()
    for f in PREVIEW_DIR.glob("*.mp4"):
        f.unlink(missing_ok=True)

    with ThreadPoolExecutor(WORKERS) as ex:
        results = [r for r in ex.map(lambda _: make_candidate(sources, strict), range(count)) if r]
    return jsonify(clips=results, sources=len(sources))


@app.post("/api/save")
def save():
    cid = (request.get_json(silent=True) or {}).get("id", "")
    with lock:
        c = candidates.get(cid)
    if not c:
        return jsonify(error="候補が見つかりません。再生成してください"), 404

    src, start = c["src"], c["start"]
    name = f"{src.stem}_{start:08.2f}".replace(" ", "_")
    mp4 = SAVED_DIR / f"{name}.mp4"
    ref = REF_DIR / f"{name}_ref.mp4"
    png = SAVED_DIR / f"{name}_first.png"

    # 保存は元の解像度・高画質で切り出し直す
    r = run(["ffmpeg", "-y", "-ss", str(start), "-i", str(src), "-t", str(CLIP_SEC),
             "-an", "-c:v", "libx264", "-crf", "18", "-movflags", "+faststart", str(mp4)])
    if r.returncode != 0:
        return jsonify(error="保存に失敗しました: " + r.stderr[-300:]), 500
    # AI生成の参照用に短く・軽くしたクリップを保存
    r = run(["ffmpeg", "-y", "-ss", str(start + REF_OFFSET), "-i", str(src), "-t", str(REF_SEC),
             "-vf", f"scale=-2:'min({REF_HEIGHT},ih)'", "-an", "-c:v", "libx264", "-crf", "20",
             "-movflags", "+faststart", str(ref)])
    if r.returncode != 0:
        return jsonify(error="参照用クリップの作成に失敗しました: " + r.stderr[-300:]), 500
    # 画像→動画で作る場合だけ最初のコマも保存
    if SAVE_FIRST_FRAME:
        run(["ffmpeg", "-y", "-ss", str(start), "-i", str(src), "-frames:v", "1", str(png)])

    log = SAVED_DIR / "clips.csv"
    new = not log.exists()
    with log.open("a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if new:
            w.writerow(["file", "ref_file", "first_frame", "source_file", "start_sec", "length_sec",
                        "saved_at", "source_url", "license", "memo"])
        w.writerow([mp4.name, ref.name, png.name if SAVE_FIRST_FRAME else "", src.name, start, CLIP_SEC,
                    datetime.now().isoformat(timespec="seconds"), "", "", ""])
    return jsonify(saved=mp4.name, ref=ref.name)


@app.get("/preview/<path:name>")
def preview(name):
    if not re.fullmatch(r"[0-9a-f]{10}\.mp4", name):
        abort(404)
    return send_from_directory(PREVIEW_DIR, name)


@app.get("/")
def index():
    return PAGE


PAGE = """<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>クリップ選別</title>
<style>
  :root {
    --bg: #1c1712; --panel: #2a221a; --line: #4a3c2c;
    --text: #efe4d0; --muted: #a8977c; --amber: #e8a33d; --saved: #7fa37a;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
         font-family: "Hiragino Sans", "Yu Gothic", system-ui, sans-serif; }
  header { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap;
           align-items: center; gap: 16px; padding: 14px 20px;
           background: var(--bg); border-bottom: 1px solid var(--line); }
  h1 { font-size: 1.1rem; margin: 0 auto 0 0; font-weight: 600; }
  label { color: var(--muted); font-size: .9rem; display: flex; gap: 6px; align-items: center; }
  select, button { font: inherit; }
  select { background: var(--panel); color: var(--text); border: 1px solid var(--line);
           padding: 4px 6px; border-radius: 4px; }
  button { cursor: pointer; border-radius: 4px; padding: 8px 14px; border: 1px solid var(--line);
           background: var(--panel); color: var(--text); }
  button.primary { background: var(--amber); color: #1c1712; border-color: var(--amber); font-weight: 600; }
  button:disabled { opacity: .5; cursor: default; }
  button:focus-visible, select:focus-visible { outline: 2px solid var(--amber); outline-offset: 2px; }
  #status { padding: 10px 20px; color: var(--muted); min-height: 1.5em; }
  #grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 18px; padding: 6px 20px 40px; }
  figure { margin: 0; background: var(--panel); border: 1px solid var(--line); border-radius: 6px;
           overflow: hidden; }
  figure.is-saved { border-color: var(--saved); }
  video { display: block; width: 100%; aspect-ratio: 4 / 3; background: #000; object-fit: contain; }
  figcaption { display: flex; align-items: center; gap: 10px; padding: 10px 12px; }
  .meta { flex: 1; min-width: 0; font-size: .85rem; }
  .meta b { display: block; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .meta span { color: var(--muted); }
  figure.is-saved .save { background: transparent; color: var(--saved); border-color: var(--saved); }
</style>
</head>
<body>
<header>
  <h1>クリップ選別</h1>
  <label>本数
    <select id="count"><option>6</option><option selected>10</option><option>16</option><option>24</option></select>
  </label>
  <label><input type="checkbox" id="strict" checked> カット切り替えと字幕カードを除く</label>
  <button class="primary" id="gen">再生成</button>
</header>
<div id="status" role="status"></div>
<main id="grid"></main>
<script>
const $ = (s) => document.querySelector(s);
const fmt = (t) => {
  const m = Math.floor(t / 60), s = (t % 60).toFixed(1).padStart(4, "0");
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:${s}`;
};

async function generate() {
  const btn = $("#gen");
  btn.disabled = true;
  $("#grid").innerHTML = "";
  $("#status").textContent = "切り出し中です。数十秒かかります";
  try {
    const res = await fetch("/api/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: +$("#count").value, strict: $("#strict").checked })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    render(data.clips);
    const lack = +$("#count").value - data.clips.length;
    $("#status").textContent = `${data.sources}本の映画から${data.clips.length}本を切り出しました`
      + (lack > 0 ? `（条件に合う場面が見つからず${lack}本少なくなりました）` : "");
  } catch (e) {
    $("#status").textContent = "エラー: " + e.message;
  } finally {
    btn.disabled = false;
  }
}

function render(clips) {
  const grid = $("#grid");
  for (const c of clips) {
    const fig = document.createElement("figure");
    fig.innerHTML = `
      <video src="${c.url}" autoplay muted loop playsinline controls></video>
      <figcaption>
        <div class="meta"><b></b><span>${fmt(c.start)} から10秒</span></div>
        <button class="save">保存</button>
      </figcaption>`;
    fig.querySelector("b").textContent = c.source;
    const btn = fig.querySelector(".save");
    btn.onclick = async () => {
      btn.disabled = true; btn.textContent = "保存中";
      const res = await fetch("/api/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id })
      });
      const data = await res.json();
      if (res.ok) { fig.classList.add("is-saved"); btn.textContent = "保存済み"; }
      else { btn.disabled = false; btn.textContent = "保存"; $("#status").textContent = "エラー: " + data.error; }
    };
    grid.appendChild(fig);
  }
}

$("#gen").onclick = generate;
generate();
</script>
</body>
</html>"""

if __name__ == "__main__":
    print(f"映画フォルダ: {SOURCE_DIR}")
    print("http://127.0.0.1:5000 を開いてください")
    app.run(host="127.0.0.1", port=5000, threaded=True)