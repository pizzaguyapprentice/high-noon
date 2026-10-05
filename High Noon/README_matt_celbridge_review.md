# High Noon (team 1): Celbridge / Deno review

Reviewed 2026-10-04 by Matt. Updated 2026-10-05 after the week 3 deadline (extended
from 11:00 to 13:00 for this first week).

**Code reviewed:** `main` at `a30555a` (Mon 5 Oct 10:37, Oscar Neiland: "adjusted sounds slightly, detunes etc,
added death scream").

**New since the first review:** the sounds were adjusted (pitch variation), and a death scream was added
(`public/assets/sounds/sfx/gunshots/death/`). Both load and play correctly in the Deno build. The issues below are
unchanged.

## Summary

The project now builds with Deno only, with Celbridge's tools. The Vite/npm/Node set-up from the Phaser template
has been removed: Deno runs on Windows, macOS and Linux, and does the same job. The game builds with
`deno task build` and plays correctly from the result: menu, tilemap, pickups, sounds and HUD all load with no
failed requests.

The build's report shows **2 TypeScript errors** and **10 lint warnings**. None of them stop the game running,
but the type errors are real problems in the code. Vite never checked types, so they went unnoticed.

## Changes made on this branch

| Change | Why |
|---|---|
| Added the Deno build and Celbridge tools | See `CELBRIDGE.md`. |
| Removed `package.json`, `package-lock.json`, `vite/`, `log.js`, `tsconfig.json` and `src/vite-env.d.ts` | Node/npm/Vite aren't needed any more. (`log.js` also sent an anonymous usage ping to Phaser Studio on every npm build.) |
| Moved `index.html` into `public/`, loading `app.js` | It's the page the Deno build copies into `dist/`. The title is now "High Noon". |
| Replaced the template `README.md` (and its `screenshot.png`) | It described the npm commands. The new one points to `CELBRIDGE.md` and `README_deno_tooling.md`. |
| Added `deno task map`, and a **map** button in the console | Converts the Tiled map to JSON for Phaser, without needing Tiled installed. |
| Added `deno task serve` | Serves `dist/` at http://127.0.0.1:8000, for previewing in a browser without Celbridge. |
| Added `public/fit-to-window.css` | Scales the page to fit the window or Celbridge's preview panel, so the game is never cut off. |

## Working without Celbridge

`README_deno_tooling.md` explains how to get the same set-up without Celbridge. That matters most for **Linux**
users, as there's no Linux version of Celbridge yet, and `README_deno_install.md` covers installing Deno
on Linux (as well as macOS and Windows). It also
suits anyone working in VS Code:

- `deno task dev` builds, tests, and rebuilds `dist/` every time a file in `src/`, `public/` or `tests/` is saved
- `deno task serve`, in a second terminal, serves the game at http://127.0.0.1:8000. Then refresh the browser
  after each rebuild

The game needs the server: opened straight from disk (`file://`), browsers block Phaser from loading its images,
sounds and map, so it shows a blank screen.

## Issues and recommended actions

### 1. TypeScript errors (2)

**a) `src/game/scenes/GameScene.ts:59`: wrong layer type**

```ts
this.wallLayer = map.createLayer("Walls", allTiles)!;
```

In Phaser 4, `createLayer()` can return a `TilemapLayer` *or* a `TilemapGPULayer`, but `wallLayer` is declared
(line 44) as just `TilemapLayer`.

*Recommended:* the layer is never created as a GPU layer here, so say so with a cast (checked with
`deno check`):

```ts
this.wallLayer = map.createLayer("Walls", allTiles) as Phaser.Tilemaps.TilemapLayer;
```

**b) `src/game/scenes/GameScene.ts:147`: overlap callback parameter types**

```ts
this.physics.add.overlap(this.player, this.pickups, this.CollectPickup, undefined, this);
```

Phaser can call an overlap callback with physics bodies or tiles as well as game objects, so
`CollectPickup(_player: GameObject, pickup: GameObject)` (line 296) doesn't match the type Phaser expects.

*Recommended:* take the parameter type from Phaser's own callback type, and check for a game object inside the
method (both checked with `deno check`):

```ts
// at the top of GameScene.ts, after the imports
type Overlapping = Parameters<Phaser.Types.Physics.Arcade.ArcadePhysicsCallback>[0];

private CollectPickup(_player: Overlapping, pickup: Overlapping) {
  if (!(pickup instanceof Phaser.GameObjects.GameObject)) return;
  // ... as before
}
```

### 2. Lint warnings (10)

| Rule | Where | Recommended action |
|---|---|---|
| `no-sloppy-imports` (6) | `src/main.ts:1`, `src/game/main.ts:2-6` | Add `.ts` to local imports, e.g. `import { Boot } from './scenes/Boot.ts'`. Then the `sloppy-imports` setting can come out of `deno.json`. |
| `no-explicit-any` (1) | `GameScene.ts:176` | Replace `any` with the real type. |
| `no-unused-vars` (2) | `GameScene.ts:212` (`distance`), `GameScene.ts:304` (`now`) | Delete the variables, or use them if something is missing. |
| `no-empty` (1) | `GameScene.ts:322` | Remove the empty block, or add the code or a comment saying why it's empty. |

### 3. The Celbridge preview

Celbridge's side preview loads the game, including its images and sounds, without needing a separate web server
(checked in Celbridge on 5 Oct).

The page now also scales to fit the preview panel. `public/fit-to-window.css` (linked from `public/index.html`)
shrinks the game to fit as the panel is resized, keeping its shape, so nothing is cut off. Mouse clicks still land
in the right place. It's the last stylesheet on the page, so it's easy to remove if you'd rather lay the page out
yourselves.

*Recommended:* nothing needed. If you change the page's layout (e.g. add a heading or a panel), check it still
fits a narrow panel.

## Files for the Deno build

`High Noon.celbridge`, `CELBRIDGE.md`, `README_deno_tooling.md`, `README_deno_install.md`, `terminal.console`, `deno.json`, `deno.lock`,
`build.ts`, `tools/test_report.ts`, `tools/tmx_to_json.ts`, `tests/README.md`. See `CELBRIDGE.md` for how to use
them in Celbridge, and `README_deno_tooling.md` for how to use them without it.
