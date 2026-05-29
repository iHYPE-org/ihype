// Stubs out node built-ins that are unsupported in CF Workers even with nodejs_compat.
// @sentry/node's context/contextlines integrations top-level require these,
// which crashes the Worker on cold start. Replacing with {} means those
// integrations silently no-op instead of crashing.
import { readFileSync, writeFileSync } from 'node:fs';

const handlerPath = '.open-next/server-functions/default/handler.mjs';
let src = readFileSync(handlerPath, 'utf8');

const unsupportedModules = ['child_process', 'node:child_process', 'readline', 'node:readline'];
let patchCount = 0;

for (const mod of unsupportedModules) {
  const before = src.length;
  src = src.replaceAll(`require("${mod}")`, '({})');
  src = src.replaceAll(`require('${mod}')`, '({})');
  const after = src.length;
  if (after !== before) patchCount++;
}

writeFileSync(handlerPath, src, 'utf8');
console.log(`[patch-worker-bundle] Patched ${patchCount} unsupported module(s): ${unsupportedModules.join(', ')}`);
