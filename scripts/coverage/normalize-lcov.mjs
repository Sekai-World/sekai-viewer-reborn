import fs from "node:fs/promises";
import path from "node:path";

const [reportPath, sourcePrefix] = process.argv.slice(2);

if (!reportPath || !sourcePrefix) {
  throw new Error("Usage: normalize-lcov.mjs <report-path> <source-prefix>");
}

const contents = await fs.readFile(reportPath, "utf8");
const normalized = contents.replace(/^SF:(?!\/)(.*)$/gm, (_, sourcePath) => {
  const repoPath = path.posix.join(sourcePrefix, sourcePath.replaceAll(path.sep, "/"));
  return `SF:${repoPath}`;
});

await fs.writeFile(reportPath, normalized);
