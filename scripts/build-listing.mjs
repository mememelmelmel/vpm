/**
 * Build the combined VPM listing (index.json) by merging the per-package
 * listings declared in sources.json.
 *
 * Dependency-free: runs on plain Node (>=18) using the built-in fetch.
 *   node scripts/build-listing.mjs
 *
 * Each entry in sources.json "sources" is the published index.json URL of a
 * single-package listing. Their `packages` blocks are merged into one listing.
 * The per-package listings remain the source of truth; this only aggregates.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(repoRoot, "sources.json");
const outPath = path.join(repoRoot, "index.json");

const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const { sources, ...listingMeta } = config;

if (!Array.isArray(sources) || sources.length === 0) {
  throw new Error("sources.json must contain a non-empty `sources` array.");
}

const mergedPackages = {};

for (const url of sources) {
  console.log(`Fetching ${url}`);
  const res = await fetch(url, { headers: { "cache-control": "no-cache" } });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  const listing = await res.json();
  const packages = listing.packages ?? {};

  for (const [pkgName, pkg] of Object.entries(packages)) {
    if (!mergedPackages[pkgName]) {
      mergedPackages[pkgName] = { versions: {} };
    }
    Object.assign(mergedPackages[pkgName].versions, pkg.versions ?? {});
  }
}

const output = { ...listingMeta, packages: mergedPackages };

fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf-8");

const summary = Object.entries(mergedPackages)
  .map(([name, p]) => `  ${name}: ${Object.keys(p.versions).length} version(s)`)
  .join("\n");
console.log(`Wrote ${outPath}\n${summary}`);
