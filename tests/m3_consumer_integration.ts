import {mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, copyFileSync, lstatSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {tmpdir} from 'node:os'

const root = resolve(import.meta.dir, '..')
const {name, version} = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const tarballName = `${name}-${version}.tgz`
const temp = mkdtempSync(join(tmpdir(), 'textdiffnext-consumer-'))
const consumer = join(temp, 'consumer')
mkdirSync(consumer)

function run(cwd: string, executable: string, ...args: string[]) {
  const result = Bun.spawnSync({cmd: [executable, ...args], cwd, stdout: 'pipe', stderr: 'pipe'})
  const output = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr)
  if (result.exitCode !== 0) throw new Error(`${executable} ${args.join(' ')}: exit ${result.exitCode}\n${output}`)
  console.log(`${executable} ${args.join(' ')}: exit 0`)
  return output
}

try {
  if (process.env.TEXTDIFFNEXT_TARBALL) {
    copyFileSync(resolve(process.env.TEXTDIFFNEXT_TARBALL), join(temp, tarballName))
  } else {
    run(root, 'bun', 'run', 'build')
    run(root, 'bun', 'pm', 'pack', '--dry-run', '--ignore-scripts')
    run(root, 'bun', 'pm', 'pack', '--destination', temp, '--ignore-scripts')
  }
  const tarball = join(temp, tarballName)
  const listing = run(root, 'tar', '-tzf', tarball)
  for (const file of [
    'package/LICENSE', 'package/THIRD-PARTY-NOTICES.md', 'package/README.md', 'package/package.json',
    'package/dist/index.js', 'package/dist/index.cjs',
    'package/dist/types/index.d.ts', 'package/dist/types/diff/diff.d.ts',
  ]) {
    if (!listing.split('\n').includes(file)) throw new Error(`tarball is missing ${file}`)
  }
  if (listing.split('\n').some((file) => /^package\/(src|tests|upstream-snapshots|node_modules)\//.test(file))) {
    throw new Error('tarball contains development-only files')
  }
  const metadata = JSON.parse(run(root, 'tar', '-xOf', tarball, 'package/package.json'))
  if (metadata.license !== 'Apache-2.0' || metadata.private || Object.keys(metadata.dependencies ?? {}).length) {
    throw new Error('tarball license, public policy, or runtime dependency mismatch')
  }
  const license = run(root, 'tar', '-xOf', tarball, 'package/LICENSE')
  if (license !== readFileSync(join(root, 'LICENSE'), 'utf8')) throw new Error('tarball license differs from root LICENSE')
  if (!run(root, 'tar', '-xOf', tarball, 'package/THIRD-PARTY-NOTICES.md').includes('Copyright 2018 The diff-match-patch Authors.')) {
    throw new Error('tarball is missing upstream attribution')
  }
  for (const format of ['index.js', 'index.cjs']) {
    if (!run(root, 'tar', '-xOf', tarball, `package/dist/${format}`).includes('Copyright 2018 The diff-match-patch Authors.')) {
      throw new Error(`${format} is missing upstream attribution banner`)
    }
  }
  console.log('Tarball license, notices, metadata, bundles and development-file exclusions OK')
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({name: 'textdiffnext-consumer', type: 'module', private: true,
    dependencies: {textdiffnext: `file:${tarball}`}}, null, 2))
  run(consumer, 'bun', 'install', '--offline', '--ignore-scripts')
  if (lstatSync(join(consumer, 'node_modules/textdiffnext')).isSymbolicLink()) {
    throw new Error('consumer package is a symlink')
  }
  const esm = `import {makeDiff, makePatches, stringifyPatches, parsePatch, applyPatches} from 'textdiffnext';
const source = 'a👩‍🚀%uD800';
const target = 'a👩‍🚀%uD800\\uD800';
if (!Array.isArray(makeDiff(source, target))) throw new Error('makeDiff missing');
const [actual, flags] = applyPatches(parsePatch(stringifyPatches(makePatches(source, target))), source);
if (actual !== target || !flags.every(Boolean)) throw new Error('ESM round-trip failed');
console.log('ESM exact reconstruction OK');
`
  const cjs = `const {makeDiff, makePatches, stringifyPatches, parsePatch, applyPatches} = require('textdiffnext');
const source = 'a\\uD800';
const target = 'a\\uD800🌍';
if (!Array.isArray(makeDiff(source, target))) throw new Error('makeDiff missing');
const [actual, flags] = applyPatches(parsePatch(stringifyPatches(makePatches(source, target))), source);
if (actual !== target || !flags.every(Boolean)) throw new Error('CJS round-trip failed');
console.log('CJS exact reconstruction OK');
`
  writeFileSync(join(consumer, 'consumer.mjs'), esm)
  writeFileSync(join(consumer, 'consumer.cjs'), cjs)
  const typings = `import {makeDiff, makePatches, applyPatches, type Diff, type Patch, type MakePatchOptions} from 'textdiffnext';
const input: string = 'a';
const options: Partial<MakePatchOptions> = {margin: 4};
const patches: Patch[] = makePatches(input, 'b', options);
const diffs: Diff[] = makeDiff(input, 'b');
const output: string = applyPatches(patches, input)[0];
void diffs; void output;
`
  writeFileSync(join(consumer, 'consumer.mts'), typings)
  const cjsTypes = `import pkg = require('textdiffnext');
const patches: pkg.Patch[] = pkg.makePatches('a', 'b');
const result: string = pkg.applyPatches(patches, 'a')[0];
void result;
`
  writeFileSync(join(consumer, 'consumer.cts'), cjsTypes)
  for (const runtime of ['bun', 'node']) {
    run(consumer, runtime, 'consumer.mjs')
    run(consumer, runtime, 'consumer.cjs')
  }
  run(consumer, 'bun', join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--module', 'nodenext',
    '--moduleResolution', 'nodenext', '--target', 'ES2022', '--strict', 'consumer.mts', 'consumer.cts')
  console.log('M3 consumer integration PASS')
} finally {
  rmSync(temp, {recursive: true, force: true})
}
