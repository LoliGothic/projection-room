# 開発用イメージ。ホストに Node.js を入れずに開発・テスト・ffmpeg 実行を完結させる。
FROM node:22-alpine

# ffmpeg: ダミー動画の生成（gen:dummy）と実素材の劣化処理（prep:clip）に使う
RUN apk add --no-cache ffmpeg git

WORKDIR /app

# 依存だけ先に入れてレイヤーキャッシュを効かせる。
# 実行時は node_modules を名前付きボリュームで上書きするため、
# 初回起動時に compose 側の command が npm install を流し直す。
COPY package.json package-lock.json* ./
RUN npm install

EXPOSE 5173 4173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
