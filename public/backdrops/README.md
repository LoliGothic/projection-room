# 背景の絵の置き場

起動画面とエンディングの奥に敷く絵です。画像生成AIで作ったものを、次の名前で置いてください。

| ファイル | 出る画面 |
| --- | --- |
| `launch.jpg` | 起動画面 |
| `blackout.jpg` | エンディング「暗転」 |
| `true.jpg` | エンディング「撮影者」 |
| `endless.jpg` | エンディング「無限スクロール」 |
| `closed.jpg` | エンディング「アプリを閉じる」 |

- 縦長（9:16）で、720×1280 以上にしてください。中央を基準に画面いっぱいまで広げます。
- 置いていない画面は、いままでどおり黒い背景のままです。
- 表示するときは暗く沈め、中央をさらに落とします（`src/styles/global.css` の `.backdrop`）。
  なので、元の絵は暗くしすぎないほうが形が残ります。
- 「暗転」だけは12秒かけて浮かび上がります（`src/config/endings.data.ts` の `backdropFadeMs`）。
- PWA ではアプリ本体と一緒に事前キャッシュします（`vite.config.ts` の `globPatterns`）。
  重いと初回の読み込みが遅くなるので、1枚300KB程度までを目安にしてください。

## 取り込み方

生成ツールは左上に「Ai」の透かしを焼き込みます。このゲームでは一目でAIと分かる印になってしまうので、
上端を切り落としてから 720×1280 の JPEG にしています（元は 1152×2048 の PNG）。

```bash
ffmpeg -i 元画像.png -vf "crop=1090:1938:31:110,scale=720:1280:flags=lanczos,format=yuvj420p" -q:v 3 launch.jpg
```

起動画面だけは、絵の中ほどに立つ人影を隠さないよう、文字とボタンを下に寄せています。
絵を差し替えて人影の位置が変わったら、`global.css` の `.launch:has(.backdrop)` を見直してください。

## 何を描くか

同じフードの男を「起動画面」と「撮影者」に出して、つながりを作っています。
「アプリを閉じる」だけは何も起きない絵にします。ほかのエンディングを見たあとだと、
何も起きないことのほうが落ち着かなくなるためです。

生成に使ったプロンプトの元は次のとおりです。

| 画面 | 絵 | プロンプト |
| --- | --- | --- |
| 起動画面 | 暗い地下駐車場の奥に、フードの男がうっすら立っている | `grainy smartphone photo, empty underground parking garage at night, a hooded man standing far back in the shadows, face hidden, barely visible, cold flickering fluorescent light, heavy noise, vertical 9:16, no text` |
| 暗転 | ほぼ真っ黒。窓の前に人影がこちらを向いて立っている | `almost completely black image, faint silhouette of a person standing in front of a curtained window at night, facing the camera, barely visible, heavy sensor noise, vertical 9:16, no text` |
| 撮影者 | 同じフードの男が背を向けて座り、サムネイルの並ぶ無数の画面を見ている | `dark room lit only by many monitors showing grids of short video thumbnails, a hooded man sitting with his back to the camera, cold blue glow, grainy, vertical 9:16, no text` |
| 無限スクロール | 真っ暗な寝室で、スマホの光だけに照らされた顔 | `person lying in bed in a pitch dark room at 3am, face lit only by a smartphone screen, tired wide eyes, grainy low light photo, vertical 9:16, no text` |
| アプリを閉じる | 何も起きていない朝の部屋。伏せたスマホが置いてある | `quiet bedroom in soft morning light through white curtains, a smartphone lying face down on the bedside table, calm, muted colors, vertical 9:16, no text` |
