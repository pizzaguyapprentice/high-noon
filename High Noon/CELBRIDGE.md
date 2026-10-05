# High Noon in Celbridge (Deno)

A Phaser 4 + TypeScript game, built with Deno. Not using Celbridge? See `README_deno_tooling.md`.

## Running it in Celbridge

Open `High Noon.celbridge` in Celbridge. The console at the bottom starts by itself and runs `deno task dev`:

1. **builds** `src/` (TypeScript, plus Phaser from npm) into `dist/app.js`, and copies `public/` (the page, its
   CSS, images, sounds and map) into `dist/`. Only files that have changed are copied
2. **tests** everything in `tests/`, printing the results in the console and writing a readable report to
   `test_output/index.html`. The report also lists TypeScript errors and lint warnings
3. **watches**: every time you save a file in `src/`, `public/` or `tests/`, it does it all again

`dist/index.html` opens beside the console. After a rebuild, press its preview's **refresh** button to see
your changes. The clipboard icon opens the test report.

The console's buttons: rebuild-and-watch, build once, test once, lint, and map. To use them while the watcher is
running, press **Ctrl+C** first to stop it.

## Where things go

| Folder | What goes in it |
|---|---|
| `src/` | the game's TypeScript code. `src/main.ts` is where it starts |
| `public/` | `index.html`, `style.css` and `favicon.png` |
| `public/assets/` | images, sounds, the map. In the game, load them as `assets/...` (no `public/`) |
| `tests/` | tests, in files ending `.test.ts` |

## Updating the map after editing it in Tiled

Phaser loads `public/assets/map/testlevel.json`, not the `.tmx`. After changing the map in Tiled, press the
console's **map** button, or type:

```
deno task map public/assets/map/testlevel.tmx
```

This rewrites `testlevel.json` next to the `.tmx`. It does the same as Tiled's own command line
(`tiled --export-map json --embed-tilesets in.tmx out.json`), but doesn't need Tiled installed. It works for any
map: `deno task map <in.tmx> [out.json]`.

The first time, git shows `testlevel.json` as changed even if the map wasn't: the content is the same, but the
spacing differs from Tiled's.

## Files for the Deno build

You never need to edit these:

- `High Noon.celbridge`: the Celbridge project, with its shortcuts
- `terminal.console`: the console and its buttons
- `deno.json`: the Deno tasks and settings
- `build.ts`, `tools/test_report.ts`: the build and the test report
- `tools/tmx_to_json.ts`: converts Tiled maps to JSON (`deno task map`)
- `README_deno_tooling.md`: how to do all this without Celbridge
- `README_deno_install.md`: how to install Deno on Linux, macOS and Windows
