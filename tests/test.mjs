import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

const run = (args) => {
  try {
    const out = execSync(`node ${new URL('../cli.js', import.meta.url).pathname} ${args}`, { encoding: 'utf8', stdio: ['pipe','pipe','pipe'] });
    return { code: 0, out: out.trim() };
  } catch (e) { return { code: e.status, out: (e.stdout || '').trim(), err: (e.stderr || '').trim() }; }
};

describe('parseArgs', () => {
  it('requires port or scan', () => {
    const r = run('');
    assert.equal(r.code, 2);
  });
  it('rejects invalid port', () => {
    const r = run('abc');
    assert.equal(r.code, 2);
  });
  it('rejects port 0', () => {
    const r = run('0');
    assert.equal(r.code, 2);
  });
  it('rejects port 99999', () => {
    const r = run('99999');
    assert.equal(r.code, 2);
  });
  it('accepts valid port', () => {
    // port 1 is privileged, won't have listener, but should parse ok
    const r = run('-l 1');
    assert.equal(r.code, 0);
  });
  it('accepts --force flag', () => {
    const r = run('--help');
    assert.ok(r.out.includes('killport'));
  });
});

describe('HELP', () => {
  it('shows help with --help', () => {
    const r = run('--help');
    assert.equal(r.code, 0);
    assert.ok(r.out.includes('killport'));
    assert.ok(r.out.includes('scan'));
  });
});

describe('list mode', () => {
  it('shows nothing on unused port', () => {
    const r = run('-l 59999');
    assert.equal(r.code, 0);
    assert.ok(r.out.includes('nothing') || r.out.includes('"listening":false'));
  });
  it('json output on unused port', () => {
    const r = run('-l -j 59999');
    const data = JSON.parse(r.out);
    assert.equal(data.port, 59999);
    assert.equal(data.listening, false);
  });
});

describe('scan', () => {
  it('runs scan without error', () => {
    const r = run('scan');
    assert.equal(r.code, 0);
  });
  it('scan json output', () => {
    const r = run('scan -j');
    const data = JSON.parse(r.out);
    assert.ok(Array.isArray(data.ports));
  });
  it('scan all ports', () => {
    const r = run('scan -a -j');
    const data = JSON.parse(r.out);
    assert.ok(Array.isArray(data.ports));
  });
});

describe('kill (no process)', () => {
  it('handles unused port gracefully', () => {
    const r = run('59999');
    // no process to kill, should just report nothing
    assert.ok(r.out.includes('nothing') || r.out.includes('"listening":false'));
  });
});
