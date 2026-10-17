const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function sourceBetween(startText, endText) {
  const start = html.indexOf(startText);
  const end = html.indexOf(endText, start);
  assert.ok(start >= 0 && end > start, 'assessment source boundaries exist');
  return html.slice(start, end);
}

function element(value = '') {
  const handlers = {};
  return {
    value, innerHTML: '', style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(name, handler) { handlers[name] = handler; },
    fire(name, event = {}) { assert.ok(handlers[name], `${name} handler exists`); handlers[name](event); },
    querySelectorAll() { return []; },
    appendChild() {}
  };
}

function documentFixture(elements) {
  const downloads = [];
  return {
    downloads,
    document: {
      getElementById(id) {
        assert.ok(elements[id], `Unexpected or removed UI element: ${id}`);
        return elements[id];
      },
      createElement(tag) {
        const node = element();
        node.click = () => downloads.push({ filename: node.download, href: node.href });
        return node;
      }
    }
  };
}

function lessonFixture() {
  const elements = Object.fromEntries(['evidenceChecks', 'cerClaim', 'cerReasoning', 'submitCer',
    'reportCard', 'gradeRow', 'reportBody', 'printReport', 'downloadReport'].map(id => [id, element()]));
  elements.cerClaim.value = 'night_side';
  elements.cerReasoning.value = '  Earth changes position around the Sun, changing our nighttime view.  ';
  let checked = [0, 1];
  elements.evidenceChecks.querySelectorAll = () => checked.map(idx => ({ dataset: { idx: String(idx) } }));
  const observations = [
    { month: 0, visible: true, label: 'Visible above the horizon' },
    { month: 6, visible: false, label: 'Not visible in the model' }
  ];
  const state = {
    mission: 'orion', predict: { answer: 'no', reason: 'night_side', confidence: 'mid' },
    observations, observe: { pattern: 'The visible pattern changes.', reflection: 'a_little' },
    psychomotor: { attempts: 1, success: true }, explain: {}
  };
  const { document, downloads } = documentFixture(elements);
  const alerts = [], completed = [], blobs = [];
  let saves = 0;
  vm.runInNewContext(sourceBetween('// ---- EXPLAIN (', '    function hydrateUI(){'), {
    document, state, studentIdInput: { value: 'Test Student' },
    CORRECT_CLAIM: 'night_side', MONTH_NAMES: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
    REASON_LABELS: { night_side: 'Earth changes the nighttime view' },
    CLAIM_LABELS: { night_side: 'Orion is not visible in the opposite season.' },
    C: { orion: { name: 'Orion' } }, missionInfo: () => ({ name: 'Orion' }),
    alert: message => alerts.push(message), markDone: phase => completed.push(phase),
    saveState: () => saves++, window: { print() {} }, Blob,
    URL: { createObjectURL(blob) { blobs.push(blob); return `blob:test-${blobs.length}`; } }
  });
  return { elements, state, alerts, completed, downloads, blobs,
    setChecked(value) { checked = value; }, saves: () => saves };
}

test('assessment submits CER without a rebuttal and renders all three parts', () => {
  const fixture = lessonFixture();
  fixture.elements.submitCer.fire('click');
  assert.deepEqual(fixture.alerts, []);
  assert.deepEqual(fixture.completed, ['explain']);
  assert.equal(fixture.saves(), 1);
  assert.equal(fixture.state.explain.claim, 'night_side');
  assert.equal(fixture.state.explain.evidence.length, 2);
  assert.equal(fixture.state.explain.evidenceHasContrast, true);
  assert.equal(fixture.state.explain.reasoning, fixture.elements.cerReasoning.value.trim());
  assert.equal(Object.hasOwn(fixture.state.explain, 'rebuttal'), false);
  assert.equal(fixture.elements.reportCard.style.display, 'block');
  for (const label of ['Q8 Claim:', 'Q9 Evidence:', 'Q10 Reasoning:']) {
    assert.ok(fixture.elements.reportBody.innerHTML.includes(label), label);
  }
  assert.doesNotMatch(fixture.elements.reportBody.innerHTML + fixture.elements.gradeRow.innerHTML, /rebuttal/i);
});

