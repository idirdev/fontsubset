#!/usr/bin/env node
'use strict';

/**
 * @fileoverview CLI for fontsubset — analyze web fonts and suggest optimization.
 * @author idirdev
 * @usage fontsubset <dir> [--css file.css] [--json] [--suggest]
 */

const fs = require('fs');
const m = require('../src/index');

const args = process.argv.slice(2);

if (args.includes('--help') || args.length === 0) {
  console.log([
    'Usage: fontsubset <dir> [options]',
    '',
    'Options:',
    '  --css <file>  CSS file to extract unicode-range declarations from',
    '  --suggest     Show WOFF2 conversion suggestions',
    '  --json        Output results as JSON',
    '  --help        Show this help message',
  ].join('\n'));
  process.exit(0);
}

const target = args.find(a => !a.startsWith('-')) || '.';
const showJson = args.includes('--json');
const showSuggest = args.includes('--suggest');

const cssIdx = args.indexOf('--css');
const cssFile = cssIdx >= 0 ? args[cssIdx + 1] : null;

let stat;
try { stat = fs.statSync(target); } catch {
  console.error('Error: cannot access ' + target);
  process.exit(1);
}

const fonts = m.findFonts(target);

if (!fonts.length) {
  console.log('No font files found in: ' + target);
  process.exit(0);
}

if (cssFile) {
  try {
    const css = fs.readFileSync(cssFile, 'utf8');
    const chars = m.extractUsedChars(css);
    if (!showJson) {
      console.log(`Unicode ranges cover ${chars.size} code point(s).`);
    }
  } catch {
    console.error('Warning: could not read CSS file: ' + cssFile);
  }
}

const results = showSuggest ? m.suggestSubset(fonts) : fonts;

if (showJson) {
  console.log(JSON.stringify(results, null, 2));
} else {
  console.log(m.formatReport(fonts));
  if (showSuggest) {
    const totalSavings = results.reduce((acc, f) => acc + (f.potentialSavings || 0), 0);
    console.log('\nWOFF2 conversion savings estimate: ' + m.formatSize(totalSavings));
  }
  console.log('\n' + m.summary(fonts));
}
