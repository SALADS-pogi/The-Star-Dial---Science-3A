const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {matches, visibility, region} = require('../atlas.js');
const root = path.join(__dirname, '..');
const context = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root, 'atlas-data.js'), 'utf8'), context);
const {entries} = context.window.STAR_ATLAS_DATA;
const byId = Object.fromEntries(entries.map(item => [item.abbreviation, item]));

test('all 88 entries have verified local charts, factual fields, and their own primary references', () => {
  assert.equal(entries.length, 88);
  assert.equal(new Set(entries.map(item => item.abbreviation)).size, 88);
  assert.equal(entries.reduce((n,item) => n + item.charts.length, 0), 89);
  assert.equal(byId.Ser.charts.length, 2);
  assert.equal(byId.CrA.name, 'Corona Australis');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const iau = require('../atlas-iau.json').constellations;
  for (const item of entries) {
    for (const field of ['name','englishMeaning','pronunciation','genitive','sourceUrl']) assert.ok(item[field], `${item.abbreviation}: ${field}`);
    assert.equal(item.name, iau[item.abbreviation].name);
    assert.ok(item.minDec < item.maxDec && item.minDec >= -90 && item.maxDec <= 90);
    assert.equal(item.boundaryUrls.length, item.charts.length);
    for (const chart of item.charts) {
      const gif = fs.readFileSync(path.join(root, chart.localPath));
      assert.match(gif.subarray(0,6).toString(), /^GIF8[79]a$/);
      assert.equal(gif.readUInt16LE(6), chart.width);
      assert.equal(gif.readUInt16LE(8), chart.height);
      assert.ok(sw.includes(`"./${chart.localPath}"`), `Not cached: ${chart.localPath}`);
      assert.ok(iau[item.abbreviation].charts.some(source => source.gifUrl === chart.gifUrl && source.pdfUrl === chart.pdfUrl));
    }
  }
});

test('search handles accents, abbreviations, aliases, meanings and catalog objects', () => {
  for (const [abbr, query] of [['Boo','bootes'],['Boo','Boötes'],['CrA','corona austrina'],['Cyg','swan'],['UMa','uma'],['Ori','M42'],['And','Andromeda M31']]) {
    assert.equal(matches(byId[abbr], 'all', query), true, query);
  }
  assert.equal(entries.filter(item => matches(item, 'all', 'no such constellation')).length, 0);
  assert.equal(entries.filter(item => matches(item, 'all', '   ')).length, 88);
});

test('sky filters handle equatorial regions and the thirteen astronomical zodiac constellations', () => {
  assert.equal(entries.filter(item => matches(item, 'zodiac', '')).length, 13);
  assert.equal(matches(byId.Oph, 'zodiac', ''), true);
  for (const abbr of ['Ori','Mon','Oph']) {
    for (const filter of ['north','south','equator']) assert.equal(matches(byId[abbr], filter, ''), true, `${abbr}: ${filter}`);
  }
  assert.equal(matches(byId.And, 'south', ''), false);
  assert.equal(matches(byId.Ara, 'north', ''), false);
  assert.equal(region(byId.Ori), 'Across the equator');
  assert.equal(entries.filter(item => matches(item, 'highlights', '')).length, 11);
});

test('geometric visibility includes the enclosed poles and distinguishes partial and absent views', () => {
  assert.equal(byId.UMi.maxDec, 90);
  assert.equal(byId.Oct.minDec, -90);
  assert.equal(visibility(byId.UMi), 'full');
  assert.equal(visibility(byId.Ori), 'full');
  assert.equal(visibility(byId.Oct), 'partial');
  // A small corner crosses the ideal horizon at the new Bataan latitude.
  assert.equal(visibility(byId.Cha), 'partial');
  assert.equal(visibility(byId.Cha, 14.8), 'none');
  assert.equal(visibility(byId.UMi, -45), 'none');
  assert.equal(visibility(byId.Oct, -45), 'full');
  assert.equal(visibility({minDec:-10,maxDec:10}, 90), 'partial');
  assert.equal(visibility({minDec:-30,maxDec:0}, 90), 'none');
});
