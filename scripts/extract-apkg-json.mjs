import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { parseHTML } from "linkedom";

const require = createRequire(import.meta.url);
const initSqlJs = require("sql.js/dist/sql-asm.js");

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = path.join(rootDir, "assets");

function textFromField(value) {
  const raw = String(value ?? "")
    .replace(/\[sound:[^\]]+\]/gi, "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(div|p|li|tr|h[1-6])\s*>/gi, "\n");
  const { document } = parseHTML(`<html><body>${raw}</body></html>`);
  return (document.body.textContent ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function modelFieldIndexes(models, modelId) {
  const model = models[String(modelId)];
  const fields = Array.isArray(model?.flds) ? model.flds : [];
  return {
    front: fields.findIndex((field) => field?.name === "Front"),
    back: fields.findIndex((field) => field?.name === "Back"),
  };
}

async function extractDeck(SQL, apkgName) {
  const apkgPath = path.join(assetsDir, apkgName);
  const zip = await JSZip.loadAsync(await readFile(apkgPath));
  const collection = zip.file("collection.anki21") ?? zip.file("collection.anki2");
  if (!collection) throw new Error(`${apkgName}: collection database not found`);

  const db = new SQL.Database(await collection.async("uint8array"));
  try {
    const modelsResult = db.exec("select models from col limit 1")[0];
    const models = JSON.parse(String(modelsResult.values[0][0]));
    const notesResult = db.exec("select mid, flds from notes order by id");
    const notes = notesResult[0]?.values ?? [];
    const cards = [];

    for (const [modelId, flds] of notes) {
      const indexes = modelFieldIndexes(models, modelId);
      if (indexes.front < 0 || indexes.back < 0) continue;

      const fields = String(flds ?? "").split("\x1f");
      const en = textFromField(fields[indexes.front]);
      const pt = textFromField(fields[indexes.back]);
      if (!en && !pt) continue;
      cards.push({ pt, en });
    }

    return cards;
  } finally {
    db.close();
  }
}

const SQL = await initSqlJs();
const apkgNames = (await readdir(assetsDir))
  .filter((name) => name.toLowerCase().endsWith(".apkg"))
  .sort();

for (const apkgName of apkgNames) {
  const cards = await extractDeck(SQL, apkgName);
  const outputName = apkgName.replace(/\.apkg$/i, ".json");
  const outputPath = path.join(assetsDir, outputName);
  await writeFile(outputPath, `${JSON.stringify(cards, null, 2)}\n`, "utf8");
  console.log(`${outputName}: ${cards.length} cards`);
}
