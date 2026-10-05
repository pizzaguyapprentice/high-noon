// Runs the project's tests (the files in tests/, and the @example code blocks in src/'s doc comments), the
// type checker and the linter, and writes an easy-to-read report:
//
//   test_output/index.html   the report as a web page (open it in Celbridge, or any browser)
//   test_output/summary.md   the same report as Markdown
//   test_output/tap.txt      the test results in TAP format (as printed in the console)
//   test_output/results.json the raw results, for other tools
//
// build.ts calls runTests() after every build. On its own:  deno task test
//
// You never need to edit this file.

export type Status = "pass" | "fail" | "skip";

export interface TestResult {
  name: string;
  file: string;
  status: Status;
  line?: number;
  message?: string;
  steps: TestResult[];
}

export interface Problem {
  file: string;
  line: number;
  col: number;
  code: string;
  message: string;
  hint?: string;
}

export interface CheckResult {
  ok: boolean;
  errors: Problem[];
  text: string;
}

export interface Report {
  when: string;
  project: string;
  tests: TestResult[];
  runError?: string;
  typeErrors: Problem[];
  lintWarnings: Problem[];
  counts: { passed: number; failed: number; skipped: number };
}

// ---------------------------------------------------------------------------------------------
// Running the tools
// ---------------------------------------------------------------------------------------------

async function denoOutput(root: URL, args: string[]): Promise<{ ok: boolean; out: string; err: string }> {
  const result = await new Deno.Command(Deno.execPath(), {
    args,
    cwd: root,
    stdout: "piped",
    stderr: "piped",
    env: { NO_COLOR: "1" }, // plain text, so the output can be read and re-formatted
  }).output();
  const decoder = new TextDecoder();
  return { ok: result.success, out: decoder.decode(result.stdout), err: decoder.decode(result.stderr) };
}

// Makes file:///full/path/to/project/src/x.ts:3:5 read as src/x.ts:3:5
function relative(root: URL, text: string): string {
  return text.replaceAll(root.href, "").replaceAll(decodeURIComponent(root.pathname), "");
}

// Deno runs each @example code block in a doc comment as a test of its own, named after the file and the
// block's lines: "src/greeting.ts#7-12.ts". Positions inside it count lines of the code Deno generates around the
// example (imports moved to the top, and a test wrapper), not lines of your file - so they are reported as the
// example's line range instead: "src/greeting.ts (example at lines 7-12)".
const DOC_LOCATION = /([\w./-]+?\.[jt]sx?)\\?#(\d+)-(\d+)\.[jt]sx?(?::\d+(?::\d+)?)?/g;

/** Turns "src/greeting.ts#7-12.ts:5:3" into "src/greeting.ts (example at lines 7-12)". */
export function mapDocLocations(text: string): string {
  return text.replace(
    DOC_LOCATION,
    (_match, file: string, start: string, end: string) => `${file} (example at lines ${start}-${end})`,
  );
}

