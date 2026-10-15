// MapLibre 6 loads its tile worker from a URL relative to its own module, which
// Turbopack doesn't emit. Serve a versioned copy from public/ and point setWorkerUrl at it.
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(
  readFileSync(fileURLToPath(import.meta.resolve('maplibre-gl/package.json')), 'utf8'),
);
const src = fileURLToPath(import.meta.resolve('maplibre-gl/dist/maplibre-gl-worker.mjs'));
const outDir = new URL('../public/vendor/', import.meta.url);
mkdirSync(outDir, { recursive: true });
copyFileSync(src, new URL(`maplibre-gl-worker-${pkg.version}.mjs`, outDir));
