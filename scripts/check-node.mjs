// Fails fast with a clear message when the shell's Node is older than the project's.
// Node 23 crashes the API with ERR_REQUIRE_CYCLE_MODULE; .nvmrc pins the right version.
import { readFileSync } from 'node:fs';

const wanted = readFileSync(new URL('../.nvmrc', import.meta.url), 'utf8').trim();
const major = (v) => Number(v.replace(/^v/, '').split('.')[0]);

if (major(process.version) < major(wanted)) {
  console.error(
    `\nHouseFull needs Node ${wanted}; this shell has ${process.version} (${process.execPath}).\n` +
      'Run `nvm use` in the repo (it reads .nvmrc), then `pnpm dev` again.\n' +
      `To make it the default: \`nvm alias default ${wanted}\`.\n`,
  );
  process.exit(1);
}
