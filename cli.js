#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { platform } from 'node:os';

const HELP = `
killport — kill whatever's running on a port

Usage:
  killport <port>       Kill process on port
  killport <port> -s    Kill with SIGKILL (force)
  killport <port> -l    Just list what's on the port (don't kill)
  killport scan         Scan common ports for listeners
  killport scan -a      Scan all ports (1-65535, slower)

Options:
  -s, --signal <sig>    Signal to send (default: SIGTERM)
  -l, --list            List only, don't kill
  -f, --force           Alias for -s SIGKILL
  -j, --json            JSON output
  --help                Show this help
`;

function parseArgs(args) {
  const opts = { signal: 'SIGTERM', list: false, json: false, scan: false, allPorts: false, port: null };
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--help') { console.log(HELP); process.exit(0); }
    else if (a === '-l' || a === '--list') opts.list = true;
    else if (a === '-f' || a === '--force') opts.signal = 'SIGKILL';
    else if (a === '-s' || a === '--signal') { opts.signal = args[++i]; }
    else if (a === '-j' || a === '--json') opts.json = true;
    else if (a === 'scan') opts.scan = true;
    else if (a === '-a' || a === '--all') opts.allPorts = true;
    else if (!a.startsWith('-')) rest.push(a);
  }
  if (!opts.scan && rest.length > 0) {
    const p = parseInt(rest[0], 10);
    if (isNaN(p) || p < 1 || p > 65535) {
      console.error(`invalid port: ${rest[0]}`);
      process.exit(2);
    }
    opts.port = p;
  }
  if (!opts.scan && opts.port === null) {
    console.error('specify a port or use "scan"');
    console.log(HELP);
    process.exit(2);
  }
  return opts;
}

function findOnPort(port) {
  const sys = platform();
  try {
    let out;
    if (sys === 'win32') {
      out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf8' });
      const match = out.trim().split(/\s+/);
      const pid = parseInt(match[match.length - 1], 10);
      if (isNaN(pid)) return null;
      try {
        const info = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, { encoding: 'utf8' });
        const parts = info.trim().replace(/"/g, '').split(',');
        return { pid, name: parts[0] || 'unknown', port, proto: 'tcp' };
      } catch { return { pid, name: 'unknown', port, proto: 'tcp' }; }
    } else {
      out = execSync(`lsof -i :${port} -P -n -sTCP:LISTEN 2>/dev/null || true`, { encoding: 'utf8' });
      if (!out.trim()) return null;
      const lines = out.trim().split('\n');
      const results = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(/\s+/);
        if (parts.length < 2) continue;
        results.push({ pid: parseInt(parts[1], 10), name: parts[0], port, proto: 'tcp' });
      }
      return results.length > 0 ? results : null;
    }
  } catch { return null; }
}

function scanPorts(range) {
  const sys = platform();
  const results = [];
  if (sys === 'win32') {
    try {
      const out = execSync('netstat -ano | findstr LISTENING', { encoding: 'utf8' });
      for (const line of out.trim().split('\n')) {
        const parts = line.trim().split(/\s+/);
        const addr = parts[1] || '';
        const p = parseInt(addr.split(':').pop(), 10);
        const pid = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(p) && !isNaN(pid) && (range === 'all' || p <= 1024 || [3000,4000,5000,8000,8080,8443,8888,9000,9090,3306,5432,6379,27017].includes(p))) {
          results.push({ port: p, pid, name: 'unknown' });
        }
      }
    } catch {}
  } else {
    const portList = range === 'all' ? '' : 'i :1-1024,:3000,:4000,:5000,:8000-8080,:8443,:8888,:9000-9090,:3306,:5432,:6379,:27017';
    try {
      const out = execSync(`lsof -P -n -sTCP:LISTEN ${portList} 2>/dev/null || true`, { encoding: 'utf8' });
      for (const line of out.trim().split('\n').slice(1)) {
        const parts = line.split(/\s+/);
        if (parts.length < 9) continue;
        const addr = parts[8] || '';
        const p = parseInt(addr.split(':').pop(), 10);
        if (!isNaN(p)) results.push({ port: p, pid: parseInt(parts[1], 10), name: parts[0] });
      }
    } catch {}
  }
  // deduplicate by port
  const seen = new Set();
  return results.filter(r => {
    const key = `${r.port}-${r.pid}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.port - b.port);
}

function killProcess(pid, signal) {
  const sys = platform();
  try {
    if (sys === 'win32') {
      execSync(`taskkill /PID ${pid} /F`, { encoding: 'utf8' });
    } else {
      process.kill(pid, signal);
    }
    return true;
  } catch { return false; }
}

function formatResult(procs, port, json) {
  if (!procs) {
    if (json) return JSON.stringify({ port, listening: false });
    return `nothing listening on port ${port}`;
  }
  const arr = Array.isArray(procs) ? procs : [procs];
  if (json) return JSON.stringify({ port, listening: true, processes: arr });
  return arr.map(p => `port ${port} → pid ${p.pid} (${p.name})`).join('\n');
}

// Main
const opts = parseArgs(process.argv.slice(2));

if (opts.scan) {
  const results = scanPorts(opts.allPorts ? 'all' : 'common');
  if (opts.json) {
    console.log(JSON.stringify({ ports: results }));
  } else if (results.length === 0) {
    console.log('no listeners found');
  } else {
    for (const r of results) {
      console.log(`  ${String(r.port).padStart(5)}  pid ${String(r.pid).padStart(6)}  ${r.name}`);
    }
    console.log(`\n${results.length} listener${results.length > 1 ? 's' : ''} found`);
  }
  process.exit(0);
}

const procs = findOnPort(opts.port);
if (!procs) {
  console.log(formatResult(null, opts.port, opts.json));
  process.exit(0);
}

if (opts.list) {
  console.log(formatResult(procs, opts.port, opts.json));
  process.exit(0);
}

// Kill
const arr = Array.isArray(procs) ? procs : [procs];
let killed = 0;
for (const p of arr) {
  if (killProcess(p.pid, opts.signal)) {
    if (opts.json) killed++;
    else console.log(`killed pid ${p.pid} (${p.name}) on port ${opts.port} [${opts.signal}]`);
  } else {
    if (!opts.json) console.error(`failed to kill pid ${p.pid} — try killport ${opts.port} -f`);
  }
}
if (opts.json) console.log(JSON.stringify({ port: opts.port, killed, total: arr.length }));
process.exit(arr.length > 0 ? 0 : 1);
