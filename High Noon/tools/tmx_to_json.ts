// Converts a Tiled map (.tmx) to Tiled's JSON format, which Phaser can load with this.load.tilemapTiledJSON().
// It does the same job as Tiled's own command line, without needing Tiled installed:
//
//   tiled --export-map json --embed-tilesets in.tmx out.json
//   deno task map in.tmx out.json                              <- this file
//
// If out.json is left out, it is written next to in.tmx, with the same name.
//
// Differences from Tiled:
//   - tilesets are always embedded (Phaser can't load external .tsx tilesets), like --embed-tilesets
//   - tile layer data is always written as a plain list of numbers, never base64 (Phaser can't read
//     compressed base64)
//   - infinite maps, Wang sets and zstd compression aren't supported (Phaser doesn't use them either)
//
// You never need to edit this file.

import { dirname, relative, resolve } from "jsr:@std/path@^1";

// ---------------------------------------------------------------------------------------------
// A small XML reader - enough for the files Tiled writes
// ---------------------------------------------------------------------------------------------

interface XmlElement {
  name: string;
  attrs: Record<string, string>;
  children: XmlElement[];
  text: string;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|\w+);/g, (match, code: string) => {
    if (code.startsWith("#x")) return String.fromCodePoint(parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(parseInt(code.slice(1), 10));
    return ENTITIES[code] ?? match;
  });
}

