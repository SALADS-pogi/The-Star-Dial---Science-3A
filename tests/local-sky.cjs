const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const observerSource = fs.readFileSync(path.join(__dirname, '..', 'observer.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const coordinatesMatch = html.match(/const STAR_RADEC\s*=\s*(\{[\s\S]*?\});/);
assert.ok(coordinatesMatch, 'the plotted-star coordinate catalog must be available');
const coordinates = vm.runInNewContext('(' + coordinatesMatch[1] + ')');

function near(actual, expected, tolerance = 0.03) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${actual} differs from ${expected} by more than ${tolerance}`);
}

function browserModel(storage) {
  const context = {localStorage: storage};
  context.window = context;
  vm.runInNewContext(observerSource, context);
  return context.StarDialObserver;
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value))
  };
}

test('all monthly observations use the same Bataan local time and day', () => {
  const sky = browserModel(memoryStorage());
  for (let month = 0; month < 12; month++) {
    const observation = sky.observationForMonth(month);
    const instant = new Date(observation.whenUtc);
    assert.equal(observation.month, month);
    assert.equal(instant.getUTCFullYear(), 2026);
    assert.equal(instant.getUTCMonth(), month);
    assert.equal(instant.getUTCDate(), 2);
    assert.equal(instant.getUTCHours(), 13); // 9 PM Philippine Time, UTC+08:00.
    assert.equal(instant.getUTCMinutes(), 0);
    assert.equal(instant.getUTCSeconds(), 0);
    assert.match(observation.whenLocal, /2026/);
    assert.match(observation.whenLocal, /9(?::00)?\s*PM/i);
    assert.match(observation.whenLocal, /PHT|Philippine/);
    assert.ok(observation.lstHours >= 0 && observation.lstHours < 24);
  }
  near(sky.observationForMonth(1).lstHours, 5.883704449, 0.00001);
  near(sky.observationForMonth(8).lstHours, 19.814187305, 0.00001);
});

test('local positions agree with independently calculated horizon fixtures', () => {
  const sky = browserModel(memoryStorage());
  // Fixtures were calculated separately with the full Julian-date GMST
  // polynomial and scalar altitude/azimuth equations, not this API's vector
  // transform. Geometric positions use the app's J2000 catalog without
  // precession or refraction, matching the documented teaching approximation.
  const fixtures = [
    {month: 1, ra: 5.919, dec: 7.41, altitude: 82.716168808, azimuth: 175.855474076},
    {month: 7, ra: 5.919, dec: 7.41, altitude: -67.814173212, azimuth: 354.405991583},
    {month: 8, ra: 23.079, dec: 15.21, altitude: 42.783711856, azimuth: 82.694565714},
    {month: 8, ra: 11.062, dec: 61.75, altitude: -4.527164033, azimuth: 339.096504527},
    {month: 4, ra: 12.443, dec: -63.1, altitude: 11.781687613, azimuth: 175.092532684}
  ];
  for (const fixture of fixtures) {
    const p = sky.position(fixture.ra, fixture.dec, sky.observationForMonth(fixture.month));
    near(p.altitude, fixture.altitude);
    near(p.azimuth, fixture.azimuth);
    near(Math.hypot(p.x, p.y, p.z), 1, 1e-10);
    assert.ok(typeof p.direction === 'string' && p.direction.length > 0);
  }
});

test('pattern visibility distinguishes whole, partial, hidden and low southern patterns', () => {
  const sky = browserModel(memoryStorage());
  const fixtures = [
    {key: 'orion', month: 1, min: 65.2, max: 82.7, visibility: 'whole', bright: 5},
    {key: 'orion', month: 7, min: -85.0, max: -67.8, visibility: 'none', bright: 5},
    {key: 'pegasus', month: 8, min: 26.4, max: 43.0, visibility: 'whole', bright: 0},
    {key: 'ursaMajor', month: 8, min: -8.4, max: 10.9, visibility: 'partial', bright: 4},
    {key: 'crux', month: 4, min: 11.8, max: 17.5, visibility: 'whole', bright: 0}
  ];
  for (const fixture of fixtures) {
    const observation = sky.observationForMonth(fixture.month);
    const pattern = sky.patternVisibility(coordinates[fixture.key], fixture.bright, observation);
    assert.equal(pattern.stars.length, coordinates[fixture.key].length);
    near(pattern.minAltitude, fixture.min, 0.1);
    near(pattern.maxAltitude, fixture.max, 0.1);
    assert.ok(pattern.meanAltitude >= pattern.minAltitude && pattern.meanAltitude <= pattern.maxAltitude);
    if (fixture.visibility === 'whole') assert.equal(pattern.aboveCount, pattern.stars.length);
    if (fixture.visibility === 'none') assert.equal(pattern.aboveCount, 0);
    if (fixture.visibility === 'partial') assert.ok(pattern.aboveCount > 0 && pattern.aboveCount < pattern.stars.length);
    const anchor = sky.position(...coordinates[fixture.key][fixture.bright], observation);
    near(pattern.anchor.altitude, anchor.altitude, 1e-10);
    near(pattern.anchor.azimuth, anchor.azimuth, 1e-10);
  }
});

test('changing month shares one observation, persists it and notifies once', () => {
  const storage = memoryStorage();
  const sky = browserModel(storage);
  const notices = [];
  const unsubscribe = sky.subscribe(observation => notices.push(observation));
  notices.length = 0; // An initial subscription snapshot is permitted.
  const month = (sky.getObservation().month + 1) % 12;
  sky.setMonth(month);
  assert.equal(sky.getObservation().month, month);
  assert.equal(notices.length, 1);
  assert.equal(notices[0].month, month);
  const explicit = sky.position(5.919, 7.41, sky.observationForMonth(month));
  const shared = sky.position(5.919, 7.41);
  near(shared.altitude, explicit.altitude, 1e-10);
  near(shared.azimuth, explicit.azimuth, 1e-10);
  assert.equal(browserModel(storage).getObservation().month, month, 'reload restores the selected month');
  sky.setMonth(month);
  assert.equal(notices.length, 1, 'selecting the same month must not notify again');
  unsubscribe();
  sky.setMonth((month + 1) % 12);
  assert.equal(notices.length, 1, 'unsubscribed views must stop receiving updates');
});

test('invalid months cannot silently roll the date or mutate the shared sky', () => {
  const sky = browserModel(memoryStorage());
  const original = sky.getObservation().month;
  const notices = [];
  sky.subscribe(observation => notices.push(observation));
  notices.length = 0;
  for (const value of [-1, 12, 1.5, NaN, Infinity, -Infinity]) {
    assert.throws(() => sky.observationForMonth(value));
    assert.throws(() => sky.setMonth(value));
    assert.equal(sky.getObservation().month, original);
  }
  assert.equal(notices.length, 0);
});

test('month changes still work when browser storage is blocked', () => {
  const blockedStorage = {
    getItem() { throw new Error('storage unavailable'); },
    setItem() { throw new Error('storage unavailable'); }
  };
  const sky = browserModel(blockedStorage);
  const month = (sky.getObservation().month + 1) % 12;
  assert.doesNotThrow(() => sky.setMonth(month));
  assert.equal(sky.getObservation().month, month);
});

test('the actual Three.js month rotation matches directly calculated Bataan positions', () => {
  // Exercise the shipped library and the actual Roam subscription handler.
  // This catches the wrong pole, rotation sign, sidereal units, wraparound,
  // cumulative rotations and stale world matrices without needing WebGL.
  const threeSource = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
    .map(match => match[1]).find(source => source.includes('three.js r160'));
  assert.ok(threeSource, 'the offline Three.js bundle must be available');
  const libraryContext = {console: {warn() {}, error() {}}};
  vm.runInNewContext(threeSource, libraryContext);
  const THREE = libraryContext.THREE;
  const handlerStart = html.indexOf('  const northPole = new THREE.Vector3');
  const handlerEnd = html.indexOf('\n  });', handlerStart);
  assert.ok(handlerStart >= 0 && handlerEnd > handlerStart);
  const handlerSource = html.slice(handlerStart, handlerEnd + '\n  });'.length);
  const sky = browserModel(memoryStorage());
  const stars = Object.values(coordinates).flat().concat([[0, 90], [0, -90]]);

  for (const initialMonth of [0, 8, 11]) {
    const initial = sky.observationForMonth(initialMonth);
    const skyFrame = new THREE.Group();
    const objects = stars.map(([ra, dec]) => {
      const point = sky.position(ra, dec, initial);
      const object = new THREE.Object3D();
      object.position.set(point.x * 480, point.y * 480, point.z * 480);
      skyFrame.add(object);
      return object;
    });
    let onMonthChange;
    const context = {
      THREE, OBSERVER: sky.observer, skyFrame,
      initialSiderealHours: initial.lstHours, LST_HOURS: initial.lstHours,
      skyModel: {subscribe(listener) { onMonthChange = listener; }},
      closePopup() {}, document: {getElementById() { return {}; }}
    };
    vm.runInNewContext(handlerSource, context);
    assert.equal(typeof onMonthChange, 'function');
    // Include a return to an earlier month to catch accidental accumulation.
    for (const month of [11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 11]) {
      const observation = sky.observationForMonth(month);
      onMonthChange(observation);
      objects.forEach((object, index) => {
        const actual = object.getWorldPosition(new THREE.Vector3());
        const expected = sky.position(...stars[index], observation);
        near(actual.x, expected.x * 480, 1e-8);
        near(actual.y, expected.y * 480, 1e-8);
        near(actual.z, expected.z * 480, 1e-8);
      });
    }
  }
});
