'use strict';

/**
 * @fileoverview Web font analyzer — detect formats, extract unicode ranges, suggest optimizations.
 * @module fontsubset
 * @author idirdev
 */

const fs = require('fs');
const path = require('path');

/** @type {Object.<string, string>} Map file extension to format name. */
const EXT_FORMAT = {
  '.woff2': 'WOFF2',
  '.woff':  'WOFF',
  '.ttf':   'TrueType',
  '.otf':   'OpenType',
  '.eot':   'EOT',
};

/** Font file extensions this tool recognizes. */
const FONT_EXTS = new Set(Object.keys(EXT_FORMAT));

/**
 * Validate a font buffer by inspecting its magic bytes.
 *
 * @param {Buffer} buf - File contents.
 * @param {string} ext - Lowercase file extension (e.g. '.ttf').
 * @returns {boolean} Whether the magic bytes match the expected format.
 */
function validateMagic(buf, ext) {
  if (buf.length < 4) return false;
  switch (ext) {
    case '.ttf': return buf.readUInt32BE(0) === 0x00010000;
    case '.otf': return buf.readUInt32BE(0) === 0x4F54544F; // 'OTTO'
    case '.woff': {
      const sig = buf.slice(0, 4).toString('ascii');
      return sig === 'wOFF';
    }
    case '.woff2': {
      const sig = buf.slice(0, 4).toString('ascii');
      return sig === 'wOF2';
    }
    case '.eot': return true; // EOT has no consistent magic
    default: return false;
  }
}

/**
 * Analyze a single font file.
 *
 * @param {string} filePath - Absolute or relative path to the font file.
 * @returns {{ file: string, path: string, format: string, size: number, sizeStr: string, valid: boolean }}
 */
function analyzeFontFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const format = EXT_FORMAT[ext] || 'Unknown';
  const stat = fs.statSync(filePath);
  const buf = fs.readFileSync(filePath);
  const valid = validateMagic(buf, ext);

  return {
    file: path.basename(filePath),
    path: filePath,
    format,
    size: stat.size,
    sizeStr: formatSize(stat.size),
    valid,
  };
}

/**
 * Recursively find all font files in a directory.
 *
 * @param {string} dir - Directory to walk.
 * @returns {object[]} Array of objects from {@link analyzeFontFile}.
 */
function findFonts(dir) {
  const results = [];

  function walk(d) {
    let entries;
    try { entries = fs.readdirSync(d); } catch { return; }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.git') continue;
      const fp = path.join(d, entry);
      let st;
      try { st = fs.statSync(fp); } catch { continue; }
      if (st.isDirectory()) {
        walk(fp);
      } else if (FONT_EXTS.has(path.extname(entry).toLowerCase())) {
        try { results.push(analyzeFontFile(fp)); } catch { /* skip unreadable */ }
      }
    }
  }

  walk(dir);
  return results;
}

/**
 * Parse unicode-range declarations from CSS and return the set of code points referenced.
 *
 * @param {string} cssContent - Raw CSS text (may contain @font-face blocks).
 * @returns {Set<number>} Set of Unicode code points.
 */
function extractUsedChars(cssContent) {
  if (typeof cssContent !== 'string') throw new TypeError('cssContent must be a string');
  const codePoints = new Set();
  const rangeDecls = cssContent.match(/unicode-range\s*:\s*([^;]+)/gi) || [];

  for (const decl of rangeDecls) {
    const value = decl.replace(/unicode-range\s*:\s*/i, '').trim();
    for (const segment of value.split(',')) {
      const s = segment.trim();
      // Match U+XXXX or U+XXXX-XXXX
      const m = s.match(/U\+([0-9A-Fa-f]+)(?:-([0-9A-Fa-f]+))?/i);
      if (!m) continue;
      const start = parseInt(m[1], 16);
      const end = m[2] ? parseInt(m[2], 16) : start;
      for (let cp = start; cp <= end && cp <= 0x10FFFF; cp++) {
        codePoints.add(cp);
      }
    }
  }

  return codePoints;
}

/**
 * Estimate WOFF2 conversion savings for a list of analyzed fonts.
 *
 * Fonts already in WOFF2 format are assumed to have no savings.
 * Other formats are estimated to save ~30 % after conversion.
 *
 * @param {object[]} fonts - Array from {@link findFonts} or {@link analyzeFontFile}.
 * @returns {object[]} Same array with added suggestedFormat, potentialSavings, savingsStr.
 */
function suggestSubset(fonts) {
  return fonts.map(f => {
    const savings = f.format === 'WOFF2' ? 0 : Math.round(f.size * 0.3);
    return {
      ...f,
      suggestedFormat: 'WOFF2',
      potentialSavings: savings,
      savingsStr: formatSize(savings),
    };
  });
}

/**
 * Format a byte count as a human-readable string.
 *
 * @param {number} bytes - Number of bytes.
 * @returns {string} Human-readable size string.
 */
function formatSize(bytes) {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / 1048576).toFixed(2) + 'MB';
}

/**
 * Format a detailed report for a list of analyzed font files.
 *
 * @param {object[]} fonts - Array from {@link findFonts}.
 * @returns {string} Human-readable report.
 */
function formatReport(fonts) {
  if (!fonts.length) return 'No font files found.';
  const lines = [
    `Font Analysis Report`,
    `====================`,
    `Found ${fonts.length} font file(s):`,
    '',
  ];
  for (const f of fonts) {
    lines.push(`  ${f.file}`);
    lines.push(`    Format : ${f.format}`);
    lines.push(`    Size   : ${f.sizeStr}`);
    lines.push(`    Valid  : ${f.valid ? 'yes' : 'no'}`);
  }
  return lines.join('\n');
}

/**
 * Produce a one-line summary of the font list.
 *
 * @param {object[]} fonts - Array from {@link findFonts}.
 * @returns {string} Single-line summary.
 */
function summary(fonts) {
  if (!fonts.length) return 'No fonts found.';
  const totalSize = fonts.reduce((acc, f) => acc + f.size, 0);
  const formats = [...new Set(fonts.map(f => f.format))].join(', ');
  return `${fonts.length} font(s), ${formatSize(totalSize)} total, formats: ${formats}`;
}

module.exports = {
  analyzeFontFile,
  findFonts,
  extractUsedChars,
  suggestSubset,
  formatSize,
  formatReport,
  summary,
};
