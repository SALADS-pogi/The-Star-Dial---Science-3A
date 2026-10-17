const {test} = require('node:test');
const assert = require('node:assert/strict');
const {observer, localSiderealHours, equatorialToHorizon} = require('../observer.js');

function near(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);
}

test('the Bataan reference point retains its sourced school identity and Philippine time', () => {
  assert.equal(observer.site, 'Bataan National High School');
  assert.equal(observer.schoolId, '300702');
  assert.equal(observer.barangay, 'Bagong Silang');
  assert.equal(observer.place, 'Balanga, Bataan, Philippines');
  assert.equal(observer.lat, 14.6753);
  assert.equal(observer.lon, 120.5201);
  assert.equal(observer.sourcePage, 3);
  assert.equal(new URL(observer.sourceUrl).hostname, 'www.deped.gov.ph');
  assert.equal(new Date(observer.whenUtc).getTime(), new Date('2026-09-02T21:00:00+08:00').getTime());
  near(localSiderealHours(observer.whenUtc, observer.lon), localSiderealHours('2026-09-02T21:00:00+08:00', observer.lon));
});

test('mean sidereal time agrees with reference values and applies east longitude positively', () => {
  // J2000 Greenwich reference angle, 280.46061837 degrees; the USNO
  // approximation agrees within a small fraction of a second of sidereal time.
  near(localSiderealHours('2000-01-01T12:00:00Z', 0), 280.46061837 / 15, 0.02 / 3600);
  // Separately calculated for 2026-09-02 13:00 UTC: GMST 11h46m46.247s,
  // and LMST 19h48m51.071s at 120.5201 degrees east.
  const greenwich = localSiderealHours(observer.whenUtc, 0);
  const local = localSiderealHours(observer.whenUtc, observer.lon);
  near(greenwich, 11 + 46 / 60 + 46.247 / 3600, 0.002 / 3600);
  near(local, 19 + 48 / 60 + 51.071 / 3600, 0.002 / 3600);
  near(local - greenwich, observer.lon / 15);
  near(localSiderealHours(observer.whenUtc, -15), greenwich - 1);
  for (const longitude of [-720, -180, 0, 180, 720]) {
    const hours = localSiderealHours('1900-01-01T00:00:00Z', longitude);
    assert.ok(hours >= 0 && hours < 24);
    near(hours, localSiderealHours('1900-01-01T00:00:00Z', longitude + 360));
  }
});

test('horizon vectors preserve cardinal directions and the observer latitude', () => {
  const lst = localSiderealHours(observer.whenUtc, observer.lon);
  const radius = 100;
  const east = equatorialToHorizon(lst + 6, 0, radius, observer.lat, lst);
  const west = equatorialToHorizon(lst - 6, 0, radius, observer.lat, lst);
  near(east.x, radius); near(east.y, 0); near(east.z, 0);
  near(west.x, -radius); near(west.y, 0); near(west.z, 0);
  const zenith = equatorialToHorizon(lst, observer.lat, radius, observer.lat, lst);
  near(zenith.x, 0); near(zenith.y, radius); near(zenith.z, 0);
  const pole = equatorialToHorizon(0, 90, radius, observer.lat, lst);
  near(pole.x, 0);
  assert.ok(pole.z > 0, 'the north celestial pole must be north');
  near(Math.asin(pole.y / radius) * 180 / Math.PI, observer.lat);
  const below = equatorialToHorizon(lst + 12, -observer.lat, radius, observer.lat, lst);
  near(below.y, -radius);
  const arbitrary = equatorialToHorizon(5.6, -4.5, radius, observer.lat, lst);
  near(Math.hypot(arbitrary.x, arbitrary.y, arbitrary.z), radius);
});
