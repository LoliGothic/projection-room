# 映写室 — projection-room

深夜の映写室で、本物の古い映画のフィルムと、紛れ込んだ偽物（AI生成動画）を見分けるホラー風のWebゲーム。
スマホの縦画面を主に想定し、PCでも遊べます。

**右スワイプ＝映写する（本物）／左スワイプ＝焼き捨てる（AI）。**
判断を誤ると映写機が止まり、第1巻からやり直し。全8巻を通せば夜明けを迎えます。

仕様の全文は [SPEC.md](./SPEC.md) を参照してください。

---

## 動かす（Docker だけでOK）

ホストに Node.js や ffmpeg を入れる必要はありません。

```bash
docker compose up
```

初回は依存のインストールとダミー動画の生成（ffmpeg）が走るため数分かかります。
起動したらブラウザで開いてください。

- PC: <http://localhost:5173>
- **スマホ実機**: PC と同じ Wi-Fi につないで `http://<PCのIP>:5173`

PC の IP は起動ログの `Network:` 行に出ます。手動で調べる場合:

```bash
ipconfig getifaddr en0            # macOS
hostname -I | awk '{print $1}'    # Linux
ipconfig                          # Windows（IPv4 アドレス）
```

止めるときは `Ctrl+C`、後片付けは `docker compose down`（`-v` を付けると node_modules ボリュームも消えます）。

## コンテナの中でコマンドを動かす

```bash
docker compose exec app npm test          # ユニットテスト（Vitest）
docker compose exec app npm run lint      # ESLint
docker compose exec app npm run build     # 本番ビルド
docker compose exec app npm run preview   # ビルド結果を http://localhost:4173 で確認
docker compose exec app npm run gen:dummy -- --force   # ダミー動画を作り直す
```

## npm script 一覧

| script | 内容 |
| --- | --- |
| `dev` | Vite 開発サーバー（`--host 0.0.0.0` で LAN に公開） |
| `build` | 型チェック＋本番ビルド |
| `preview` | 本番ビルドの確認 |
| `test` | Vitest（出題ロジック・巻とループ・エンディング判定などの純粋関数） |
| `lint` | ESLint |
| `gen:dummy` | ダミー動画24本と `public/clips.json` を生成（**本物側も上書きします**） |
| `gen:dummy:ai` | AI役12本だけ作り直す（本物の実映像は残す） |
| `gen:dummy:if-missing` | 未生成のときだけ生成（compose の起動時に使用） |
| `import:saved` | `clip_picker.py` で切り出した `saved/` の10秒クリップを取り込む |
| `gen:real` | `sources/` の実映画から自動で切り出す（目視で選ばない場合） |
| `prep:clip` | 実素材を同じ質感に揃える劣化処理 |
| `gen:icons` | PWA のアイコンを生成 |

---

## 動画素材

### いまの状態（検証用）

| 役 | 中身 |
| --- | --- |
| **本物** 10本 | `clip_picker.py` で選んで `saved/` に切り出したパブリックドメイン映画 |
| **AI役** 12本 | ffmpeg のテストパターン（仮） |

本物は実写、AI役は明らかな図形パターンなので、**正解／不正解がひと目で分かります**。
判定ロジックや演出の確認用の構成です。AI生成動画が用意できたら AI 役を差し替えてください。

1周（8巻×1本）に必要なのは8本なので、同じ動画を出さずに何周かできる余裕があります。

### 本物クリップを入れる（ふだんはこちら）

`clip_picker.py` で場面を選んで `saved/` に貯め、それを取り込みます。

```bash
# 1. 場面を選ぶ（別ツール。pip install flask して http://127.0.0.1:5000）
python clip_picker.py

# 2. saved/ の中身をゲームに取り込む
npm run import:saved          # 本物側を saved/ の中身に差し替える
npm run import:saved -- --add # 今ある本物を残したまま追加する
```

