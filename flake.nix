{
  description = "Development environment for 青春再演劇場 リプライズ";

  inputs = {
    nixpkgs.url = "https://flakehub.com/f/DeterminateSystems/nixpkgs-weekly/0.1";
  };

  outputs = { nixpkgs, ... }:
    let
      # Apple Silicon Mac、Intel Mac、Linuxで同じ開発ツールを利用できます。
      systems = [
        "aarch64-darwin"
        "x86_64-darwin"
        "aarch64-linux"
        "x86_64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          default = pkgs.mkShell {
            packages = [
              # TypeScript / Vite のビルド・テスト・開発サーバーに使用します。
              pkgs.nodejs

              # プロジェクト全体で利用するコマンドをNixで管理します。
              pkgs.git
              pkgs.gh
              pkgs.curl

              # 配布元の音源を、Webゲームで配信する加工済み音源へ変換します。
              pkgs.ffmpeg
            ];

            shellHook = ''
              # 初回だけGitリポジトリを作成します。コミットは行いません。
              if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
                git init --initial-branch=main

                # Git管理開始後もnix developがflakeを読めるよう、
                # 開発環境に必要なファイルだけステージします。
                git add .gitignore AGENTS.md flake.lock flake.nix 2>/dev/null || true
              fi

              # 開発環境へ入るたび、現在のGit状態を表示します。
              git status --short --branch

              echo "開発環境に入りました（Node.js / TypeScript / Vite）"
              echo "Node.js: $(node --version)"
              echo "npm:     $(npm --version)"
              echo "FFmpeg:  $(ffmpeg -version | head -n 1 | awk '{print $3}')"
            '';
          };
        });
    };
}
