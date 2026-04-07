import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const baseSha = process.env.GIT_BASE_SHA;
const headSha = process.env.GIT_HEAD_SHA || "HEAD";
const githubRepository = process.env.GITHUB_REPOSITORY;
const githubToken = process.env.GITHUB_TOKEN;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    ...options
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    throw new Error(stderr || stdout || `${command} ${args.join(" ")} failed`);
  }

  return result.stdout.trim();
}

function tryRun(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    ...options
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim()
  };
}

function resolveDiffRange() {
  if (baseSha && !/^0+$/.test(baseSha)) {
    return `${baseSha}..${headSha}`;
  }

  const hasParent = tryRun("git", ["rev-parse", "--verify", "HEAD^"]);

  if (hasParent.status === 0) {
    return `HEAD^..${headSha}`;
  }

  return null;
}

function getChangedPackageJsonPaths(diffRange) {
  if (!diffRange) {
    return [];
  }

  const output = run("git", [
    "diff",
    "--name-only",
    diffRange,
    "--",
    "apps/*/package.json",
    "packages/*/package.json"
  ]);

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
}

async function readWorkspacePackage(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  const raw = await readFile(filePath, "utf8");
  const pkg = JSON.parse(raw);

  if (!pkg.name || !pkg.version) {
    throw new Error(`Missing name/version in ${relativePath}`);
  }

  return {
    name: pkg.name,
    version: pkg.version
  };
}

function tagExists(tagName) {
  return tryRun("git", ["rev-parse", "-q", "--verify", `refs/tags/${tagName}`]).status === 0;
}

async function createGithubRelease(tagName) {
  if (!githubRepository || !githubToken) {
    return;
  }

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${githubToken}`,
    "X-GitHub-Api-Version": "2022-11-28"
  };

  const existing = await fetch(
    `https://api.github.com/repos/${githubRepository}/releases/tags/${encodeURIComponent(tagName)}`,
    { headers }
  );

  if (existing.status === 200) {
    return;
  }

  if (existing.status !== 404) {
    const body = await existing.text();
    throw new Error(`Failed to check GitHub release for ${tagName}: ${body}`);
  }

  const created = await fetch(`https://api.github.com/repos/${githubRepository}/releases`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      tag_name: tagName,
      name: tagName,
      generate_release_notes: true
    })
  });

  if (!created.ok) {
    const body = await created.text();
    throw new Error(`Failed to create GitHub release for ${tagName}: ${body}`);
  }
}

async function main() {
  const diffRange = resolveDiffRange();
  const changedPackageJsonPaths = getChangedPackageJsonPaths(diffRange);

  if (changedPackageJsonPaths.length === 0) {
    console.log("No versioned workspace changes detected.");
    return;
  }

  const releaseCandidates = [];

  for (const relativePath of changedPackageJsonPaths) {
    const workspacePackage = await readWorkspacePackage(relativePath);
    releaseCandidates.push({
      ...workspacePackage,
      tagName: `${workspacePackage.name}@${workspacePackage.version}`
    });
  }

  const tagsToPush = [];

  for (const candidate of releaseCandidates) {
    if (tagExists(candidate.tagName)) {
      continue;
    }

    run("git", ["tag", candidate.tagName]);
    tagsToPush.push(candidate.tagName);
  }

  if (tagsToPush.length > 0) {
    run("git", ["push", "origin", ...tagsToPush], { stdio: "inherit" });
  }

  for (const candidate of releaseCandidates) {
    await createGithubRelease(candidate.tagName);
  }

  console.log(
    JSON.stringify(
      {
        diffRange,
        released: releaseCandidates.map(({ name, version, tagName }) => ({
          name,
          version,
          tagName
        })),
        pushedTags: tagsToPush
      },
      null,
      2
    )
  );
}

await main();
