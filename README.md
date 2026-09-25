# 撮影者不明

ショート動画アプリのように見える、ホラー風のWebゲーム。
縦長の映像が次々に流れてくる中に、AIが生成した偽物が紛れ込んでいます。

**本物には♥（いいね）を押し、AIが作ったものは「…」から報告する。**
見誤るとおすすめがリセットされ、最初からやり直し。8段階を通し切ればアプリを閉じられます。

仕様の全文は [SPEC.md](./SPEC.md) を参照してください。

---

## 動かす（Docker だけでOK）

ホストに Node.js や ffmpeg を入れる必要はありません。

```bash
docker compose up
```

初回は依存のインストールとダミー動画の生成（ffmpeg）が走るため数分かかります。

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
```

## npm script 一覧

| script | 内容 |
| --- | --- |
| `dev` | Vite 開発サーバー（`--host 0.0.0.0` で LAN に公開） |
| `build` | 型チェック＋本番ビルド |
| `preview` | 本番ビルドの確認 |
| `test` | Vitest |
| `lint` | ESLint |
| `gen:dummy` | ダミー動画20本と `public/clips.json` を生成 |
| `gen:dummy:if-missing` | 未生成のときだけ生成（compose と CI の起動時に使用） |
| `normalize` | `raw/` の素材を配信用に正規化する |
| `gen:icons` | PWA のアイコンを生成 |

---

## 遊び方

- **♥（いいね）** … 本物だと思ったとき
- **「…」→ 報告する** … AIが作ったものだと思ったとき。ひと手間かかる位置に置いています
- **「最初から」/ 映像をタップ** … 頭出し。回数に制限も罰もありません（回答にはなりません）
- **右上の「やめる」** … ホームに戻ります。誤タップ防止のため2回押す必要があります

回答すると、いまの動画が上へ抜けて次が下から上がってきます。動画は繰り返し再生されます。

時間制限はありませんが、1本を見つめ続けると**不穏タイマー**が進みます。
数字は出ません。画面の暗さ、勝手に増える数字、届く通知で気づいてください。
最後まで進むと暗転エンドでその回は終わります（第1段階には戻りません）。

1段階につき1本。**連続8本を正しくさばけば脱出**、1回でも間違えると第1段階に戻ります。

---

## 動画素材

### いまの状態

| 役 | 本数 | 中身 |
| --- | --- | --- |
| 本物 | 4 | Pexels の自然風景（海・滝・森・山）。表示義務は無いが出典として記載 |
| AI | 4 | Seedance 2.0 Mini で生成（同じ4カテゴリ） |

**カテゴリは本物とAIで1本ずつ対にしています。** カテゴリが答えの手がかりにならないようにするためです。

mp4 は `public/clips/` に置いて**リポジトリに含めて**います（CI でそのまま配信するため）。

素材を入れる前に戻したい場合は、ダミーを生成できます。

```bash
npm run gen:dummy              # 既定のシードで生成（毎回同じIDになります）
npm run gen:dummy -- --force   # 生成済みでも作り直す
```

### 実素材を入れる

1. `raw/real/` と `raw/ai/` に置きます。**カテゴリごとにフォルダを作る**と、そのまま取り込まれます。

```
raw/
  real/
    自然・風景/滝.mp4
    動物/猫.mp4
  ai/
    自然・風景/渓谷.mp4
