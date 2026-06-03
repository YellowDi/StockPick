import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

const requiredTargets = [
  join(root, "node_modules/liveline/dist/index.js"),
  join(root, "node_modules/liveline/dist/index.cjs"),
];

const optionalTargets = [
  join(root, "node_modules/.vite/deps/liveline.js"),
];

const upstreamCandlestickColors = `// src/draw/candlestick.ts
var BULL = "#22c55e";
var BEAR = "#ef4444";
var BULL_RGB = [34, 197, 94];
var BEAR_RGB = [239, 68, 68];`;

const aShareCandlestickColors = `// src/draw/candlestick.ts
var BULL = "#ef4444";
var BEAR = "#22c55e";
var BULL_RGB = [239, 68, 68];
var BEAR_RGB = [34, 197, 94];`;

function patchTarget(target, required) {
  if (!existsSync(target)) {
    if (required) {
      throw new Error(`Missing required liveline target: ${target}`);
    }

    return;
  }

  const source = readFileSync(target, "utf8");

  if (source.includes(aShareCandlestickColors)) {
    return;
  }

  if (!source.includes(upstreamCandlestickColors)) {
    throw new Error(`Unable to find liveline candlestick colors in ${target}`);
  }

  writeFileSync(
    target,
    source.replace(upstreamCandlestickColors, aShareCandlestickColors),
  );
}

for (const target of requiredTargets) {
  patchTarget(target, true);
}

for (const target of optionalTargets) {
  patchTarget(target, false);
}
