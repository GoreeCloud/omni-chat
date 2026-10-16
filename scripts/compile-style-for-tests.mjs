import { resolve } from 'node:path';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';

/**
 * Compile Tailwind in an ordinary Node process rather than Jest's sandbox:
 * current Tailwind releases install process-wide ESM loader hooks that Jest
 * intentionally refuses to install inside individual test workers.
 */
const source = [];
for await (const chunk of process.stdin) source.push(chunk);
const input = Buffer.concat(source).toString('utf8');
const result = await postcss([tailwindcss({ base: resolve('src') })]).process(input, {
  from: resolve('src/style.css'),
});
process.stdout.write(result.css);
