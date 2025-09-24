#!/usr/bin/env node

import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import process from 'process';

// ---------- Configuration ----------
let MIN_NODE_MAJOR = Number(process.env.MIN_NODE_MAJOR ?? 20);
let REQUIRED_TOOLS = (process.env.REQUIRED_TOOLS ?? 'ffmpeg').split(',').map(s => s.trim()).filter(Boolean);
let INDEX_FILE = process.env.INDEX_FILE ?? 'index.js';

// ---------- ANSI helpers (no deps) ----------
let ANSI = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  dim: '\u001b[2m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  cyan: '\u001b[36m',
};

let timeStamp = () => new Date().toISOString();
let pad = (s, n = 12) => String(s).padEnd(n);

let log = {
  info: msg => console.log(`${ANSI.cyan}[${timeStamp()}]${ANSI.reset} ${pad('INFO')} ${msg}`),
  ok: msg => console.log(`${ANSI.green}[${timeStamp()}]${ANSI.reset} ${pad('OK')}   ${msg}`),
  warn: msg => console.log(`${ANSI.yellow}[${timeStamp()}]${ANSI.reset} ${pad('WARN')} ${msg}`),
  error: msg => console.error(`${ANSI.red}[${timeStamp()}]${ANSI.reset} ${pad('ERR')}  ${msg}`),
};

// ---------- Checks ----------
let getNodeMajor = () => Number(process.versions.node.split('.')[0]);

let checkNodeVersion = () => {
  let major = getNodeMajor();
  let ok = major >= MIN_NODE_MAJOR;
  return {
    name: `node (v${major})`,
    ok,
    detail: ok ? `>= ${MIN_NODE_MAJOR}` : `< ${MIN_NODE_MAJOR}`
  };
};

let checkTool = (tool) => {
  try {
    execSync(`${tool} -version`, { stdio: 'ignore' });
    return { name: tool, ok: true, detail: 'found' };
  } catch {
    try {
      execSync(`${tool} --version`, { stdio: 'ignore' });
      return { name: tool, ok: true, detail: 'found' };
    } catch {
      return { name: tool, ok: false, detail: 'not found' };
    }
  }
};

// ---------- Summary & Runner ----------
const printSummary = (results) => {
  console.log('\n' + ANSI.bold + 'Environment check summary' + ANSI.reset);
  console.log('-'.repeat(48));
  results.forEach(r => {
    const status = r.ok ? `${ANSI.green}PASS${ANSI.reset}` : `${ANSI.red}FAIL${ANSI.reset}`;
    console.log(`${pad(status, 6)}  ${pad(r.name, 20)}  ${r.detail}`);
  });
  console.log('-'.repeat(48) + '\n');
};

let runIndex = () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const indexPath = join(__dirname, INDEX_FILE);

  log.info(`Launching '${INDEX_FILE}'`);
  const child = spawn(process.execPath, [indexPath], { stdio: 'inherit' });

  child.on('exit', (code, signal) => {
    if (signal) log.warn(`Process terminated with signal ${signal}`);
    else log.info(`Process exited with code ${code}`);
    process.exit(code ?? 0);
  });

  child.on('error', (err) => {
    log.error(`Failed to start ${INDEX_FILE}: ${err.message}`);
    process.exit(1);
  });
};

// ---------- Main ----------
const main = () => {
  log.info('Starting environment checks');

  const results = [];
  results.push(checkNodeVersion());
  REQUIRED_TOOLS.forEach(t => results.push(checkTool(t)));

  printSummary(results);

  const failed = results.filter(r => !r.ok);
  if (failed.length > 0) {
    log.error(`Environment not satisfied. ${failed.length} check(s) failed.`);
    failed.forEach(f => log.error(` - ${f.name}: ${f.detail}`));
    process.exit(1);
  }

  log.ok('All checks passed.');
  runIndex();
};

main();