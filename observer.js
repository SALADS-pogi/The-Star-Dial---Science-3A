/* Shared observing point and approximate sky orientation. No runtime API needed. */
(function (root) {
  'use strict';

  const observer = Object.freeze({
    place: 'Balanga, Bataan, Philippines',
    shortPlace: 'Balanga, Bataan',
    site: 'Bataan National High School',
    barangay: 'Bagong Silang',
    schoolId: '300702',
    lat: 14.6753,
    lon: 120.5201,
    whenUtc: '2026-09-02T13:00:00Z',
    whenLocal: 'Sept 2, 2026, 9:00 PM PHT',
    sourceUrl: 'https://www.deped.gov.ph/wp-content/uploads/2021/10/SBB1_Annex-D_List-of-Recipient-Schools_2021c-CB-027.pdf',
    sourcePage: 3
  });

  const wrapHours = hours => ((hours % 24) + 24) % 24;

  // USNO approximate GMST, followed by east-positive longitude / 15.
  // https://aa.usno.navy.mil/faq/GAST
  // UTC approximates UT1, and TT approximates UT1, for this teaching model.
  // This is mean sidereal time; nutation is not included. Input star positions
  // retain their catalog epoch (J2000 in this app), without precession to date.
  function localSiderealHours(utcDate, longitudeDegrees) {
    const milliseconds = new Date(utcDate).getTime();
    if (!Number.isFinite(milliseconds) || !Number.isFinite(longitudeDegrees)) {
      throw new TypeError('A valid date and finite longitude are required.');
    }
    const julianDate = milliseconds / 86400000 + 2440587.5;
    const midnightJulianDate = Math.floor(julianDate - 0.5) + 0.5;
    const daysSinceJ2000 = midnightJulianDate - 2451545.0;
    const hoursSinceMidnight = (julianDate - midnightJulianDate) * 24;
    const centuriesSinceJ2000 = (julianDate - 2451545.0) / 36525;
    const greenwichHours = 6.697375
      + 0.065709824279 * daysSinceJ2000
      + 1.0027379 * hoursSinceMidnight
      + 0.0000258 * centuriesSinceJ2000 * centuriesSinceJ2000;
    return wrapHours(greenwichHours + longitudeDegrees / 15);
  }

  // Equatorial coordinates to the observer's horizon: +X east, +Y up, +Z north.
  // Equivalent to the altitude/azimuth relations in the USNO reference below,
  // expressed as a vector to remain well behaved at the zenith and horizon.
  // https://aa.usno.navy.mil/faq/alt_az
  // No atmospheric refraction, local terrain or observer-height correction.
  function equatorialToHorizon(raHours, decDeg, radius, latDeg, lstHours) {
    const radians = Math.PI / 180;
    const hourAngle = (lstHours - raHours) * 15 * radians;
    const declination = decDeg * radians;
    const latitude = latDeg * radians;
    const cosDec = Math.cos(declination), sinDec = Math.sin(declination);
    const cosLat = Math.cos(latitude), sinLat = Math.sin(latitude);
    const cosHourAngle = Math.cos(hourAngle);
    return {
      x: -radius * cosDec * Math.sin(hourAngle),
      y: radius * (sinDec * sinLat + cosDec * cosLat * cosHourAngle),
      z: radius * (sinDec * cosLat - cosDec * sinLat * cosHourAngle)
    };
  }

  // Hold day, year and clock time constant so a month comparison isolates
  // the seasonal change. Explicit UTC conversion avoids device-timezone drift.
  function observationForMonth(month) {
    if (!Number.isInteger(month) || month < 0 || month > 11) {
      throw new RangeError('Choose a month from 0 (January) to 11 (December).');
    }
    const whenUtc = new Date(Date.UTC(2026, month, 2, 13)).toISOString();
    const monthName = ['January','February','March','April','May','June','July','August','September','October','November','December'][month];
    return Object.freeze({month, whenUtc, whenLocal: `2 ${monthName} 2026 · 9:00 PM PHT`, lstHours: localSiderealHours(whenUtc, observer.lon)});
  }

  let selectedMonth = 8;
  try {
    const saved = root.localStorage?.getItem('stardial_observing_month_v1');
    if (saved !== null && saved !== undefined && /^(?:[0-9]|1[01])$/.test(saved)) selectedMonth = Number(saved);
  } catch (_) { /* Storage is optional; the shared in-memory view still works. */ }
  let observation = observationForMonth(selectedMonth);
  const listeners = new Set();
  function getObservation() { return observation; }
  function setMonth(month) {
    const next = observationForMonth(month);
    if (observation.month === month) return observation;
    observation = next;
    try { root.localStorage?.setItem('stardial_observing_month_v1', String(month)); } catch (_) {}
    listeners.forEach(listener => listener(observation));
    return observation;
  }
  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
  function position(raHours, decDeg, at = observation) {
    const vector = equatorialToHorizon(raHours, decDeg, 1, observer.lat, at.lstHours);
    const altitude = Math.asin(Math.max(-1, Math.min(1, vector.y))) * 180 / Math.PI;
    const azimuth = ((Math.atan2(vector.x, vector.z) * 180 / Math.PI) + 360) % 360;
    const directions = ['North','North-east','East','South-east','South','South-west','West','North-west'];
    return {...vector, altitude, azimuth, direction: altitude > 89.5 ? 'Near the zenith' : directions[Math.round(azimuth / 45) % 8]};
  }
  // This evaluates the plotted pattern's main stars, not the whole IAU region.
  function patternVisibility(coordinates, brightIndex, at = observation) {
    const stars = coordinates.map(([ra, dec]) => position(ra, dec, at));
    const altitudes = stars.map(star => star.altitude);
    return {
      stars, anchor: stars[brightIndex],
      aboveCount: stars.filter(star => star.altitude > 0).length,
      minAltitude: Math.min(...altitudes), maxAltitude: Math.max(...altitudes),
      meanAltitude: altitudes.reduce((sum, altitude) => sum + altitude, 0) / stars.length
    };
  }
  const api = Object.freeze({observer, localSiderealHours, equatorialToHorizon,
    observationForMonth, getObservation, setMonth, subscribe, position, patternVisibility});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StarDialObserver = api;
})(typeof window !== 'undefined' ? window : globalThis);