function parseXml(xml: string): XmlElement {
  const root: XmlElement = { name: "#root", attrs: {}, children: [], text: "" };
  const stack = [root];
  const token =
    /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<!DOCTYPE[^>]*>|<\/([\w:.-]+)\s*>|<([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  for (const m of xml.matchAll(token)) {
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) {
      top.text += m[1];
    } else if (m[2] !== undefined) {
      if (top.name !== m[2]) throw new Error(`Bad XML: </${m[2]}> doesn't match <${top.name}>`);
      stack.pop();
    } else if (m[3] !== undefined) {
      const element: XmlElement = { name: m[3], attrs: {}, children: [], text: "" };
      for (const a of m[4].matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
        element.attrs[a[1]] = decodeEntities(a[2] ?? a[3]);
      }
      top.children.push(element);
      if (m[5] !== "/") stack.push(element);
    } else if (m[6] !== undefined) {
      top.text += decodeEntities(m[6]);
    }
  }
  if (stack.length !== 1) throw new Error(`Bad XML: <${stack[stack.length - 1].name}> is never closed`);
  return root;
}

function child(e: XmlElement, name: string): XmlElement | undefined {
  return e.children.find((c) => c.name === name);
}

function childrenNamed(e: XmlElement, name: string): XmlElement[] {
  return e.children.filter((c) => c.name === name);
}

// ---------------------------------------------------------------------------------------------
// Converting Tiled's XML to Tiled's JSON
// ---------------------------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
type Json = Record<string, any>;

interface Context {
  /** The folder of the file being read (.tmx, or an external .tsx), which its relative paths start from. */
  fromDir: string;
  /** The folder the JSON is written to, which its relative paths must start from. */
  toDir: string;
}

/** Re-points a path in the .tmx (relative to its folder) so it's relative to the JSON's folder, as Tiled does. */
function rebase(path: string, ctx: Context): string {
  if (path === "" || /^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith("/")) return path;
  return relative(ctx.toDir, resolve(ctx.fromDir, path)).replaceAll("\\", "/");
}

function num(value: string | undefined, fallback: number): number {
  return value === undefined ? fallback : Number(value);
}

/** Copies the attributes that are numbers, if they are present. */
function numbers(e: XmlElement, out: Json, names: string[]): void {
  for (const n of names) if (e.attrs[n] !== undefined) out[n] = Number(e.attrs[n]);
}

/** Copies the attributes that are colours, if they are present. Like Tiled, "#ffRRGGBB" is written as "#RRGGBB". */
function colors(e: XmlElement, out: Json, names: string[]): void {
  for (const n of names) {
    const value = e.attrs[n];
    if (value !== undefined) out[n] = /^#ff[0-9a-f]{6}$/i.test(value) ? "#" + value.slice(3) : value;
  }
}

/** Copies the attributes that are strings, if they are present. */
function strings(e: XmlElement, out: Json, names: string[]): void {
  for (const n of names) if (e.attrs[n] !== undefined) out[n] = e.attrs[n];
}

function convertProperties(e: XmlElement, ctx: Context): Json[] | undefined {
  const props = child(e, "properties");
  if (!props) return undefined;
  const list = childrenNamed(props, "property").map((p) => {
    const type = p.attrs.type ?? "string";
    const out: Json = { name: p.attrs.name, type };
    if (p.attrs.propertytype !== undefined) out.propertytype = p.attrs.propertytype;
    const raw = p.attrs.value ?? p.text;
    if (type === "bool") out.value = raw === "true";
    else if (type === "int" || type === "float" || type === "object") out.value = num(raw, 0);
    else if (type === "file") out.value = rebase(raw, ctx);
    else if (type === "class") out.value = classValue(p, ctx);
    else out.value = raw;
    return out;
  });
  return list.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** A class property's value is an object of its members (members left at their defaults aren't written). */
function classValue(p: XmlElement, ctx: Context): Json {
  const value: Json = {};
  for (const member of convertProperties(p, ctx) ?? []) value[member.name] = member.value;
  return value;
}

/** Adds the settings every kind of layer can have. */
function layerCommon(e: XmlElement, type: string, ctx: Context): Json {
  const out: Json = {
    id: num(e.attrs.id, 0),
    name: e.attrs.name ?? "",
    type,
    opacity: num(e.attrs.opacity, 1),
    visible: e.attrs.visible !== "0",
    x: num(e.attrs.x, 0),
    y: num(e.attrs.y, 0),
  };
  if (e.attrs.offsetx !== undefined || e.attrs.offsety !== undefined) {
    out.offsetx = num(e.attrs.offsetx, 0);
    out.offsety = num(e.attrs.offsety, 0);
  }
  numbers(e, out, ["parallaxx", "parallaxy"]);
  colors(e, out, ["tintcolor"]);
  strings(e, out, ["class", "mode"]);
  if (e.attrs.locked === "1") out.locked = true;
  const properties = convertProperties(e, ctx);
  if (properties) out.properties = properties;
  return out;
}

async function decodeData(data: XmlElement): Promise<number[]> {
  const encoding = data.attrs.encoding;
  const compression = data.attrs.compression;
  if (encoding === undefined) {
    return childrenNamed(data, "tile").map((t) => num(t.attrs.gid, 0));
  }
  if (encoding === "csv") {
    return data.text.split(",").map((s) => s.trim()).filter((s) => s !== "").map(Number);
  }
  if (encoding !== "base64") throw new Error(`Unknown tile layer encoding "${encoding}"`);

  let bytes: Uint8Array<ArrayBuffer> = Uint8Array.from(atob(data.text.trim()), (c) => c.charCodeAt(0));
  if (compression === "zlib" || compression === "gzip") {
    const stream = new Blob([bytes]).stream().pipeThrough(
      new DecompressionStream(compression === "zlib" ? "deflate" : "gzip"),
    );
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  } else if (compression !== undefined) {
    throw new Error(`"${compression}" compression isn't supported - in Tiled, change the map's Tile Layer Format`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const gids: number[] = [];
  for (let i = 0; i + 4 <= bytes.length; i += 4) gids.push(view.getUint32(i, true));
  return gids;
}

function convertObject(o: XmlElement, ctx: Context): Json {
  const out: Json = {
    id: num(o.attrs.id, 0),
    name: o.attrs.name ?? "",
    type: o.attrs.type ?? o.attrs.class ?? "",
    x: num(o.attrs.x, 0),
    y: num(o.attrs.y, 0),
    width: num(o.attrs.width, 0),
    height: num(o.attrs.height, 0),
    rotation: num(o.attrs.rotation, 0),
    opacity: num(o.attrs.opacity, 1),
    visible: o.attrs.visible !== "0",
  };
  if (o.attrs.gid !== undefined) out.gid = Number(o.attrs.gid);
  if (o.attrs.template !== undefined) out.template = rebase(o.attrs.template, ctx);
  if (child(o, "ellipse")) out.ellipse = true;
  if (child(o, "point")) out.point = true;
  if (child(o, "capsule")) out.capsule = true;
  for (const shape of ["polygon", "polyline"]) {
    const s = child(o, shape);
    if (s) {
      out[shape] = (s.attrs.points ?? "").trim().split(/\s+/).map((pair) => {
        const [x, y] = pair.split(",").map(Number);
        return { x, y };
      });
    }
  }
  const text = child(o, "text");
  if (text) {
    const t: Json = { text: text.text };
    numbers(text, t, ["pixelsize"]);
    strings(text, t, ["fontfamily", "halign", "valign"]);
    colors(text, t, ["color"]);
    for (const flag of ["wrap", "bold", "italic", "underline", "strikeout"]) {
      if (text.attrs[flag] === "1") t[flag] = true;
    }
    if (text.attrs.kerning === "0") t.kerning = false;
    out.text = t;
  }
  const properties = convertProperties(o, ctx);
  if (properties) out.properties = properties;
  return out;
}

function convertObjectGroup(e: XmlElement, ctx: Context): Json {
  const out = layerCommon(e, "objectgroup", ctx);
  out.draworder = e.attrs.draworder ?? "topdown";
  colors(e, out, ["color"]);
  out.objects = childrenNamed(e, "object").map((o) => convertObject(o, ctx));
  return out;
}

async function convertLayers(parent: XmlElement, ctx: Context): Promise<Json[]> {
  const layers: Json[] = [];
  for (const e of parent.children) {
    if (e.name === "layer") {
      const out = layerCommon(e, "tilelayer", ctx);
      out.width = num(e.attrs.width, 0);
      out.height = num(e.attrs.height, 0);
      const data = child(e, "data");
      if (data && child(data, "chunk")) {
        throw new Error("Infinite maps aren't supported - in Tiled, untick Map > Infinite");
      }
      out.data = data ? await decodeData(data) : [];
      layers.push(out);
    } else if (e.name === "objectgroup") {
      layers.push(convertObjectGroup(e, ctx));
    } else if (e.name === "imagelayer") {
      const out = layerCommon(e, "imagelayer", ctx);
      const image = child(e, "image");
      if (image) convertImage(image, out, ctx);
      else out.image = "";
      if (e.attrs.repeatx === "1") out.repeatx = true;
      if (e.attrs.repeaty === "1") out.repeaty = true;
      layers.push(out);
    } else if (e.name === "group") {
      const out = layerCommon(e, "group", ctx);
      out.layers = await convertLayers(e, ctx);
      layers.push(out);
    }
  }
  return layers;
}

function convertImage(image: XmlElement, out: Json, ctx: Context): void {
  out.image = rebase(image.attrs.source ?? "", ctx);
  if (image.attrs.width !== undefined) out.imagewidth = Number(image.attrs.width);
  if (image.attrs.height !== undefined) out.imageheight = Number(image.attrs.height);
  if (image.attrs.trans !== undefined) out.transparentcolor = "#" + image.attrs.trans;
}

async function convertTileset(e: XmlElement, ctx: Context): Promise<Json> {
  const firstgid = num(e.attrs.firstgid, 1);

  // An external tileset (.tsx): read it, and embed it.
  if (e.attrs.source !== undefined) {
    const path = resolve(ctx.fromDir, e.attrs.source);
    const tsx = child(parseXml(await Deno.readTextFile(path)), "tileset");
    if (!tsx) throw new Error(`${e.attrs.source} isn't a Tiled tileset`);
    const embedded = await convertTileset({ ...tsx, attrs: { ...tsx.attrs, firstgid: String(firstgid) } }, {
      ...ctx,
      fromDir: dirname(path),
    });
    return embedded;
  }

  const out: Json = {
    firstgid,
    name: e.attrs.name ?? "",
    tilewidth: num(e.attrs.tilewidth, 0),
    tileheight: num(e.attrs.tileheight, 0),
    tilecount: num(e.attrs.tilecount, 0),
    columns: num(e.attrs.columns, 0),
    margin: num(e.attrs.margin, 0),
    spacing: num(e.attrs.spacing, 0),
  };
  strings(e, out, ["class", "objectalignment", "tilerendersize", "fillmode"]);
  colors(e, out, ["backgroundcolor"]);
  const image = child(e, "image");
  if (image) convertImage(image, out, ctx);

  const offset = child(e, "tileoffset");
  if (offset) out.tileoffset = { x: num(offset.attrs.x, 0), y: num(offset.attrs.y, 0) };
  const grid = child(e, "grid");
  if (grid) {
    out.grid = {
      orientation: grid.attrs.orientation ?? "orthogonal",
      width: num(grid.attrs.width, 0),
      height: num(grid.attrs.height, 0),
    };
  }
  const transformations = child(e, "transformations");
  if (transformations) {
    out.transformations = {};
    for (const flag of ["hflip", "vflip", "rotate", "preferuntransformed"]) {
      out.transformations[flag] = transformations.attrs[flag] === "1";
    }
  }
  const properties = convertProperties(e, ctx);
  if (properties) out.properties = properties;

  const tiles = childrenNamed(e, "tile").map((t) => {
    const tile: Json = { id: num(t.attrs.id, 0) };
    const type = t.attrs.type ?? t.attrs.class;
    if (type !== undefined) tile.type = type;
    numbers(t, tile, ["probability", "x", "y", "width", "height"]);
    const tileImage = child(t, "image");
    if (tileImage) convertImage(tileImage, tile, ctx);
    const animation = child(t, "animation");
    if (animation) {
      tile.animation = childrenNamed(animation, "frame").map((f) => ({
        tileid: num(f.attrs.tileid, 0),
        duration: num(f.attrs.duration, 0),
      }));
    }
    const objects = child(t, "objectgroup");
    if (objects) tile.objectgroup = convertObjectGroup(objects, ctx);
    const tileProperties = convertProperties(t, ctx);
    if (tileProperties) tile.properties = tileProperties;
    return tile;
  });
  if (tiles.length > 0) out.tiles = tiles;
  return out;
}

/**
 * Converts the text of a .tmx file to Tiled's JSON format.
 *
 * `fromDir` is the folder the .tmx is in, and `toDir` the folder the JSON will be saved in: paths in the map
 * (tileset images, external tilesets) are re-pointed so they still work from there.
 */
export async function tmxToJson(xml: string, fromDir: string, toDir: string): Promise<Json> {
  const map = child(parseXml(xml), "map");
  if (!map) throw new Error("This isn't a Tiled map (there's no <map> element)");
  if (map.attrs.infinite === "1") throw new Error("Infinite maps aren't supported - in Tiled, untick Map > Infinite");
  const ctx: Context = { fromDir, toDir };

  const out: Json = {
    type: "map",
    version: "1.10",
    tiledversion: map.attrs.tiledversion ?? "",
    orientation: map.attrs.orientation ?? "orthogonal",
    renderorder: map.attrs.renderorder ?? "right-down",
    width: num(map.attrs.width, 0),
    height: num(map.attrs.height, 0),
    tilewidth: num(map.attrs.tilewidth, 0),
    tileheight: num(map.attrs.tileheight, 0),
    infinite: false,
    compressionlevel: num(map.attrs.compressionlevel, -1),
    nextlayerid: num(map.attrs.nextlayerid, 1),
    nextobjectid: num(map.attrs.nextobjectid, 1),
  };
  numbers(map, out, ["hexsidelength"]);
  if (map.attrs.parallaxoriginx !== undefined || map.attrs.parallaxoriginy !== undefined) {
    out.parallaxoriginx = num(map.attrs.parallaxoriginx, 0);
    out.parallaxoriginy = num(map.attrs.parallaxoriginy, 0);
  }
  strings(map, out, ["staggeraxis", "staggerindex", "class"]);
  colors(map, out, ["backgroundcolor"]);
  const properties = convertProperties(map, ctx);
  if (properties) out.properties = properties;

  out.tilesets = [];
  for (const t of childrenNamed(map, "tileset")) out.tilesets.push(await convertTileset(t, ctx));
  out.layers = await convertLayers(map, ctx);
  return out;
}

/** Writes the JSON the way Tiled does: keys in alphabetical order, and tile data one map row per line. */
export function formatJson(map: Json): string {
  const rows = new Map<string, string>();
  const sorted = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sorted);
    if (value === null || typeof value !== "object") return value;
    const obj = value as Json;
    const out: Json = {};
    for (const key of Object.keys(obj).sort()) {
      if (key === "data" && obj.type === "tilelayer" && Array.isArray(obj.data)) {
        // Swap the numbers for a placeholder, then put them back afterwards, one row per line.
        const id = `@@data${rows.size}@@`;
        const width = Math.max(1, obj.width);
        const lines: string[] = [];
        for (let i = 0; i < obj.data.length; i += width) lines.push(obj.data.slice(i, i + width).join(", "));
        rows.set(id, "[" + lines.join(",\n            ") + "]");
        out[key] = id;
      } else {
        out[key] = sorted(obj[key]);
      }
    }
    return out;
  };
  let text = JSON.stringify(sorted(map), null, 2);
  for (const [id, data] of rows) text = text.replace(`"${id}"`, data);
  return text + "\n";
}

/** Converts in.tmx to out.json (default: next to in.tmx, with the same name). */
export async function convertFile(input: string, output?: string): Promise<string> {
  const inPath = resolve(input);
  const outPath = resolve(output ?? inPath.replace(/\.tmx$/i, "") + ".json");
  const json = await tmxToJson(await Deno.readTextFile(inPath), dirname(inPath), dirname(outPath));
  await Deno.mkdir(dirname(outPath), { recursive: true });
  await Deno.writeTextFile(outPath, formatJson(json));
  return outPath;
}

if (import.meta.main) {
  const [input, output] = Deno.args;
  if (!input || Deno.args.length > 2) {
    console.log("Converts a Tiled map to JSON, for Phaser's this.load.tilemapTiledJSON()\n");
    console.log("Usage:  deno task map in.tmx [out.json]");
    Deno.exit(1);
  }
  try {
    const outPath = await convertFile(input, output);
    console.log(`Wrote ${output ?? relative(Deno.cwd(), outPath)} from ${input}`);
  } catch (error) {
    console.log(`Couldn't convert ${input}: ${error instanceof Error ? error.message : error}`);
    Deno.exit(1);
  }
}
