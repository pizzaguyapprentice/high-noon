# High Noon in Celbridge (Deno)

This project can be built two ways. Both use the same `src/`, `public/` and `index.html`.

| | Celbridge / Deno | Vite / npm |
|---|---|---|
| Needs | [Deno](https://deno.com) | [Node.js](https://nodejs.org), then `npm install` |
| Build, and rebuild on save | `deno task dev` | `npm run dev` (web server on http://localhost:8080) |
| Build once | `deno task build` | `npm run build` |
| Output | `dist/` | `dist/` |

Both builds write to `dist/`, so the last one you ran wins.

## Running it in Celbridge

Open `High Noon.celbridge` in Celbridge. The console at the bottom starts by itself and runs `deno task dev`:

1. **builds** `src/` (TypeScript, plus Phaser from npm) into `dist/app.js`, copies `public/` (images, sounds,
   map) into `dist/`, and writes `dist/index.html` from `index.html`
2. **tests** everything in `tests/`, printing the results in the console and writing a readable report to
   `test_output/index.html`. The report also lists TypeScript errors and lint warnings
3. **watches**: every time you save a file in `src/`, `public/`, `tests/` or `index.html`, it does it all again

`dist/index.html` opens beside the console. After a rebuild, press its preview's **refresh** button to see
your changes. The clipboard icon opens the test report.

The console's buttons: rebuild-and-watch, build once, test once, and lint. To use them while the watcher is
running, press **Ctrl+C** first to stop it.

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

## Files added for the Deno build

You never need to edit these:

- `High Noon.celbridge`: the Celbridge project, with its shortcuts
- `terminal.console`: the console and its buttons
- `deno.json`: the Deno tasks and settings (Phaser comes from npm, the same version as `package.json`)
- `build.ts`, `tools/test_report.ts`: the build and the test report
- `tools/tmx_to_json.ts`: converts Tiled maps to JSON (`deno task map`)
- `tests/`: put tests here, in files ending `.test.ts`
