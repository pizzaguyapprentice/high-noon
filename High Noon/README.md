# High Noon

A Phaser 4 + TypeScript game, built with [Deno](https://deno.com).

- **In Celbridge:** open `High Noon.celbridge`. See `CELBRIDGE.md`.
- **Without Celbridge** (e.g. on Linux, or with VS Code): see `README_deno_tooling.md`.
- **Installing Deno** (Linux, macOS, Windows): see `README_deno_install.md`.

The game's code is in `src/`, and the page, CSS, images, sounds and map are in `public/`. The Tiled map is
`public/assets/map/testlevel.tmx`. Convert it to JSON for the game with `deno task map public/assets/map/testlevel.tmx`.

Started from the [Phaser Vite TypeScript template](https://github.com/phaserjs/template-vite-ts) (see `LICENSE`).