/** The start line of a doc example in "src/greeting.ts#7-12.ts", or undefined if it is not one. */
function docStartLine(file: string): number | undefined {
  const match = file.match(/#(\d+)-\d+\.[jt]sx?$/);
  return match ? Number(match[1]) : undefined;
}

/** Type checks src/ and tests/, including the code examples in doc comments. */
export async function typeCheck(root: URL): Promise<CheckResult> {
  const { ok, err } = await denoOutput(root, ["check", "--quiet", "--doc", "src/", "tests/"]);
  const raw = relative(root, err).replace(/\nerror: Type checking failed\.\s*$/, "").trim();
  const errors: Problem[] = [];
  // Each error looks like:  TS2322 [ERROR]: message \n code \n ^^^ \n    at src/x.ts:1:5
  const pattern = /(TS\d+) \[ERROR\]: ([\s\S]*?)\n\s+at (\S+?):(\d+):(\d+)/g;
  for (const m of raw.matchAll(pattern)) {
    const lines = m[2].split("\n");
    // The message is everything before the echoed line of code and its ^^^ marker.
    const message = lines.length > 2 ? lines.slice(0, -2).join("\n") : lines[0];
    const start = docStartLine(m[3]);
    errors.push(
      start === undefined
        ? { code: m[1], message: message.trim(), file: m[3], line: Number(m[4]), col: Number(m[5]) }
        : {
          code: m[1],
          message: `${message.trim()} (in the example at lines ${m[3].match(/#(\d+-\d+)/)?.[1]})`,
          file: m[3].replace(/#\d+-\d+\.[jt]sx?$/, ""),
          line: start,
          col: 1,
        },
    );
  }
  return { ok, errors, text: mapDocLocations(raw) };
}

/** Lints src/ and tests/ with Deno's recommended rules. */
export async function lint(root: URL): Promise<Problem[]> {
  const { out } = await denoOutput(root, ["lint", "--json", "src/", "tests/"]);
  try {
    const json = JSON.parse(out) as {
      diagnostics: {
        filename: string;
        range: { start: { line: number; col: number } };
        message: string;
        code: string;
        hint: string | null;
      }[];
    };
    return json.diagnostics.map((d) => ({
      file: relative(root, d.filename),
      line: d.range.start.line,
      col: d.range.start.col + 1, // the linter counts columns from 0, the type checker from 1
      code: d.code,
      message: d.message,
      hint: d.hint ?? undefined,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------------------------
// Reading Deno's TAP output
// ---------------------------------------------------------------------------------------------

// Keeps the useful part of a failure message: drops stack lines from inside Deno or @std,
// and makes paths relative to the project.
function cleanMessage(root: URL, message: string): string {
  return mapDocLocations(relative(root, message))
    .split("\n")
    .filter((line) => !/^\s*at .*(ext:|jsr\.io|deno:)/.test(line) && !/^\s+at (innerWrapped|exitSanitizer)/.test(line))
    .join("\n")
    .replace(/\n\s*throw new AssertionError\(message\);\n\s*\^/, "") // @std/assert's own line of code
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

/** Turns Deno's TAP output into a tree of results (tests, and their steps). */
export function parseTap(root: URL, tap: string, files: string[] = []): TestResult[] {
  const top: TestResult[] = [];
  const pending: TestResult[][] = [[]]; // results waiting for their parent test, by depth
  let file = "";
  let last: TestResult | undefined;

  for (const raw of tap.split("\n")) {
    const indent = raw.length - raw.trimStart().length;
    const depth = Math.floor(indent / 4);
    const line = raw.trim();

    const fileMatch = depth === 0 && line.match(/^# (\.\/)?(.+\.[jt]sx?)$/);
    if (fileMatch) {
      file = fileMatch[2].replace(/#\d+-\d+\.[jt]sx?$/, ""); // a doc example is listed under its own file
      files.push(file);
      continue;
    }

    const testMatch = line.match(/^(not ok|ok) \d+ - (.*?)( # (SKIP|TODO).*)?$/);
    if (testMatch) {
      // A doc example is named by its full file URL and line range; give it a readable name instead.
      const docExample = testMatch[2].match(/\\?#(\d+)-(\d+)\.[jt]sx?$/);
      const result: TestResult = {
        name: docExample ? `example in the doc comment (lines ${docExample[1]}-${docExample[2]})` : testMatch[2],
        file,
        status: testMatch[3] ? "skip" : testMatch[1] === "ok" ? "pass" : "fail",
        steps: pending[depth + 1] ?? [],
      };
      pending[depth + 1] = [];
      (pending[depth] ??= []).push(result);
      if (depth === 0) top.push(result);
      last = result;
      continue;
    }

    if (line.startsWith("{") && last) {
      try {
        const diagnostic = JSON.parse(line) as { message?: string; at?: { file?: string; line?: number } };
        last.message = diagnostic.message ? cleanMessage(root, diagnostic.message) : undefined;
        const at = diagnostic.at;
        last.line = at?.file !== undefined && docStartLine(at.file) !== undefined ? docStartLine(at.file) : at?.line;
      } catch { /* not a diagnostic line */ }
    }
  }
  return top;
}

function count(results: TestResult[], status: Status): number {
  return results.reduce((n, r) => n + (r.status === status ? 1 : 0) + count(r.steps, status), 0);
}

// ---------------------------------------------------------------------------------------------
// Writing the report
// ---------------------------------------------------------------------------------------------

const useColour = Deno.stdout.isTerminal() && !Deno.env.get("NO_COLOR");
const green = (s: string) => useColour ? `\x1b[32m${s}\x1b[0m` : s;
const red = (s: string) => useColour ? `\x1b[31m${s}\x1b[0m` : s;
const yellow = (s: string) => useColour ? `\x1b[33m${s}\x1b[0m` : s;
const grey = (s: string) => useColour ? `\x1b[90m${s}\x1b[0m` : s;

/** TAP 14 again, but with the failure details as readable YAML instead of one long JSON line. */
export function toTap(results: TestResult[], colour = false): string {
  const out: string[] = ["TAP version 14"];
  const paint = (f: (s: string) => string, s: string) => colour ? f(s) : s;
  let file = "";

  function write(list: TestResult[], depth: number): void {
    const pad = "    ".repeat(depth);
    list.forEach((r, i) => {
      if (depth === 0 && r.file !== file) {
        file = r.file;
        out.push(paint(grey, `# ${file}`));
      }
      if (r.steps.length > 0) {
        out.push(`${pad}# Subtest: ${r.name}`);
        write(r.steps, depth + 1);
        out.push(`${pad}    1..${r.steps.length}`);
      }
      const n = i + 1;
      if (r.status === "pass") out.push(paint(green, `${pad}ok ${n} - ${r.name}`));
      if (r.status === "skip") out.push(paint(yellow, `${pad}ok ${n} - ${r.name} # SKIP`));
      if (r.status === "fail") {
        out.push(paint(red, `${pad}not ok ${n} - ${r.name}`));
        out.push(`${pad}  ---`);
        out.push(`${pad}  message: |-`);
        for (const m of (r.message ?? "failed").split("\n")) out.push(`${pad}    ${m}`);
        if (r.line) out.push(`${pad}  at: ${r.file}:${r.line}`);
        out.push(`${pad}  ...`);
      }
    });
  }
  write(results, 0);
  out.push(`1..${results.length}`);
  return out.join("\n");
}

function escapeHtml(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function headline(r: Report): string {
  if (r.runError) return "The tests could not run";
  if (r.counts.failed > 0) return `${r.counts.failed} test${r.counts.failed === 1 ? "" : "s"} failing`;
  if (r.counts.passed === 0) return "No tests yet";
  return "All tests passing";
}

function failures(results: TestResult[], path: string[] = []): { path: string[]; result: TestResult }[] {
  return results.flatMap((r) => {
    const here = [...path, r.name];
    const inner = failures(r.steps, here);
    // A test whose only failure is a failed step is reported through that step.
    return r.status === "fail" && inner.length === 0 ? [{ path: here, result: r }] : inner;
  });
}

export function toMarkdown(r: Report): string {
  const md: string[] = [];
  md.push(`# Test report - ${r.project}`, "");
  md.push(`**${headline(r)}** - ${r.when}`, "");
  md.push("| Passed | Failed | Skipped | Type errors | Lint warnings |");
  md.push("|---:|---:|---:|---:|---:|");
  md.push(
    `| ${r.counts.passed} | ${r.counts.failed} | ${r.counts.skipped} | ${r.typeErrors.length} | ${r.lintWarnings.length} |`,
  );
  md.push("");

  if (r.runError) md.push("## The tests could not run", "", "```text", r.runError, "```", "");

  const failed = failures(r.tests);
  if (failed.length > 0) {
    md.push("## Failing tests", "");
    for (const f of failed) {
      md.push(`### ✗ ${f.path.join(" › ")}`, "", `\`${f.result.file}${f.result.line ? ":" + f.result.line : ""}\``, "");
      md.push("```text", f.result.message ?? "failed", "```", "");
    }
  }

  if (r.typeErrors.length > 0) {
    md.push("## Type errors", "");
    for (const e of r.typeErrors) {
      md.push(`- \`${e.file}:${e.line}:${e.col}\` **${e.code}** ${e.message.replaceAll("\n", " ")}`);
    }
    md.push("");
  }

  if (r.lintWarnings.length > 0) {
    md.push("## Lint warnings", "");
    for (const w of r.lintWarnings) {
      md.push(`- \`${w.file}:${w.line}:${w.col}\` **${w.code}** ${w.message}${w.hint ? ` - _${w.hint}_` : ""}`);
    }
    md.push("");
  }

  md.push("## All tests", "");
  let file = "";
  const icon = { pass: "✓", fail: "✗", skip: "○" };
  function list(results: TestResult[], depth: number): void {
    for (const t of results) {
      if (depth === 0 && t.file !== file) {
        file = t.file;
        md.push("", `**${file}**`, "");
      }
      md.push(`${"  ".repeat(depth)}- ${icon[t.status]} ${t.name}${t.status === "skip" ? " _(skipped)_" : ""}`);
      list(t.steps, depth + 1);
    }
  }
  list(r.tests, 0);
  if (r.tests.length === 0) md.push("_No tests found in tests/._");
  md.push("");
  return md.join("\n");
}

// In an assertEquals diff, "-" lines are what the code actually gave and "+" lines what the test expected.
function diffColours(html: string): string {
  return html.split("\n").map((line) =>
    /^-\s/.test(line)
      ? `<span class="actual">${line}</span>`
      : /^\+\s/.test(line)
      ? `<span class="expected">${line}</span>`
      : line
  ).join("\n").replace(
    "[Diff] Actual / Expected",
    '[Diff] <span class="actual">Actual</span> / <span class="expected">Expected</span>',
  );
}

export function toHtml(r: Report): string {
  const state = r.runError || r.counts.failed > 0 ? "bad" : r.counts.passed === 0 ? "none" : "good";
  const icon = { pass: "✓", fail: "✗", skip: "○" };

  const tile = (n: number, label: string, kind: string) =>
    `<div class="tile ${n > 0 ? kind : ""}"><b>${n}</b><span>${label}</span></div>`;

  const failed = failures(r.tests).map((f) => `
    <article class="failure">
      <h3><span class="icon fail">✗</span> ${escapeHtml(f.path.join(" › "))}</h3>
      <code class="where">${escapeHtml(f.result.file)}${f.result.line ? ":" + f.result.line : ""}</code>
      <pre>${diffColours(escapeHtml(f.result.message ?? "failed"))}</pre>
    </article>`).join("");

  const problems = (list: Problem[], kind: string) =>
    list.map((p) => `
    <li><code class="where">${escapeHtml(`${p.file}:${p.line}:${p.col}`)}</code>
      <span class="code ${kind}">${escapeHtml(p.code)}</span> ${escapeHtml(p.message)}
      ${p.hint ? `<div class="hint">${escapeHtml(p.hint)}</div>` : ""}</li>`).join("");

  const groups = new Map<string, TestResult[]>();
  for (const t of r.tests) groups.set(t.file, [...(groups.get(t.file) ?? []), t]);
  const tree = (list: TestResult[]): string =>
    `<ul class="tree">${
      list.map((t) =>
        `<li><span class="icon ${t.status}">${icon[t.status]}</span> ${escapeHtml(t.name)}${
          t.status === "skip" ? " <em>(skipped)</em>" : ""
        }${t.steps.length ? tree(t.steps) : ""}</li>`
      ).join("")
    }</ul>`;
  const all = [...groups].map(([file, list]) => `<h3 class="file">${escapeHtml(file)}</h3>${tree(list)}`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Test report - ${escapeHtml(r.project)}</title>
<style>
  :root { --bg:#f6f7f9; --card:#fff; --text:#1b1f2a; --muted:#5b6472; --line:#dde1e7;
          --good:#2a9d8f; --bad:#e63946; --warn:#f4a261; --none:#457b9d; --pre:#f1f3f6; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#16191f; --card:#1f232b; --text:#e8eaed; --muted:#9aa3ad; --line:#333a45; --pre:#14171c; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 900px; margin: 0 auto; padding: 16px; }
  header.banner { border-radius: 10px; padding: 16px 20px; color: #fff; margin-bottom: 16px; }
  header.good { background: var(--good); } header.bad { background: var(--bad); } header.none { background: var(--none); }
  header h1 { margin: 0; font-size: 24px; } header p { margin: 4px 0 0; opacity: .9; }
  .tiles { display:grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; margin-bottom: 16px; }
  .tile { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:10px; text-align:center; }
  .tile b { display:block; font-size: 26px; } .tile span { color: var(--muted); font-size: 13px; }
  .tile.good b { color: var(--good); } .tile.bad b { color: var(--bad); } .tile.warn b { color: var(--warn); }
  section { background:var(--card); border:1px solid var(--line); border-radius:10px; padding: 4px 16px 12px; margin-bottom: 16px; }
  h2 { font-size: 18px; } h3 { font-size: 15px; margin: 12px 0 4px; }
  pre { background:var(--pre); border:1px solid var(--line); border-radius:6px; padding:10px; overflow-x:auto; font-size:13px; }
  code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 13px; }
  .where { color: var(--muted); }
  .actual { color: var(--bad); } .expected { color: var(--good); }
  .icon { display:inline-block; width: 1.2em; font-weight: bold; }
  .icon.pass { color: var(--good); } .icon.fail { color: var(--bad); } .icon.skip { color: var(--warn); }
  .code { font: 12px ui-monospace, Menlo, monospace; padding: 1px 6px; border-radius: 4px; color: #fff; }
  .code.error { background: var(--bad); } .code.warn { background: var(--warn); color: #1b1f2a; }
  .hint { color: var(--muted); font-size: 13px; margin-left: 1em; }
  ul.problems { padding-left: 1.2em; } ul.problems li { margin-bottom: 6px; }
  ul.tree { list-style: none; padding-left: 1.2em; margin: 2px 0; }
  h3.file { font-family: ui-monospace, Menlo, monospace; color: var(--muted); font-weight: normal; }
  details summary { cursor: pointer; color: var(--muted); }
  footer { color: var(--muted); font-size: 13px; text-align: center; }
</style>
</head>
<body>
<main>
  <header class="banner ${state}">
    <h1>${escapeHtml(headline(r))}</h1>
    <p>${escapeHtml(r.project)} &middot; ${escapeHtml(r.when)}</p>
  </header>
  <div class="tiles">
    ${tile(r.counts.passed, "passed", "good")}
    ${tile(r.counts.failed, "failed", "bad")}
    ${tile(r.counts.skipped, "skipped", "warn")}
    ${tile(r.typeErrors.length, "type errors", "bad")}
    ${tile(r.lintWarnings.length, "lint warnings", "warn")}
  </div>
  ${r.runError ? `<section><h2>The tests could not run</h2><pre>${escapeHtml(r.runError)}</pre></section>` : ""}
  ${failed ? `<section><h2>Failing tests</h2>${failed}</section>` : ""}
  ${
    r.typeErrors.length
      ? `<section><h2>Type errors</h2><ul class="problems">${problems(r.typeErrors, "error")}</ul></section>`
      : ""
  }
  ${
    r.lintWarnings.length
      ? `<section><h2>Lint warnings</h2><ul class="problems">${problems(r.lintWarnings, "warn")}</ul></section>`
      : ""
  }
  <section><h2>All tests</h2>${all || "<p><em>No tests found in tests/.</em></p>"}</section>
  <section><details><summary>TAP output</summary><pre>${escapeHtml(toTap(r.tests))}</pre></details></section>
  <footer>Made by tools/test_report.ts &middot; Markdown version: summary.md</footer>
</main>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------------------------
// The whole thing
// ---------------------------------------------------------------------------------------------

/** Runs everything, prints the TAP and a one-line summary, and writes test_output/. */
export async function runTests(root: URL, check?: CheckResult): Promise<Report> {
  const outDir = new URL("./test_output/", root);
  await Deno.mkdir(outDir, { recursive: true });

  // --no-check: a test that refers to something not written yet still runs (and fails), instead of
  // stopping every test. Type errors are reported separately, by typeCheck().
  const [test, checked, lintWarnings] = await Promise.all([
    // --doc: the @example code blocks in src/'s doc comments run as tests too
    denoOutput(root, ["test", "--no-check", "--doc", "--reporter=tap", "--permit-no-files", "src/", "tests/"]),
    check ? Promise.resolve(check) : typeCheck(root),
    lint(root),
  ]);

  const files: string[] = [];
  const tests = parseTap(root, test.out, files);

  // Deno's TAP reporter leaves out errors that stop a test file loading (for example, importing
  // something that does not exist yet) - the file just shows no tests. Run any such file again with
  // the normal reporter to find out why, and report it as a failure.
  for (const file of files.filter((f) => !tests.some((t) => t.file === f))) {
    const again = await denoOutput(root, ["test", "--no-check", file]);
    if (again.ok) continue; // a test file with no tests in it (yet)
    const why = relative(root, again.out + again.err).split(/\n\s*ERRORS\s*\n/)[1] ?? again.err;
    tests.push({
      name: "(this test file could not run)",
      file,
      status: "fail",
      message: cleanMessage(
        root,
        why.replace(/\n\s*FAILURES[\s\S]*$/, "").replace(/^.*\(uncaught error\)\n/, "")
          .replace(/\nThis error was not caught[\s\S]*$/, "").replace(/^error: /, "").trim(),
      ),
      steps: [],
    });
  }
  // When nothing could run (e.g. a missing file is imported) the reason is in stderr.
  const runError = !test.ok && tests.length === 0 && test.err.trim() !== ""
    ? relative(root, test.err).trim()
    : undefined;

  const project = decodeURIComponent(root.pathname).split("/").filter(Boolean).pop() ?? "project";
  const report: Report = {
    when: new Date().toLocaleString(),
    project,
    tests,
    runError,
    typeErrors: checked.errors,
    lintWarnings,
    counts: { passed: count(tests, "pass"), failed: count(tests, "fail"), skipped: count(tests, "skip") },
  };

  await Promise.all([
    Deno.writeTextFile(new URL("tap.txt", outDir), toTap(tests) + "\n"),
    Deno.writeTextFile(new URL("summary.md", outDir), toMarkdown(report)),
    Deno.writeTextFile(new URL("index.html", outDir), toHtml(report)),
    Deno.writeTextFile(new URL("results.json", outDir), JSON.stringify(report, null, 2)),
  ]);

  // The console: TAP, then one line that says how things stand.
  console.log("");
  if (runError) console.log(red(runError));
  else if (tests.length > 0) console.log(toTap(tests, useColour));
  const { passed, failed, skipped } = report.counts;
  const parts = [
    failed > 0 || runError ? red(`${failed} failed`) : green(`${failed} failed`),
    green(`${passed} passed`),
    skipped > 0 ? yellow(`${skipped} skipped`) : `${skipped} skipped`,
    checked.errors.length > 0 ? red(`${checked.errors.length} type errors`) : "0 type errors",
    lintWarnings.length > 0 ? yellow(`${lintWarnings.length} lint warnings`) : "0 lint warnings",
  ];
  const summary = runError ? red("the tests could not run (see above)") : parts.join(", ");
  console.log(`\nTests: ${summary}  ->  test_output/index.html`);
  return report;
}

// "deno task test" runs this file on its own.
if (import.meta.main) {
  const root = new URL("../", import.meta.url);
  const check = await typeCheck(root);
  if (check.text) console.log(check.text);
  const report = await runTests(root, check);
  Deno.exit(report.counts.failed > 0 || report.runError ? 1 : 0);
}
