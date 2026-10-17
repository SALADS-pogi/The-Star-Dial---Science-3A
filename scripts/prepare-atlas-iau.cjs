/*
 * Refresh the factual IAU constellation metadata used by Star Atlas.
 * Usage: node scripts/prepare-atlas-iau.cjs [saved-iau-page.html] [--boundaries]
 * The optional local HTML lets the source be reviewed before extraction.
 * No download URL is constructed from an abbreviation: every chart and
 * boundary URL must occur in the source table.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const SOURCE_URL = 'https://www.iau.org/IAU/Astronomy-FAQs/Constellations.aspx';
const ARCHIVE_URL = 'https://iauarchive.eso.org/public/themes/constellations/';
const PRONUNCIATION_URL = 'https://skyandtelescope.org/astronomy-resources/constellation-names-and-abbreviations/';

function text(html) {
  const entities = {nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",ouml:'ö',rsquo:'’',lsquo:'‘',ndash:'–',mdash:'—'};
  return html.replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, code) => String.fromCodePoint(code[0].toLowerCase() === 'x' ? parseInt(code.slice(1),16) : +code))
    .replace(/&([a-z]+);/gi, (match, entity) => entities[entity] ?? match)
    .replace(/\s+/g, ' ').trim();
}
function links(html, extension) {
  return [...html.matchAll(/href=["']([^"']+)["']/gi)]
    .map(match => match[1])
    .filter(url => new RegExp(`\\.${extension}$`, 'i').test(url))
    .map(url => new URL(url, SOURCE_URL).href)
    .filter((url, index, all) => all.indexOf(url) === index);
}
function pronunciation(cell) {
  return text(cell.match(/<span[^>]+class=["']pronunciation["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || '')
    .replace(/\d+$/, '').replace(/-\s+/g, '-');
}

async function main() {
  const input = process.argv.slice(2).find(argument => !argument.startsWith('--'));
  const html = input ? fs.readFileSync(input, 'utf8') : await (await fetch(SOURCE_URL)).text();
  const constellations = {};
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(match => match[1]);
    if (cells.length !== 6 || !cells[2].includes('abbr-badge')) continue;
    const abbreviation = text(cells[2]);
    const name = text(cells[1].match(/<strong>([\s\S]*?)<\/strong>/i)?.[1] || '');
    const genitive = text(cells[4].replace(/<span[\s\S]*?<\/span>/gi, ''));
    const pdfUrls = links(cells[5], 'pdf');
    const gifUrls = links(cells[5], 'gif');
    const charts = pdfUrls.map((pdfUrl, index) => ({
      label: abbreviation === 'Ser' ? (index === 0 ? 'Serpens Caput (head)' : 'Serpens Cauda (tail)') : name,
      pdfUrl,
      gifUrl: gifUrls[index]
    }));
    const entry = {
      name,
      abbreviation,
      englishMeaning: text(cells[3]).replace(/^The Berenice's/, "Berenice's"),
      genitive,
      pronunciation: pronunciation(cells[1]),
      genitivePronunciation: pronunciation(cells[4]),
      charts,
      boundaryUrls: links(cells[5], 'txt'),
      sourceUrl: SOURCE_URL
    };
    // The IAU page has a malformed "SIG- SIG-nu" transcription. Its own
    // linked pronunciation reference supplies the complete form below.
    if (abbreviation === 'Cyg') {
      entry.pronunciation = 'SIG-nus';
      entry.pronunciationSourceUrl = PRONUNCIATION_URL;
    }
    if (abbreviation === 'CrA') entry.aliases = ['Corona Austrina'];
    if (!/^[A-Za-z]{3}$/.test(abbreviation) || constellations[abbreviation]) throw new Error(`Invalid or duplicate abbreviation: ${abbreviation}`);
    for (const field of ['name','englishMeaning','genitive','pronunciation','genitivePronunciation']) {
      if (!entry[field] || /[<>]|&[a-z]+;/.test(entry[field])) throw new Error(`Invalid ${abbreviation}.${field}: ${entry[field]}`);
    }
    const expected = abbreviation === 'Ser' ? 2 : 1;
    if (charts.length !== expected || entry.boundaryUrls.length !== expected || charts.some(chart => !chart.gifUrl)) throw new Error(`Incomplete chart/boundary links: ${abbreviation}`);
    constellations[abbreviation] = entry;
  }
  if (Object.keys(constellations).length !== 88) throw new Error(`Expected 88 constellations; parsed ${Object.keys(constellations).length}`);
  const atlas = {
    metadata: {
      title: 'IAU constellation reference data for Star Atlas',
      retrievedDate: '2026-10-15',
      sourceUrl: SOURCE_URL,
      archiveUrl: ARCHIVE_URL,
      pronunciationReferenceUrl: PRONUNCIATION_URL,
      chartEpoch: 'J2000',
      chartAttribution: 'IAU / Sky & Telescope. Charts by Roger Sinnott and Rick Fienberg; constellation line patterns by Alan MacRobert.',
      chartLicense: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
      chartLicenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      notes: [
        'Constellation names, abbreviations, English meanings, genitives and chart links were extracted from the current IAU table.',
        'Chart and boundary URLs are actual links in the IAU table; Serpens has separate head and tail charts.',
        'Pronunciations are guides, not a single mandatory pronunciation. Stray source footnote digits and line-break spaces were removed.',
        'The malformed IAU Cygnus pronunciation was corrected from the Sky & Telescope pronunciation reference linked by the IAU.',
        'The English label for Coma Berenices omits the extraneous article before Berenice’s Hair in the source table.',
        'Corona Australis follows the current IAU table; Corona Austrina is included as a search alias.',
        'The chart license applies to the linked chart images. Boundary files use J2000 right ascension and declination, as described by the IAU.'
      ]
    },
    constellations
  };
  const output = path.join(__dirname, '..', 'atlas-iau.json');
  fs.writeFileSync(output, JSON.stringify(atlas, null, 2) + '\n');
  console.log(`Wrote ${output}: 88 constellations, ${Object.values(constellations).reduce((count, item) => count + item.charts.length, 0)} chart pairs.`);
  if (process.argv.includes('--boundaries')) await prepareBoundaries(constellations);
}

async function prepareBoundaries(constellations) {
  const results = {};
  const entries = Object.entries(constellations);
  // Four concurrent downloads keep this small educational-data refresh polite.
  for (let offset = 0; offset < entries.length; offset += 4) {
    await Promise.all(entries.slice(offset, offset + 4).map(async ([abbreviation, entry]) => {
      const boundaries = [];
      for (const sourceUrl of entry.boundaryUrls) {
        const response = await fetch(sourceUrl, {signal: AbortSignal.timeout(25000)});
        if (!response.ok) throw new Error(`Boundary ${sourceUrl}: HTTP ${response.status}`);
        const raw = await response.text();
        const coordinates = [];
        for (const line of raw.trim().split(/\r?\n/)) {
          const match = line.match(/^\s*(\d+)\s+(\d+)\s+([\d.]+)\s*\|\s*([+\-]?[\d.]+)\s*\|\s*(\w+)/);
          if (!match) throw new Error(`Unrecognized ${abbreviation} boundary line: ${line}`);
          coordinates.push([+(+match[1] + +match[2]/60 + +match[3]/3600).toFixed(8), +match[4]]);
        }
        if (coordinates.length < 3) throw new Error(`Insufficient ${abbreviation} boundary vertices`);
        boundaries.push({sourceUrl, coordinates});
      }
      const declinations = boundaries.flatMap(boundary => boundary.coordinates.map(coordinate => coordinate[1]));
      const minDeclination = Math.min(...declinations);
      const maxDeclination = Math.max(...declinations);
      results[abbreviation] = {
        minDeclination,
        maxDeclination,
        region: minDeclination >= 0 ? 'Northern sky' : maxDeclination <= 0 ? 'Southern sky' : 'Crosses the celestial equator',
        boundaries
      };
    }));
    console.log(`Boundary downloads: ${Math.min(offset + 4, entries.length)}/88 constellations`);
  }
  const dataset = {
    metadata: {
      title: 'IAU J2000 constellation boundaries for Star Atlas',
      retrievedDate: '2026-10-15',
      sourceUrl: SOURCE_URL,
      coordinateFormat: '[rightAscensionHours, declinationDegrees]',
      epoch: 'J2000',
      method: 'Boundary coordinates are downloaded from the TXT links in the IAU table. Declination ranges are minima and maxima of the published boundary vertices. Northern/southern/equator regions are derived from these ranges.',
      visibilityMethod: 'At geographic latitude phi, a declination d can rise above an ideal unobstructed horizon when abs(phi-d) < 90 degrees. Compare the constellation declination range with (phi-90, phi+90) for none, partial, or full geometric visibility at some sidereal time. This does not promise nighttime visibility on a given date, or account for terrain, weather, atmospheric refraction or light pollution.',
      caution: 'Ranges are rounded representations from the published J2000 boundary vertices, not high-precision interpolations of curved boundary edges. At a limiting latitude use the official chart and a local sky simulation.'
    },
    constellations: Object.fromEntries(entries.map(([abbreviation]) => [abbreviation, results[abbreviation]]))
  };
  const output = path.join(__dirname, '..', 'atlas-boundaries.json');
  fs.writeFileSync(output, JSON.stringify(dataset, null, 2) + '\n');
  console.log(`Wrote ${output}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
