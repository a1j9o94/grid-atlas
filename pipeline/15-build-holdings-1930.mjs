// One command reproduces the whole thing. The image and projection work lives in Python
// next door, because that is where the FFT and morphology tooling is.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const r = spawnSync('python3', [join(here, '15-build-holdings-1930.py'), ...process.argv.slice(2)],
                    { stdio: 'inherit', cwd: here });
process.exit(r.status ?? 1);
