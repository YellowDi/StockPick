import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const requiredTargets = [
  join(root, "node_modules/liveline/dist/index.js"),
  join(root, "node_modules/liveline/dist/index.cjs"),
];
const optionalTargets = [
  join(root, "node_modules/.vite/deps/liveline.js"),
];

const replacements = [
  {
    alternatives: [
      [
        'dotUp: "#22c55e",\n    dotDown: "#ef4444",',
        'dotUp: "#ef4444",\n    dotDown: "#22c55e",',
      ],
      [
        'dotUp: "#22c55e",\n\t\tdotDown: "#ef4444",',
        'dotUp: "#ef4444",\n\t\tdotDown: "#22c55e",',
      ],
    ],
  },
  {
    alternatives: [
      [
        'glowUp: "rgba(34, 197, 94, 0.18)",\n    glowDown: "rgba(239, 68, 68, 0.18)",',
        'glowUp: "rgba(239, 68, 68, 0.18)",\n    glowDown: "rgba(34, 197, 94, 0.18)",',
      ],
      [
        'glowUp: "rgba(34, 197, 94, 0.18)",\n\t\tglowDown: "rgba(239, 68, 68, 0.18)",',
        'glowUp: "rgba(239, 68, 68, 0.18)",\n\t\tglowDown: "rgba(34, 197, 94, 0.18)",',
      ],
    ],
  },
  {
    alternatives: [
      [
        'var BULL = "#22c55e";\nvar BEAR = "#ef4444";\nvar BULL_RGB = [34, 197, 94];\nvar BEAR_RGB = [239, 68, 68];',
        'var BULL = "#ef4444";\nvar BEAR = "#22c55e";\nvar BULL_RGB = [239, 68, 68];\nvar BEAR_RGB = [34, 197, 94];',
      ],
      [
        'var BULL = "#22c55e";\nvar BEAR = "#ef4444";\nvar BULL_RGB = [\n\t34,\n\t197,\n\t94\n];\nvar BEAR_RGB = [\n\t239,\n\t68,\n\t68\n];',
        'var BULL = "#ef4444";\nvar BEAR = "#22c55e";\nvar BULL_RGB = [\n\t239,\n\t68,\n\t68\n];\nvar BEAR_RGB = [\n\t34,\n\t197,\n\t94\n];',
      ],
    ],
  },
  {
    alternatives: [
      [
        "var MOMENTUM_GREEN = [34, 197, 94];\nvar MOMENTUM_RED = [239, 68, 68];",
        "var MOMENTUM_GREEN = [239, 68, 68];\nvar MOMENTUM_RED = [34, 197, 94];",
      ],
      [
        "var MOMENTUM_GREEN = [\n\t34,\n\t197,\n\t94\n];\nvar MOMENTUM_RED = [\n\t239,\n\t68,\n\t68\n];",
        "var MOMENTUM_GREEN = [\n\t239,\n\t68,\n\t68\n];\nvar MOMENTUM_RED = [\n\t34,\n\t197,\n\t94\n];",
      ],
    ],
  },
  {
    alternatives: [
      [
        'momentum === "up" ? "#22c55e" : momentum === "down" ? "#ef4444"',
        'momentum === "up" ? "#ef4444" : momentum === "down" ? "#22c55e"',
      ],
    ],
  },
];

for (const target of requiredTargets) {
  if (!existsSync(target)) {
    throw new Error(`Missing liveline bundle: ${target}`);
  }

  patchFile(target);
}

for (const target of optionalTargets) {
  if (existsSync(target)) {
    patchFile(target);
  }
}

function patchFile(target) {
  let source = readFileSync(target, "utf8");
  const original = source;

  for (const replacement of replacements) {
    const match = replacement.alternatives.find(([from]) => source.includes(from));

    if (match) {
      source = source.replace(match[0], match[1]);
    } else if (!replacement.alternatives.some(([, to]) => source.includes(to))) {
      throw new Error(`Unable to patch liveline colors in ${target}`);
    }
  }

  source = removeLivelineEdgeFade(source);

  if (source !== original) {
    writeFileSync(target, source);
  }
}

function removeLivelineEdgeFade(source) {
  const marker = "// StockPick: liveline edge fade removed.";
  const edgeFadePatterns = [
    /^([ \t]*)const fadeW = FADE_EDGE_WIDTH;\n\1ctx\.save\(\);\n\1ctx\.globalCompositeOperation = "destination-out";\n\1const fadeGrad = ctx\.createLinearGradient\(layout\.pad\.left, 0, layout\.pad\.left \+ fadeW, 0\);\n\1fadeGrad\.addColorStop\(0, "rgba\(0, 0, 0, 1\)"\);\n\1fadeGrad\.addColorStop\(1, "rgba\(0, 0, 0, 0\)"\);\n\1ctx\.fillStyle = fadeGrad;\n\1ctx\.fillRect\(0, 0, layout\.pad\.left \+ fadeW, layout\.h\);\n\1ctx\.restore\(\);/gm,
    /^([ \t]*)ctx\.save\(\);\n\1ctx\.globalCompositeOperation = "destination-out";\n\1const fadeGrad = ctx\.createLinearGradient\(layout\.pad\.left, 0, layout\.pad\.left \+ FADE_EDGE_WIDTH, 0\);\n\1fadeGrad\.addColorStop\(0, "rgba\(0, 0, 0, 1\)"\);\n\1fadeGrad\.addColorStop\(1, "rgba\(0, 0, 0, 0\)"\);\n\1ctx\.fillStyle = fadeGrad;\n\1ctx\.fillRect\(0, 0, layout\.pad\.left \+ FADE_EDGE_WIDTH, layout\.h\);\n\1ctx\.restore\(\);/gm,
    /^([ \t]*)ctx\.save\(\);\n\1ctx\.globalCompositeOperation = "destination-out";\n\1const fadeGrad = ctx\.createLinearGradient\(pad\.left, 0, pad\.left \+ FADE_EDGE_WIDTH, 0\);\n\1fadeGrad\.addColorStop\(0, "rgba\(0, 0, 0, 1\)"\);\n\1fadeGrad\.addColorStop\(1, "rgba\(0, 0, 0, 0\)"\);\n\1ctx\.fillStyle = fadeGrad;\n\1ctx\.fillRect\(0, 0, pad\.left \+ FADE_EDGE_WIDTH, h\);\n\1ctx\.restore\(\);/gm,
  ];

  for (const pattern of edgeFadePatterns) {
    source = source.replace(pattern, (_, indent) => `${indent}${marker}`);
  }

  return source;
}