`saved/clips.csv` から元映画と切り出し位置を読み、劣化処理をかけて
`public/clips/<ランダムID>.mp4` に出力し、`public/clips.json` の本物側を書き換えます。
AI役のエントリは触りません。

作品名・公開年・監督は `scripts/import-saved.mjs` の `TITLES` で指定します
（キーは `saved/clips.csv` の `source_file` から拡張子を除いたもの）。
ここに無いものはファイル名から機械的に作るので、気になるものだけ足せば済みます。
**確かな出典を確認できなかった監督名は空にしてあります。**推測では入れていません。

入手元URLとライセンスは `clips.csv` の `source_url` / `license` 列を埋めておくと
そのまま取り込まれます。空の場合はあとから `public/clips.json` に追記してください。

### sources/ から自動で切り出す（補助）

```bash
npm run gen:real
```

目視で選ばずに `sources/` の映画から機械的に切り出す経路です。
`scripts/gen-real.mjs` の `CATALOG` に、元映画と**確認済みの切り出し位置（`picks`）**が書いてあります。

`picks` を消すと自動探索に切り替わりますが、素材の粒子が強いため
**字幕カードや新聞の挿入カットを明るさや動きだけで自動判別することはできませんでした**
（白抜き文字の字幕は、平均輝度が暗いシーンと区別できない）。
自動探索を使うときは、切り出した結果を必ず一度目で見てください。

### 共通の劣化処理

`import:saved` / `gen:real` / `prep:clip` はどれも同じ処理を通します。

18fps / 480x360 / モノクロ / **自動レベル補正（normalize）** / コントラスト /
フィルムノイズ / 周辺減光 / 無音 / faststart。

`normalize` は転写ごとの露出差を吸収するために入れています。
これが無いと暗い転写が真っ黒になり、判断できないクリップが出ます。

### AI役を作り直す

```bash
npm run gen:dummy:ai    # 本物の実映像を残したまま、AI役12本だけ作り直す
```

`npm run gen:dummy -- --force` は**本物側も含めて全部**作り直すので注意してください。

```bash
npm run gen:dummy              # 既定のシードで生成（毎回同じIDになります）
npm run gen:dummy -- --seed 7  # 別のシードで作り直す
npm run gen:dummy -- --force   # 生成済みでも作り直す
```

mp4 は `public/clips/` に出力され、git 管理外です（スクリプトから決定的に再生成できるため）。
`public/clips.json` は git 管理下です。

### 1本ずつ手で足す

1. 加工前の動画を `clips/`（リポジトリ直下。git 管理外）に置く
2. 劣化処理をかける — 10秒切り出し / 18fps / 480x360 / モノクロ / コントラスト強め /
   フィルムノイズ / 周辺減光 / 音声削除 / faststart 付き MP4

```bash
# 本物（パブリックドメイン映画）
docker compose exec app npm run prep:clip -- \
  --in clips/example.mp4 --start 00:12:30 \
  --title "作品名" --year 1922 --director "監督名" \
  --work "作品を識別するキー" --source "入手元URL" --license "Public Domain" --append

# AI生成動画
docker compose exec app npm run prep:clip -- \
  --in clips/gen01.mp4 --start 4 --ai \
  --tool "生成ツール名" --work "生成系統のキー" \
  --note "振り返り画面に出す解説" --append
```

出力ファイル名は答えが分からないランダムIDになります。
`--append` を付けると `public/clips.json` に自動追記され、付けない場合は貼り付け用の JSON が表示されます。

### clips.json の形

```json
{
  "id": "k8f3x2",
  "src": "clips/k8f3x2.mp4",
  "isAI": false,
  "work": "同じ元作品の場面が連続しないようにするための識別子",
  "title": "作品名",
  "year": 1922,
  "director": "監督名",
  "sourceUrl": "入手元URL",
  "license": "ライセンス表記",
  "tool": "生成ツール名（AIの場合）",
  "note": "振り返り画面に出す解説"
}
```

