# fontsubset

> **[EN]** Audit font files in your project — detect formats, report file sizes, validate TTF/OTF magic bytes, extract unicode ranges from CSS, and suggest WOFF2 conversion savings.
> **[FR]** Auditez les polices de votre projet — détectez les formats, rapportez les tailles, validez les magic bytes TTF/OTF, extrayez les plages unicode depuis le CSS et suggérez les économies de conversion en WOFF2.

---

## Features / Fonctionnalités

**[EN]**
- Recursively finds all font files: `.woff2`, `.woff`, `.ttf`, `.otf`, `.eot`
- Reports format name, file size (human-readable), and basic validity check
- Validates TTF/OTF files by reading the magic bytes header (`0x00010000` / `0x4F54544F`)
- Extracts `unicode-range` declarations from CSS content to map used character sets
- Suggests conversion to WOFF2 and estimates potential file size savings (~30%)
- Outputs human-readable table or full JSON with `--json`
- Zero external dependencies — pure Node.js fs reads

**[FR]**
- Trouve récursivement tous les fichiers de polices : `.woff2`, `.woff`, `.ttf`, `.otf`, `.eot`
- Rapporte le nom du format, la taille du fichier (lisible) et une vérification de base
- Valide les fichiers TTF/OTF en lisant l'en-tête des magic bytes (`0x00010000` / `0x4F54544F`)
- Extrait les déclarations `unicode-range` du contenu CSS pour cartographier les jeux de caractères utilisés
- Suggère la conversion en WOFF2 et estime les économies potentielles de taille (~30%)
- Sortie lisible ou JSON complet avec `--json`
- Aucune dépendance externe — lectures fs Node.js pures

---

## Installation

```bash
npm install -g @idirdev/fontsubset
```

---

## CLI Usage / Utilisation CLI

```bash
# Scan current directory for fonts (scanner le répertoire courant pour les polices)
fontsubset

# Scan a specific directory (scanner un répertoire spécifique)
fontsubset ./public/fonts

# Output full JSON report (sortie JSON complète)
fontsubset ./assets --json

# Show help (afficher l'aide)
fontsubset --help
```

### Example Output / Exemple de sortie

```
$ fontsubset ./public/fonts
5 font(s) found:
  Inter-Regular.ttf (TrueType, 312.4KB)
  Inter-Bold.ttf (TrueType, 318.1KB)
  Inter-Regular.woff2 (WOFF2, 89.2KB)
  icons.woff (WOFF, 42.8KB)
  legacy.eot (EOT, 156.0KB)

Potential savings: 157.8KB
```

---

## API (Programmatic) / API (Programmation)

```js
const { analyzeFontFile, findFonts, extractUsedChars, suggestSubset, formatSize } = require('@idirdev/fontsubset');

// Analyze a single font file (analyser un fichier de police unique)
const info = analyzeFontFile('./public/fonts/Inter-Regular.ttf');
console.log(info.format);   // 'TrueType'
console.log(info.sizeStr);  // '312.4KB'
console.log(info.valid);    // true (magic bytes OK)

// Find all fonts in a directory tree (trouver toutes les polices dans un arbre de répertoires)
const fonts = findFonts('./public');
fonts.forEach(f => console.log(f.file, f.format, f.sizeStr));

// Extract used unicode characters from a CSS file (extraire les caractères unicode utilisés depuis un CSS)
const css = require('fs').readFileSync('./src/fonts.css', 'utf8');
const usedChars = extractUsedChars(css);
console.log(usedChars.size); // number of codepoints used

// Get WOFF2 conversion suggestions with savings estimates (suggestions de conversion WOFF2 avec économies)
const suggestions = suggestSubset(fonts);
suggestions.forEach(s => {
  if (s.potentialSavings > 0) {
    console.log(`Convert ${s.file} to WOFF2 → save ~${s.savingsStr}`);
  }
});

// Human-readable size formatting (formatage lisible des tailles)
console.log(formatSize(328172)); // '320.5KB'
```

---

## License

MIT © idirdev
