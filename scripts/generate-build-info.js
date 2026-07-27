const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const clientDirectory = path.resolve(__dirname, '..');
const projectDirectory = path.resolve(clientDirectory, '..');
const outputFile = path.join(
  clientDirectory,
  'public',
  'assets',
  'build-info.json'
);

function runGit(argumentsList) {
  try {
    return execFileSync('git', argumentsList, {
      cwd: projectDirectory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return '';
  }
}

function removeTagPrefix(tag) {
  return tag.startsWith('v') ? tag.substring(1) : tag;
}

function findExactReleaseVersion() {
  return removeTagPrefix(
    runGit([
      'describe',
      '--tags',
      '--exact-match',
      '--match',
      'v[0-9]*.[0-9]*.[0-9]*'
    ])
  );
}

function findLatestReleaseVersion() {
  return removeTagPrefix(
    runGit([
      'describe',
      '--tags',
      '--match',
      'v[0-9]*.[0-9]*.[0-9]*',
      '--abbrev=0'
    ])
  );
}

function isWorkingTreeDirty() {
  return runGit(['status', '--porcelain']) !== '';
}

function nextPatchVersion(version) {
  if (!version) {
    return '0.0.1';
  }

  const parts = version.split('.');

  if (
    parts.length !== 3 ||
    parts.some(part => !/^\d+$/.test(part))
  ) {
    throw new Error(`Unexpected release version: ${version}`);
  }

  const [major, minor, patch] = parts.map(Number);

  return `${major}.${minor}.${patch + 1}`;
}

function calculateVersion() {
  if (process.env.VERSION) {
    return process.env.VERSION;
  }

  const exactReleaseVersion = findExactReleaseVersion();

  if (exactReleaseVersion && !isWorkingTreeDirty()) {
    return exactReleaseVersion;
  }

  const baseVersion = nextPatchVersion(
    findLatestReleaseVersion()
  );

  if (
    process.env.BUILD_ID &&
    process.env.BUILD_ID !== '(none)'
  ) {
    return `${baseVersion}-build-${process.env.BUILD_ID}`;
  }

  return `${baseVersion}-SNAPSHOT`;
}

function environmentOrGit(
  environmentName,
  gitArguments,
  fallback = '(none)'
) {
  return (
    process.env[environmentName] ||
    runGit(gitArguments) ||
    fallback
  );
}

const buildInfo = {
  name: 'diaries-client',
  version: calculateVersion(),
  buildID: process.env.BUILD_ID || '(none)',
  builddate:
    process.env.BUILD_DATE ||
    new Date().toISOString(),
  gitCommit: environmentOrGit(
    'GIT_COMMIT',
    ['rev-parse', 'HEAD']
  ),
  gitBranch: environmentOrGit(
    'GIT_BRANCH',
    ['rev-parse', '--abbrev-ref', 'HEAD']
  ),
  gitURL: environmentOrGit(
    'GIT_URL',
    ['config', '--get', 'remote.origin.url']
  )
};

fs.mkdirSync(path.dirname(outputFile), {
  recursive: true
});

fs.writeFileSync(
  outputFile,
  `${JSON.stringify(buildInfo, null, 2)}\n`,
  'utf8'
);

console.log(
  `Generated client build information: ${outputFile}`
);
console.log(`Client version: ${buildInfo.version}`);
