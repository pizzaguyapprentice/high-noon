// Builds the project, then tests it:
//   1. type checks src/ and tests/
//   2. bundles src/main.ts + everything it imports -> dist/app.js   (ONE plain script, no server needed)
//   3. copies public/**/*                           -> dist/**/*    (HTML, CSS, images, as-is)
//      and index.html                               -> dist/index.html (pointed at app.js instead of src/main.ts)
//   4. removes anything in dist/ that no longer comes from public/
//   5. runs every test in tests/ and writes a readable report to test_output/
//
// Run once:                         deno task build
// Rebuild and retest on every save: deno task dev   (terminal.console starts this for you)
//
// This is the Deno/Celbridge build. The Vite/npm build (npm run dev, npm run build) still works as before -
// both use the same src/, public/ and index.html. Note that both write to dist/.
//
// You never need to edit this file.

import { runTests, typeCheck } from "./tools/test_report.ts";

const ROOT_DIR = new URL("./", import.meta.url);
const PUBLIC_DIR = new URL("./public/", ROOT_DIR);
const DIST_DIR = new URL("./dist/", ROOT_DIR);

const started = performance.now();
console.log(`\n=== Build started at ${new Date().toLocaleTimeString()} ===`);

// dist/ is updated in place (not deleted and recreated), so a preview that has dist/index.html open
// keeps working across rebuilds. Old files are cleaned up at the end instead (step 4).
await Deno.mkdir(DIST_DIR, { recursive: true });

// Runs "deno <args>" in the project folder, and waits for it to finish.
// When `quiet` is true the output is only shown if the command fails.
async function deno(args: string[], quiet = false): Promise<boolean> {
  const result = await new Deno.Command(Deno.execPath(), {
    args,
    cwd: ROOT_DIR,
    stdout: quiet ? "piped" : "inherit",
    stderr: quiet ? "piped" : "inherit",
  }).output();

  if (quiet && !result.success) {
    await Deno.stdout.write(result.stdout);
    await Deno.stderr.write(result.stderr);
  }
  return result.success;
}

// 1. Type check (bundling only strips the types, it doesn't check them).
//    Errors are reported, but the page is still built so you can keep experimenting.
const checked = await typeCheck(ROOT_DIR);
if (!checked.ok) {
  console.log(checked.text);
  console.log("TypeScript found errors (see above) - the page was still built, but may not work");
}

// 2. Bundle src/main.ts, and every file it imports, into dist/app.js.
//    --format=iife makes a plain <script>, so dist/index.html works opened straight from the disk.
const bundled = await deno(
  ["bundle", "--quiet", "--platform=browser", "--format=iife", "--output=dist/app.js", "src/main.ts"],
  true,
);
if (bundled) {
  console.log("Built dist/app.js from src/main.ts (and the files it imports)");
} else {
  console.log("The page could not be built (see above)");
}

// 3. Copy every file under public/ (HTML, CSS, images, ...) as-is. Files already in dist/ with the same size and
//    modified time are skipped, so a big assets folder only costs time when something in it changes.
let copied = 0;
let unchanged = 0;
async function copyFolder(from: URL, to: URL): Promise<void> {
  await Deno.mkdir(to, { recursive: true });
  for await (const entry of Deno.readDir(from)) {
    if (entry.isDirectory) {
      await copyFolder(new URL(entry.name + "/", from), new URL(entry.name + "/", to));
    } else if (entry.name !== ".DS_Store") {
      const source = new URL(entry.name, from);
      const target = new URL(entry.name, to);
      const before = await Deno.stat(source);
      const after = await Deno.stat(target).catch(() => null);
      if (after && after.size === before.size && after.mtime?.getTime() === before.mtime?.getTime()) {
        unchanged++;
        continue;
      }
      await Deno.copyFile(source, target);
      // Give the copy the original's modified time, so the next build can tell it is up to date.
      if (before.mtime) await Deno.utime(target, before.atime ?? before.mtime, before.mtime);
      copied++;
    }
  }
}
await copyFolder(PUBLIC_DIR, DIST_DIR);
console.log(`Copied ${copied} file(s) from public/ to dist/ (${unchanged} unchanged)`);

// index.html is Vite's page: it loads /src/main.ts as a module, from the root of a web server. The dist/ copy
// loads the bundled app.js instead, with relative paths, so it works opened straight from the disk.
const page = await Deno.readTextFile(new URL("./index.html", ROOT_DIR));
await Deno.writeTextFile(
  new URL("./index.html", DIST_DIR),
  page
    .replace(/<script type="module" src="\/?src\/main\.ts"><\/script>/, '<script src="app.js"></script>')
    .replace(/(href|src)="\/(?!\/)/g, '$1="'),
);
console.log("Wrote dist/index.html from index.html");

// 4. Remove anything in dist/ that no longer comes from public/ (e.g. a deleted image).
async function removeOldFiles(dist: URL, from: URL, prefix = ""): Promise<void> {
  for await (const entry of Deno.readDir(dist)) {
    if (["app.js", "index.html"].includes(prefix + entry.name) || entry.name === ".DS_Store") continue;
    const name = entry.name + (entry.isDirectory ? "/" : "");
    const inPublic = await Deno.stat(new URL(name, from)).then(() => true, () => false);
    if (!inPublic) {
      await Deno.remove(new URL(name, dist), { recursive: true });
      console.log(`Removed dist/${prefix}${name} (no longer in public/)`);
    } else if (entry.isDirectory) {
      await removeOldFiles(new URL(name, dist), new URL(name, from), prefix + name);
    }
  }
}
await removeOldFiles(DIST_DIR, PUBLIC_DIR);

const builtIn = ((performance.now() - started) / 1000).toFixed(1);
console.log(`dist/ is up to date (${builtIn}s) - press refresh on the dist/index.html preview`);

// 5. Test, and write test_output/index.html + test_output/summary.md.
await runTests(ROOT_DIR, checked);

// "deno task dev" passes --watching (Deno restarts this script whenever a watched file changes).
if (Deno.args.includes("--watching")) {
  console.log("\nWatching src/, public/, tests/ and index.html - save a file to rebuild and retest (Ctrl+C to stop)");
}