`src` は **相対パス**で持ちます。配信先（ルート配信／サブパス配信）が未定のため、
Vite の `base` を `'./'` にし、実行時に `import.meta.env.BASE_URL` と連結して解決しています。

---

## 遊び方

- **右スワイプ / →** … 映写する（本物だと思ったとき）
- **左スワイプ / ←** … 焼き捨てる（AI生成だと思ったとき）
- **映写機アイコン / 「もう一度映写する」** … リプレイ。回数に制限も罰もありません

時間制限はありませんが、1本を見つめ続けると**不穏タイマー**が進みます。
数字は出ません。映写機の音、上下の余白に現れる人影、光の強さで気づいてください。
最後まで進むと暗闇エンドでその上映は終わります（第1巻には戻りません）。

1巻につき1本。**連続8本を正しくさばけば脱出**、1回でも間違えると第1巻に戻ります。

## 調整する

数値はすべて `src/config/` に集めてあります。

| ファイル | 中身 |
| --- | --- |
| `tuning.ts` | 巻の構成・不穏タイマーの秒数・スワイプの閾値・演出の長さと強さ |
| `endings.data.ts` | エンディングの条件（`{stat, op, value}`）と字幕カードの文章 |
| `intertitles.data.ts` | 巻の節目とループ時の字幕カードの文言 |

たとえば不穏タイマーを短くするなら `tuning.ts` の `DREAD.stagesMs` を、
エンディングを足すなら `endings.data.ts` の `ENDINGS` に 1 件足すだけで済みます
（`ENDING_ORDER` にも末尾に追加してください。セーブコードの互換性のためです）。

## 構成

```
src/
  config/      調整用の数値（巻の構成・不穏タイマーの秒数・演出の強さ・エンディング定義）
  core/        UI から独立した純粋な TypeScript
               session（ステートマシン）/ clipQueue（出題）/ progress（巻とループ）
               dread（不穏タイマー）/ endings（判定）/ records・saveCode（記録）
  state/       Zustand ストア。core を薄く包むだけ
  audio/       Web Audio による合成音（engine と synth に分離）
  hooks/       スワイプ入力・不穏タイマー・フィルムの揺れ
  components/  画面とゲーム部品
scripts/       ffmpeg スクリプト（ダミー生成・劣化処理・アイコン生成）
public/clips/  出題動画（生成物・git 管理外）
clips/         実素材の置き場（git 管理外）
```

ゲームのルールは `src/core/` に閉じていて React に依存しないため、Vitest でそのままテストできます。
加えて `src/App.smoke.test.tsx` では jsdom 上で実際に画面をマウントし、
タイトル → 字幕カード → 回答 → ループ演出 → エンディング → 振り返りまで通しで動かしています。

## PWA

`npm run build` で Service Worker と manifest が生成され、ホーム画面に追加できます。

- 事前キャッシュするのは**アプリ本体だけ**（HTML / JS / CSS / アイコン / clips.json）
- 動画は再生したものから順に実行時キャッシュ（最大40本・30日）

スマホで「ホーム画面に追加」を試すときは、`npm run build` のあと `npm run preview`
（`http://<PCのIP>:4173`）を使ってください。開発サーバーでは Service Worker は動きません。

## アクセシビリティ

- 初回起動時に、暗い映像と明るさの変化について注意を表示します
- 強い明滅は使っていません
- 設定の **「点滅を弱める」** で、映像の揺れ・明るさのゆらぎ・切り替えの一瞬・人影をまとめて無効化します
- 設定の **「演出を軽くする」** で、フィルムの粒子を動かさず静止したテクスチャに切り替えます

## ホストで直接動かす場合（任意）

Node.js 22 以上と ffmpeg があれば Docker なしでも動きます。

```bash
npm install && npm run gen:dummy && npm run dev
```
