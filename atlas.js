/* All 88 atlas entries use bundled IAU data and charts. No runtime API needed. */
(function (root) {
  'use strict';
  const {observer} = typeof module !== 'undefined' && module.exports ? require('./observer.js') : root.StarDialObserver;
  const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const region = item => item.minDec < 0 && item.maxDec > 0 ? 'Across the equator' : item.minDec >= 0 ? 'Northern sky' : 'Southern sky';

  function matches(item, filter, query) {
    if (filter === 'north' && item.maxDec <= 0) return false;
    if (filter === 'south' && item.minDec >= 0) return false;
    if (filter === 'equator' && !(item.minDec < 0 && item.maxDec > 0)) return false;
    if (filter === 'zodiac' && !item.sunPath) return false;
    if (filter === 'highlights' && !item.highlight) return false;
    const haystack = normalize([item.name, item.abbreviation, item.englishMeaning, item.genitive, ...(item.aliases || []), item.highlight?.object].join(' '));
    return normalize(query).trim().split(/\s+/).every(word => haystack.includes(word));
  }

  function visibility(item, latitude = observer.lat) {
    const low = latitude - 90, high = latitude + 90;
    if (item.maxDec <= low || item.minDec >= high) return 'none';
    if (item.minDec <= low || item.maxDec >= high) return 'partial';
    return 'full';
  }

  // Pure functions are also used by dependency-free data/astronomy regression tests.
  if (typeof module !== 'undefined' && module.exports) module.exports = {normalize, matches, visibility, region};
  if (!root.document) return;
  const data = root.STAR_ATLAS_DATA;
  const section = document.getElementById('atlas');
  if (!section) return;
  const grid = document.getElementById('atlasGrid');
  const search = document.getElementById('atlasSearch');
  const count = document.getElementById('atlasCount');
  if (!data?.entries?.length) {
    count.textContent = 'The atlas could not load. Reload the app to try again.';
    return;
  }
  const dialog = document.getElementById('atlasDialog');
  const content = document.getElementById('atlasDetailContent');
  const previous = document.getElementById('atlasPrevious');
  const next = document.getElementById('atlasNext');
  const chips = Array.from(section.querySelectorAll('[data-filter]'));
  let filter = 'all', results = [], selectedIndex = 0, trigger = null, nightChart = true;
  const link = (url, label) => `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)} <span aria-hidden="true">↗</span></a>`;
  const signed = degrees => `${degrees < 0 ? '−' : '+'}${Math.abs(degrees).toFixed(1)}°`;

  document.getElementById('atlasGuideContent').innerHTML = data.learning.guide.map(note => `<article><h3>${escape(note.title)}</h3><p>${escape(note.text)}</p><p class="atlas-citation">${link(data.learning.sources[note.source].url, note.source.startsWith('nasa') ? 'NASA reference' : 'IAU reference')}</p></article>`).join('');
  document.getElementById('atlasReferenceContent').innerHTML = `
    <p>Use these references for your notes or class report. Each constellation also links to its own chart and boundary data.</p>
    <ul>${Object.values(data.learning.sources).map(source => `<li>${link(source.url, source.title)}<p>${escape(source.usedFor)}</p></li>`).join('')}</ul>
    <p><strong>Chart credits:</strong> ${escape(data.metadata.chartAttribution)} ${link(data.metadata.chartLicenseUrl, 'CC BY 4.0')}.</p>
    <p>Charts use J2000 coordinates. Night colors are a reversible display filter; the bundled source images are unchanged. Sky regions and ${escape(observer.shortPlace)} visibility notes are calculated from the IAU boundaries. These are approximate planning notes, not a live sky forecast.</p>
    <p><strong>Our Bataan reference point:</strong> ${escape(observer.site)}, ${escape(observer.shortPlace)} (${observer.lat}° N, ${observer.lon}° E). ${link(observer.sourceUrl + '#page=' + observer.sourcePage, 'DepEd school coordinates, PDF page ' + observer.sourcePage)}. <a href="BATAAN_REFERENCE.md" download>Download the location explanation (.md)</a>.</p>
    <p>Names and chart data retrieved 15 October 2026. Learning notes reviewed 16 October 2026. Pronunciation guides allow variation.</p>
    <p><a href="ATLAS_REFERENCES.md" download>Download the reference list (.md)</a></p>
    <p class="atlas-citation">Entries and charts work offline after the app finishes downloading. External references and print PDFs need an internet connection.</p>`;

  function setFilter(value) {
    filter = value;
    chips.forEach(chip => {
      const active = chip.dataset.filter === filter;
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-pressed', String(active));
    });
    render();
  }

  function render() {
    results = data.entries.filter(item => matches(item, filter, search.value));
    count.textContent = `${results.length} of 88 constellations`;
    const note = document.getElementById('atlasFilterNote');
    note.hidden = !['north','south','equator','zodiac'].includes(filter);
    note.textContent = filter === 'zodiac' ? 'These 13 constellations lie along the Sun’s apparent path, including Ophiuchus. This is an astronomy filter.' : 'Northern and Southern refer to the celestial equator. A constellation that crosses it appears in both filters.';
    grid.replaceChildren();
    if (!results.length) {
      const empty = document.createElement('p');
      empty.className = 'atlas-empty';
      empty.textContent = 'No matches just yet. Try a name, its English meaning, or a three-letter abbreviation. Reset clears the search and filters.';
      grid.appendChild(empty);
      return;
    }
    results.forEach((item, index) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'atlas-card';
      card.setAttribute('aria-haspopup', 'dialog');
      card.setAttribute('aria-label', `Explore ${item.name}, ${item.englishMeaning}`);
      card.innerHTML = `<span class="atlas-card-top"><span class="atlas-card-name">${escape(item.name)}</span><span class="atlas-abbr">${escape(item.abbreviation)}</span></span>
        <span class="meaning">${escape(item.englishMeaning)}</span>
        <span class="atlas-card-region">${region(item)}${item.sunPath ? ' · Sun’s path' : ''}</span>
        <span class="atlas-card-footer"><span>${item.highlight ? 'Chart + a closer look' : 'Chart + field notes'}</span><span aria-hidden="true">↗</span></span>`;
      card.addEventListener('click', () => {
        trigger = card;
        selectedIndex = index;
        renderDetail();
        document.body.classList.add('atlas-modal-open');
        dialog.showModal();
      });
      grid.appendChild(card);
    });
  }

  function renderDetail() {
    const item = results[selectedIndex];
    const view = visibility(item);
    const localNote = {
      full: 'All parts of this constellation’s region can rise above our Bataan reference point’s horizon at some time. That does not mean the whole region is visible together or tonight.',
      partial: 'Only part of this constellation’s region can rise above our Bataan reference point’s horizon. Its far-southern portion stays out of view.',
      none: 'This constellation’s region stays below our Bataan reference point’s horizon. You would need to travel farther south to see it.'
    }[view];
    document.getElementById('atlasEntryPosition').textContent = `${selectedIndex + 1} of ${results.length}`;
    document.getElementById('atlasDetailAbbr').textContent = item.abbreviation;
    previous.disabled = selectedIndex === 0;
    next.disabled = selectedIndex === results.length - 1;
    content.innerHTML = `
      <header class="atlas-detail-header"><div class="eyebrow">${region(item)}${item.sunPath ? ' · Along the Sun’s path' : ''}</div><h2 id="atlasDetailTitle" tabindex="-1">${escape(item.name)}</h2><p>${escape(item.englishMeaning)} <span>· ${escape(item.abbreviation)}</span></p></header>
      <div class="atlas-entry-layout">
        <div class="atlas-chart-column">
          <div class="atlas-chart-heading"><h3>The sky chart</h3><label class="atlas-night-control"><input id="atlasNightColors" type="checkbox" ${nightChart ? 'checked' : ''}> Night colors</label></div>
          ${item.abbreviation === 'Ser' ? '<p class="atlas-chart-note">Serpens is one constellation in two separate areas: the head (Caput) and tail (Cauda). Both charts are included.</p>' : ''}
          ${item.charts.map(chart => `<figure class="atlas-chart ${nightChart ? 'night-colors' : ''}"><a href="${escape(chart.localPath)}" target="_blank" rel="noopener" aria-label="Open ${escape(chart.label)} chart at full size"><img src="${escape(chart.localPath)}" width="${chart.width}" height="${chart.height}" alt="IAU sky chart of ${escape(chart.label)}, showing labeled stars, constellation boundaries, nearby constellations, and sky coordinates."></a><figcaption>${escape(chart.label)} · ${link(chart.localPath, 'Full-size chart')} · ${link(chart.pdfUrl, 'Print PDF (online)')}</figcaption></figure>`).join('')}
          <p class="atlas-chart-credit">${escape(data.metadata.chartAttribution)} ${link(data.metadata.chartLicenseUrl, 'CC BY 4.0')}. Night colors invert the chart for a darker display.</p>
        </div>
        <div class="atlas-field-notes">
          <h3>Get to know ${escape(item.name)}</h3>
          <dl class="atlas-facts">
            <div><dt>Say it like this</dt><dd>${escape(item.pronunciation)}</dd></div>
            <div><dt>English meaning</dt><dd>${escape(item.englishMeaning)}</dd></div>
            <div><dt>Short name on charts</dt><dd>${escape(item.abbreviation)}</dd></div>
            <div><dt>Latin form in star names</dt><dd>${escape(item.genitive)}<small>The possessive form, called the genitive.</small></dd></div>
            <div><dt>Sky region</dt><dd>${region(item)}</dd></div>
            <div><dt>Declination range · approx.</dt><dd>${signed(item.minDec)} to ${signed(item.maxDec)}<small>North (+) or south (−) of the celestial equator, using J2000 boundaries.</small></dd></div>
          </dl>
          <section class="atlas-observing"><h3>From ${escape(observer.shortPlace)}</h3><p>${localNote}</p><p class="atlas-citation">Using ${observer.lat}° N at ${escape(observer.site)} and an ideal, flat horizon. This is a geometric limit; a tiny part just above the horizon may be impossible to see in practice. Clouds, terrain, moonlight, city lights and the date and time affect the view. ${link(observer.sourceUrl + '#page=' + observer.sourcePage, 'DepEd location source')}.</p></section>
          ${item.highlight ? `<section class="atlas-highlight"><div class="eyebrow">A closer look</div><h3>${escape(item.highlight.title)}</h3><p class="atlas-object">${escape(item.highlight.object)}</p><p>${escape(item.highlight.text)}</p><p class="atlas-citation">${link(item.highlight.sourceUrl, item.highlight.sourceTitle)}</p></section>` : ''}
          <section class="atlas-chart-task"><h3>Try it on the chart</h3><p>Find the constellation’s name, trace its boundary, then compare the larger and smaller star dots. Which neighboring constellation would help you find your way back?</p></section>
          <details class="atlas-entry-help"><summary>How to read the chart</summary><p>The larger star symbols mark brighter stars. The line drawing is one way to picture the pattern; the dotted outline marks the constellation’s region. Neighboring regions are shaded.</p><p>Hour labels show right ascension; degree labels show declination. Follow these coordinates on polar charts, where the grid curves. The view in your sky may be rotated.</p><p>Labels such as M42 or NGC 7635 identify catalog objects. Many need binoculars or a telescope, even when they appear on the chart.</p></details>
          <section class="atlas-entry-sources"><h3>References for this entry</h3><ul>
            <li>${link(item.sourceUrl, 'IAU: official name, meaning and naming guide')}</li>
            ${item.charts.map(chart => `<li>${link(chart.gifUrl, `IAU / Sky & Telescope: ${chart.label} chart`)}</li>`).join('')}
            ${item.boundaryUrls.map((url, i) => `<li>${link(url, `IAU boundary coordinates${item.boundaryUrls.length > 1 ? ` (${i + 1})` : ''}`)}</li>`).join('')}
            ${item.pronunciationSourceUrl ? `<li>${link(item.pronunciationSourceUrl, 'Pronunciation cross-check')}</li>` : ''}
          </ul><p class="atlas-citation">The observing note is calculated from the boundary range, not quoted from the source. <a href="ATLAS_REFERENCES.md" target="_blank" rel="noopener">Read the method and full reference list</a>. External sources open in a new tab and need internet.</p></section>
        </div>
      </div>`;
    document.getElementById('atlasNightColors').addEventListener('change', event => {
      nightChart = event.target.checked;
      content.querySelectorAll('.atlas-chart').forEach(chart => chart.classList.toggle('night-colors', nightChart));
    });
    content.querySelectorAll('img').forEach(img => img.addEventListener('error', () => {
      const message = document.createElement('p');
      message.className = 'atlas-chart-error';
      message.textContent = 'This chart could not load. Reopen the app online to finish downloading the atlas, or use the source link below.';
      img.replaceWith(message);
    }, {once:true}));
    dialog.scrollTop = 0;
  }

  chips.forEach(chip => chip.addEventListener('click', () => setFilter(chip.dataset.filter)));
  search.addEventListener('input', render);
  document.getElementById('atlasClear').addEventListener('click', () => { search.value = ''; setFilter('all'); search.focus(); });
  document.getElementById('atlasClose').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    document.body.classList.remove('atlas-modal-open');
    if (!section.hidden && trigger?.isConnected) trigger.focus({preventScroll:true});
  });
  function step(direction) {
    selectedIndex = Math.max(0, Math.min(results.length - 1, selectedIndex + direction));
    renderDetail();
    document.getElementById('atlasDetailTitle').focus({preventScroll:true});
  }
  previous.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  root.addEventListener('app:viewchange', event => { if (event.detail.view !== 'atlas' && dialog.open) dialog.close(); });
  render();
})(typeof window === 'undefined' ? globalThis : window);