```

2. 正規化して取り込みます。

```bash
npm run normalize             # raw/ の中身で clips.json を差し替える
npm run normalize -- --add    # いまの clips.json を残して追加する
npm run normalize -- --start 3  # 各素材の3秒目から10秒を切り出す
```

中央切り取りで 9:16 にし、**720×1280 / 24fps / 10秒 / 無音 / H.264 / faststart** に揃えて、
ランダムなIDで `public/clips/` に書き出します。

生成ツールが焼き込む**左上のウォーターマークは、上端を切り落として消しています**
（`scripts/normalize.mjs` の `TRIM`）。本物側には無いので、残っていると一目で分かってしまいます。
ツールを変えて位置が違う場合や、透かしが無い素材の場合はこの値を調整してください。

3. 出典を `public/clips.json` の `source` に書き足します（クレジット画面に出ます）。

   Pexels は表示義務がありませんが、感謝の意として出典だけ載せています。
   提供者名（`contributor`）は**任意**です。未記入なら、フィードには動画IDから決まる
   当たり障りのない名前が出ます。片方だけ「unknown」になると、そこが手がかりに
   なってしまうためです。

4. mp4 をコミットしてください（CI がそのまま配信します）。

元ファイル名と生成したIDの対応表は `raw/id-map.json` に残ります。
**これが公開されると答えが分かってしまうので、`raw/` ごと git 管理外**にしてあります。

### clips.json の形

```json
{
  "id": "k8f3x2",
  "src": "clips/k8f3x2.mp4",
  "isAI": false,
  "category": "自然・風景",
  "scene": "滝",
  "source": "Pexels",
  "sourceUrl": "入手元URL",
  "contributor": "提供者名",
  "tool": "生成ツール名（AIの場合）",
  "note": "振り返り画面に出す解説"
}
```

`src` は**相対パス**で持ちます。配信先（ルート配信／サブパス配信）が変わっても動くよう、
Vite の `base` を `'./'` にし、実行時に `import.meta.env.BASE_URL` と連結して解決しています。

**カテゴリは本物とAIで同じものを使ってください。** カテゴリが答えの手がかりになってしまいます。

---

## 調整する

数値はすべて `src/config/` に集めてあります。

| ファイル | 中身 |
| --- | --- |
| `app.ts` | アプリ名（1か所で定義） |
| `tuning.ts` | 段階の構成・不穏タイマーの秒数・スワイプの閾値・演出の長さと強さ |
| — | 設定画面の「演出を弱める」は、揺れ・明るさの変化・通知の連続表示をまとめて弱めます（不穏タイマー自体は止まりません） |
| `endings.data.ts` | エンディングの条件（`{stat, op, value}`）と文章 |
| `feed.data.ts` | キャプション・投稿者名・通知の文言 |

エンディングを足すなら `ENDINGS` に1件足すだけです
（`ENDING_ORDER` にも**末尾に**追加してください。セーブコードの互換性のためです）。

## 構成

```
src/
  config/      調整用の数値と文言
  core/        UI から独立した純粋な TypeScript
               session（ステートマシン）/ clipQueue（出題）/ progress（段階とループ）
               dread（不穏タイマー）/ endings（判定）/ records・saveCode（記録）
  state/       Zustand ストア。core を薄く包むだけ
  audio/       Web Audio による合成音
  hooks/       スワイプ入力・不穏タイマー
  components/  画面とゲーム部品
scripts/       ffmpeg スクリプト（ダミー生成・正規化・アイコン生成）
public/clips/  配信する動画（git 管理外）
raw/           素材の作業フォルダ（git 管理外）
```

ゲームのルールは `src/core/` に閉じていて React に依存しないため、Vitest でそのままテストできます。
加えて `src/App.smoke.test.tsx` では jsdom 上で実際に画面をマウントし、通しで動かしています。

## BGM

動画は常に無音で、音はすべて Web Audio で鳴らしています。
BGM は既定では**合成した仮のもの**です。ショート動画によくある穏やかなループですが、
不穏タイマーが進むと音程が下がって濁り、テープが伸びたように波打ちます。

音源ファイルに差し替えるときは `public/audio/` に置いて、
`src/config/audio.ts` の `BGM` を埋めてください（詳しくは `public/audio/README.md`）。
クレジット画面にそのまま出ます。

## アクセシビリティ

- 初回起動時に、暗い映像・明るさの変化・不安をあおる表現について注意を表示します
- 強い明滅は使っていません
- 設定の **「演出を弱める」** で、画面の揺れ・明るさの変化・通知の連続表示をまとめて弱めます

## PWA

`npm run build` で Service Worker と manifest が生成され、ホーム画面に追加できます。

- 事前キャッシュするのは**アプリ本体だけ**（HTML / JS / CSS / アイコン / clips.json）
- 動画は再生したものから順に実行時キャッシュ（最大40本・30日）

スマホで「ホーム画面に追加」を試すときは、`npm run build` のあと `npm run preview`
（`http://<PCのIP>:4173`）を使ってください。開発サーバーでは Service Worker は動きません。

## 由来

このリポジトリは、白黒フィルムの「映写室」ゲームとして作ったものを、
カラーのショート動画アプリ風に作り替えたものです。
出題ロジック・段階とループ・不穏タイマー・エンディング判定・セーブ・Docker・テストの仕組みは
そのまま引き継いでいます。白黒版の資産は git の履歴に残っています。