test('CER still requires a claim, two observations, and reasoning', () => {
  const fixture = lessonFixture();
  fixture.elements.cerClaim.value = '';
  fixture.elements.submitCer.fire('click');
  assert.equal(fixture.alerts.pop(), 'Choose a claim first.');
  fixture.elements.cerClaim.value = 'night_side';
  fixture.setChecked([0]);
  fixture.elements.submitCer.fire('click');
  assert.equal(fixture.alerts.pop(), 'Attach at least 2 pieces of evidence.');
  fixture.setChecked([0, 1]);
  fixture.elements.cerReasoning.value = '   ';
  fixture.elements.submitCer.fire('click');
  assert.equal(fixture.alerts.pop(), 'Fill in your reasoning.');
  assert.equal(fixture.saves(), 0);
  assert.deepEqual(fixture.completed, []);
});

test('downloading a legacy saved assessment exports CER and preserves its other answers', async () => {
  const fixture = lessonFixture();
  fixture.state.explain = {
    claim: 'night_side', reasoning: 'A saved explanation.', evidence: fixture.state.observations,
    claimCorrect: true, evidenceHasContrast: true, submittedAt: '2026-10-01T00:00:00.000Z',
    rebuttal: 'Legacy answer that should stay out of the CER report'
  };
  fixture.elements.downloadReport.fire('click');
  assert.equal(fixture.downloads[0].filename, 'stardial-cer-Test_Student.json');
  const report = JSON.parse(await fixture.blobs[0].text());
  assert.equal(report.studentId, 'Test Student');
  assert.equal(report.missionKey, 'orion');
  assert.deepEqual(report.predict, fixture.state.predict);
  assert.deepEqual(report.observations, fixture.state.observations);
  assert.deepEqual(report.explain, {
    claim: 'night_side', reasoning: 'A saved explanation.', evidence: fixture.state.observations,
    claimCorrect: true, evidenceHasContrast: true, submittedAt: '2026-10-01T00:00:00.000Z'
  });
  assert.ok(fixture.state.explain.rebuttal, 'downloading does not erase a previously saved answer');
});

test('teacher imports legacy and CER reports and exports only CER columns', async () => {
  const elements = Object.fromEntries(['teacherDrop', 'teacherFileInput', 'teacherResults', 'exportCsv'].map(id => [id, element()]));
  const { document, downloads } = documentFixture(elements);
  const blobs = [], errors = [];
  class FileReader {
    readAsText(file) { this.result = file.text; this.onload(); }
  }
  vm.runInNewContext(sourceBetween('// TEACHER DASHBOARD', '  // MOTIVATION'), {
    document, FileReader, Blob,
    console: { error: (...args) => errors.push(args) },
    URL: { createObjectURL(blob) { blobs.push(blob); return `blob:teacher-${blobs.length}`; } }
  });
  const legacy = {
    studentId: 'Legacy Student', missionName: 'Orion',
    predict: { answer: 'no', reason: 'night_side', confidence: 'high' },
    observe: { pattern: 'A seasonal pattern', reflection: 'a_little' },
    psychomotor: { success: true, attempts: 1 },
    explain: { claimCorrect: true, evidence: [{}, {}], evidenceHasContrast: true,
      reasoning: 'Older reasoning remains available.', rebuttal: 'OLD_REBUTTAL_SENTINEL' }
  };
  const current = structuredClone(legacy);
  current.studentId = 'CER Student';
  current.explain.reasoning = 'New reasoning remains available.';
  delete current.explain.rebuttal;
  elements.teacherFileInput.fire('change', { target: { files: [
    { name: 'stardial-cerr-legacy.json', text: JSON.stringify(legacy) },
    { name: 'stardial-cer-current.json', text: JSON.stringify(current) }
  ] } });
  assert.deepEqual(errors, []);
  const rendered = elements.teacherResults.innerHTML;
  for (const text of ['Legacy Student', 'CER Student', legacy.explain.reasoning, current.explain.reasoning]) {
    assert.ok(rendered.includes(text), text);
  }
  assert.doesNotMatch(rendered, /rebuttal|OLD_REBUTTAL_SENTINEL/i);
  elements.exportCsv.fire('click');
  assert.equal(downloads[0].filename, 'stardial-class-report.csv');
  const csv = await blobs[0].text();
  assert.doesNotMatch(csv, /rebuttal|OLD_REBUTTAL_SENTINEL/i);
  const rows = csv.split('\n');
  assert.equal(rows.length, 3);
  assert.ok(rows[0].endsWith('"Reasoning"'));
  assert.ok(rows[1].includes(legacy.explain.reasoning));
  assert.ok(rows[2].includes(current.explain.reasoning));
  assert.equal(rows[0].split(',').length, rows[1].split(',').length);
  assert.equal(rows[0].split(',').length, rows[2].split(',').length);
});
