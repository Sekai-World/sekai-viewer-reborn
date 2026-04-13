import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@hey-api/openapi-ts';

function parseArgs(argv) {
  const result = {
    input: '',
    output: './src'
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--input' || token === '-i') {
      result.input = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (token === '--output' || token === '-o') {
      result.output = argv[index + 1] ?? result.output;
      index += 1;
      continue;
    }
  }

  return result;
}

async function patchGeneratedFile(filePath, transform) {
  const source = await readFile(filePath, 'utf8');
  const updated = transform(source);

  if (updated !== source) {
    await writeFile(filePath, updated);
  }
}

async function normalizeGeneratedSdk(outputDir) {
  const normalizedOutputDir = resolve(outputDir);

  await patchGeneratedFile(resolve(normalizedOutputDir, 'client.gen.ts'), (source) =>
    source.replace(
      "baseUrl: 'http://localhost:8080/api/v1'",
      "baseUrl: '/api/v1'"
    )
  );

  await patchGeneratedFile(resolve(normalizedOutputDir, 'types.gen.ts'), (source) =>
    source.replace(
      "baseUrl: 'http://localhost:8080/api/v1' | (string & {});",
      'baseUrl: string;'
    )
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.input) {
    throw new Error('Missing required argument: --input <openapi-file-path-or-url>');
  }

  const normalizedOutput = args.output.replaceAll('\\', '/').toLowerCase();
  if (normalizedOutput.endsWith('/src') || normalizedOutput === 'src' || normalizedOutput === './src') {
    process.stdout.write(
      `Warning: generating into ${args.output} may overwrite existing SDK files in src/.\n`
    );
  }

  await createClient({
    input: args.input,
    output: args.output
  });

  await normalizeGeneratedSdk(args.output);

  process.stdout.write(`SDK generated from ${args.input} to ${args.output}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
