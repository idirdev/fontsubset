'use strict';

/**
 * @fileoverview Tests for fontsubset.
 * @author idirdev
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  formatSize,
  extractUsedChars,
  suggestSubset,
  findFonts,
  formatReport,
  summary,
} = require('../src/index');

// ── formatSize ────────────────────────────────────────────────────────────────

describe('formatSize', () => {
  it('formats byte values under 1 KB', () => {
    assert.equal(formatSize(500), '500B');
  });

  it('formats kilobyte values', () => {
    assert.ok(formatSize(2048).includes('KB'));
  });

  it('formats megabyte values', () => {
    assert.ok(formatSize(2 * 1048576).includes('MB'));
  });

  it('handles zero bytes', () => {
    assert.equal(formatSize(0), '0B');
  });
});

// ── extractUsedChars ──────────────────────────────────────────────────────────

describe('extractUsedChars', () => {
  it('parses a basic unicode-range declaration', () => {
    const chars = extractUsedChars('@font-face { unicode-range: U+0020-007F; }');
    assert.ok(chars.size > 0);
    // U+0041 = 'A', must be in the basic Latin range
    assert.ok(chars.has(0x41));
  });

  it('returns empty set when no unicode-range is present', () => {
    const chars = extractUsedChars('body { font-family: Arial; }');
    assert.equal(chars.size, 0);
  });

  it('handles a single code point (no range)', () => {
    const chars = extractUsedChars('unicode-range: U+0041;');
    assert.ok(chars.has(0x41));
    assert.equal(chars.size, 1);
  });

  it('handles multiple comma-separated ranges', () => {
    const chars = extractUsedChars('unicode-range: U+0041, U+0042;');
    assert.ok(chars.has(0x41));
    assert.ok(chars.has(0x42));
    assert.equal(chars.size, 2);
  });
});

// ── suggestSubset ─────────────────────────────────────────────────────────────

describe('suggestSubset', () => {
  it('suggests WOFF2 for TrueType fonts', () => {
    const r = suggestSubset([{ file: 'a.ttf', format: 'TrueType', size: 50000 }]);
    assert.equal(r[0].suggestedFormat, 'WOFF2');
    assert.ok(r[0].potentialSavings > 0);
  });

  it('reports zero savings for fonts already in WOFF2', () => {
    const r = suggestSubset([{ file: 'b.woff2', format: 'WOFF2', size: 30000 }]);
    assert.equal(r[0].potentialSavings, 0);
  });

  it('preserves original font properties', () => {
    const input = [{ file: 'c.woff', format: 'WOFF', size: 20000, sizeStr: '19.5KB' }];
    const r = suggestSubset(input);
    assert.equal(r[0].file, 'c.woff');
    assert.equal(r[0].sizeStr, '19.5KB');
  });

  it('estimates ~30% savings for non-WOFF2 fonts', () => {
    const size = 100000;
    const r = suggestSubset([{ file: 'x.ttf', format: 'TrueType', size }]);
    assert.equal(r[0].potentialSavings, Math.round(size * 0.3));
  });
});

// ── findFonts ─────────────────────────────────────────────────────────────────

describe('findFonts', () => {
  it('returns an array (possibly empty) for a temp directory', () => {
    const r = findFonts(os.tmpdir());
    assert.ok(Array.isArray(r));
  });

  it('finds a fake .woff2 file written to a temp dir', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fontsubset-test-'));
    const fakeFont = path.join(tmpDir, 'test.woff2');
    // Write wOF2 magic bytes followed by padding
    const buf = Buffer.alloc(16);
    buf.write('wOF2', 0, 'ascii');
    fs.writeFileSync(fakeFont, buf);
    try {
      const r = findFonts(tmpDir);
      assert.ok(r.length >= 1);
      assert.equal(r[0].format, 'WOFF2');
    } finally {
      fs.unlinkSync(fakeFont);
      fs.rmdirSync(tmpDir);
    }
  });
});

// ── formatReport ──────────────────────────────────────────────────────────────

describe('formatReport', () => {
  it('returns a no-fonts message for empty array', () => {
    assert.ok(formatReport([]).includes('No font files'));
  });

  it('includes file name and format in report', () => {
    const report = formatReport([{ file: 'font.ttf', format: 'TrueType', sizeStr: '48.8KB', valid: true }]);
    assert.ok(report.includes('font.ttf'));
    assert.ok(report.includes('TrueType'));
  });
});

// ── summary ───────────────────────────────────────────────────────────────────

describe('summary', () => {
  it('returns a message for empty font list', () => {
    assert.ok(summary([]).includes('No fonts'));
  });

  it('reports correct file count', () => {
    const fonts = [
      { file: 'a.ttf', format: 'TrueType', size: 40000 },
      { file: 'b.woff2', format: 'WOFF2', size: 20000 },
    ];
    const s = summary(fonts);
    assert.ok(s.includes('2 font'));
  });
});
