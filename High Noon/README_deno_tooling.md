# High Noon: working without Celbridge (Deno)

Celbridge does all of this for you: open `High Noon.celbridge` and see `CELBRIDGE.md`. This guide is for anyone not using
Celbridge: in particular **Linux** users, as there's no Linux version of Celbridge yet, and anyone who'd rather work
in VS Code or another editor. It gets you the same set-up with a few commands.

This project only needs [Deno](https://deno.com). There's no Node.js or npm: Deno downloads Phaser by itself the
first time you build.

**Note:** the project is in the `High Noon` folder, not the top of the repo. Run every command below in
`High Noon`, e.g. `cd "High Noon"` first.

## 1. Install Deno (once)

See `README_deno_install.md`, for Linux, macOS and Windows. Check it worked with `deno --version` (you need
version 2 or later).

## 2. Build, and rebuild on every save

In a terminal, in the `High Noon` folder:

```
deno task dev
```

This is what Celbridge's console runs when the project opens. It:

1. **builds** `src/` (TypeScript) into `dist/app.js`, and copies everything in `public/` (the page, CSS, images,
   sounds, maps) into `dist/`. After the first build, only files that have changed are copied
2. **tests** everything in `tests/`, and writes a report to `test_output/index.html`. The report also lists
   TypeScript errors and lint warnings
3. **watches** `src/`, `public/` and `tests/`, and does it all again every time you save a file

Leave it running. Press **Ctrl+C** to stop it.

## 3. Preview the game in a browser

Celbridge shows `dist/index.html` beside the console. Without Celbridge, you need a browser and a small web
server. In a **second** terminal, in the `High Noon` folder:

```
deno task serve
```

Then open **http://127.0.0.1:8000** in any browser (Chrome, Firefox, Edge, Safari). Leave this running too.

After you save a file, wait for `dist/ is up to date` in the first terminal, then **refresh** the browser. The page
doesn't reload by itself.

### Why do I need a server?

If you open `dist/index.html` straight from your disk (double-clicking it, so the address starts with `file://`),
the game shows a blank or black screen. Browsers don't let a page opened from disk load other files the way
Phaser does it, so all its images, sounds and maps fail to load. A web server, even one on your own computer,
fixes that. `deno task serve` serves `dist/` at http://127.0.0.1:8000, and tells the browser not to keep old
copies, so a normal refresh always shows your latest build.

If port 8000 is already in use (e.g. by another project's server), stop that one first, or change
`--port 8000` in the `serve` task in `deno.json`.

## All the commands

These match the buttons in Celbridge's console. Run them in the `High Noon` folder.

| Command | What it does |
|---|---|
| `deno task dev` | build, test, and rebuild on every save (**Ctrl+C** to stop) |
| `deno task build` | build into `dist/` and test, once |
| `deno task test` | run the tests, and write `test_output/` |
| `deno task lint` | look for likely mistakes and bad habits |
| `deno task check` | type check `src/` and `tests/` |
| `deno task serve` | serve `dist/` at http://127.0.0.1:8000 |
| `deno task map public/assets/map/testlevel.tmx` | convert the Tiled map to `testlevel.json`, for Phaser (no need for Tiled) |

`deno task dev` already does what `build`, `test` and `check` do, every time you save. The others are for when it
isn't running.

## The test report

Open `test_output/index.html` in a browser: unlike the game, it works opened straight from your disk. The same
report is in `test_output/summary.md`, and the console shows the test results as each build finishes.

## Using VS Code

Install the **Deno** extension (`denoland.vscode-deno`), and turn it on for this project. Create
`.vscode/settings.json` (or add to it), with:

```json
{
  "deno.enable": true
}
```

Without it, VS Code checks the code as if it were for Node.js, and shows errors for things that are fine in Deno.

## Celbridge and this set-up side by side

| | Celbridge | Without Celbridge |
|---|---|---|
| Build, test and watch | starts by itself when the project opens | `deno task dev` |
| Preview | `dist/index.html`, beside the console | `deno task serve`, then http://127.0.0.1:8000 in a browser |
| See changes | press the preview's **refresh** button | refresh the browser |
| Test report | the clipboard button | open `test_output/index.html` |
| Other commands | the console's buttons | `deno task build`, `test`, `lint`, `map` |
