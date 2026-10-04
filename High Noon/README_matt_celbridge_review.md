# High Noon (team 1): Celbridge / Deno review

Reviewed 2026-10-04 by Matt.

## Summary

Celbridge's Deno tools were added to this project, alongside the existing Vite/npm setup (which was not
changed). The game builds with `deno task build` and plays correctly from the result: menu, tilemap, pickups,
sounds and HUD all load with no failed requests.

The Deno build's report shows **2 TypeScript errors** and **10 lint warnings**. None of them stop the game
running, but the type errors are real problems in the code. Vite never checks types, so they went unnoticed.

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
`CollectPickup(_player: GameObject, pickup: GameObject)` (line 295) doesn't match the type Phaser expects.

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
| `no-sloppy-imports` (6) | `src/main.ts:1`, `src/game/main.ts:2-6` | Add `.ts` to local imports, e.g. `import { Boot } from './scenes/Boot.ts'`. Vite accepts this too (`allowImportingTsExtensions` is already on in `tsconfig.json`). |
| `no-explicit-any` (1) | `GameScene.ts:176` | Replace `any` with the real type. |
| `no-unused-vars` (2) | `GameScene.ts:212` (`distance`), `GameScene.ts:303` (`now`) | Delete the variables, or use them if something is missing. |
| `no-empty` (1) | `GameScene.ts:321` | Remove the empty block, or add the code or a comment saying why it's empty. |

### 3. Both builds write to `dist/`

`deno task build` and `npm run build` both output to `dist/`, so whichever ran last is what you see.

*Recommended:* fine while trying things out. If both are used regularly, change one of them to a different
folder (e.g. `outDir` in `vite/config.prod.mjs`).

### 4. `fsevents` warning at the start of every Deno build

Deno reads `package.json`, sees Vite's dependencies, and warns that it skipped `fsevents`'s install script. It's
harmless: the Deno build doesn't use Vite.

*Recommended:* ignore it.

### 5. Not yet checked inside Celbridge itself

The build was tested through a local web server, not in Celbridge's side preview. Phaser loads its images, sounds
and map at runtime, and browsers can block that when a page is opened as a plain file from disk.

*Recommended:* open `High Noon.celbridge` and check the game appears in the side preview. If it shows a blank
or black screen, the preview is loading the page from disk and blocking the assets. The game then needs a small
local web server instead of the plain-file preview.

### 6. `log.js` (from the Phaser template)

`npm run dev` and `npm run build` run `log.js`, which sends an anonymous usage ping to Phaser Studio (see the
team's `README.md`). The Deno build doesn't run it.

*Recommended:* nothing needed. To stop it, use `npm run dev-nolog` / `npm run build-nolog`.

## Files added for the Deno build

`High Noon.celbridge`, `CELBRIDGE.md`, `terminal.console`, `deno.json`, `deno.lock`, `build.ts`,
`tools/test_report.ts`, `tools/tmx_to_json.ts`, `tests/README.md`. The only existing file changed is `.gitignore` (added `test_output/`
and `.celbridge/`). See `CELBRIDGE.md` for how to use them.
