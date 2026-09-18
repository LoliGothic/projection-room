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
| `gen:dummy` | ダミー動画24本と `public/clips.json` を生成 |
| `gen:dummy:if-missing` | 未生成のときだけ生成（compose の起動時に使用） |
| `prep:clip` | 実素材を同じ質感に揃える劣化処理 |

---

## 動画素材

### ダミー動画（いまの状態）

実素材がまだないため、ffmpeg のテストパターンから **本物役12本・AI役12本＝24本** を生成しています
（8巻×3本＝24本の1周を、同じ動画を出さずに成立させられる最小数）。

```bash
npm run gen:dummy              # 既定のシードで生成（毎回同じIDになります）
npm run gen:dummy -- --seed 7  # 別のシードで作り直す
npm run gen:dummy -- --force   # 生成済みでも作り直す
```

mp4 は `public/clips/` に出力され、git 管理外です（スクリプトから決定的に再生成できるため）。
`public/clips.json` は git 管理下です。

### 実素材を入れる

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

## 構成

```
src/
  config/      調整用の数値（巻の構成・不穏タイマーの秒数・演出の強さ・エンディング定義）
  core/        UI から独立した純粋な TypeScript。出題の選択・巻とループ・エンディング判定
  state/       Zustand ストア。core を薄く包むだけ
  audio/       Web Audio による合成音
  components/  画面とゲーム部品
scripts/       ffmpeg スクリプト（ダミー生成・劣化処理）
public/clips/  出題動画（生成物・git 管理外）
clips/         実素材の置き場（git 管理外）
```

ゲームのルールは `src/core/` に閉じていて React に依存しないため、Vitest でそのままテストできます。

## ホストで直接動かす場合（任意）

Node.js 22 以上と ffmpeg があれば Docker なしでも動きます。

```bash
npm install && npm run gen:dummy && npm run dev
```
