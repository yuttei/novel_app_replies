import { resolve } from "node:path";
import { defineConfig } from "vite";

// タイトル画面（index.html）と本編画面（game.html）の2画面を静的サイトとしてビルドします。
// 配信用の画像・音源・シナリオ・CSSは既存の static/ ディレクトリをそのまま公開ルートとして扱います。
export default defineConfig({
  base: "./",
  publicDir: "static",
  server: {
    port: 5001,
  },
  preview: {
    port: 5001,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        game: resolve(import.meta.dirname, "game.html"),
      },
    },
  },
  plugins: [
    {
      name: "rewrite-game-route",
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          // 旧Flask時代の /game でも開けるように、開発サーバー上で /game.html へ案内します。
          if (request.url === "/game" || request.url === "/game/") {
            request.url = "/game.html";
          }
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((request, _response, next) => {
          if (request.url === "/game" || request.url === "/game/") {
            request.url = "/game.html";
          }
          next();
        });
      },
    },
  ],
});
