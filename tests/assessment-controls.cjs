const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('warm-up and reflection choices do not change assessment answers', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const start = html.indexOf('// ---- PREDICT ----');
  const end = html.indexOf('document.getElementById("predictNext").addEventListener', start);
  assert.ok(start >= 0 && end > start);
  function button(section, type, dataset) {
    const handlers = {}, classes = new Set();
    return {
      section, type, dataset,
      addEventListener(name, handler) { handlers[name] = handler; },
      classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
      selected: () => classes.has('selected'),
      click() { handlers.click?.(); }
    };
  }
  const yes = button('lesson', 'yesno-btn', { yn: 'yes' });
  const no = button('lesson', 'yesno-btn', { yn: 'no' });
  const confidence = button('lesson', 'conf-btn', { conf: 'high' });
  const warmup = button('motivation', 'yesno-btn', { hook: 'earth' });
  const reflection = button('reflection', 'conf-btn', { rconf: 'low' });
  const buttons = [yes, no, confidence, warmup, reflection];
  const state = { predict: {} };
  const document = {
    querySelectorAll(selector) {
      return buttons.filter(b => selector.includes(`.${b.type}`) &&
        (!selector.includes('#lesson') || b.section === 'lesson') &&
        (!selector.includes('[data-yn]') || 'yn' in b.dataset) &&
        (!selector.includes('[data-conf]') || 'conf' in b.dataset));
    },
    getElementById() { return { addEventListener() {} }; }
  };
  vm.runInNewContext(html.slice(start, end), { document, state });
  yes.click();
  confidence.click();
  warmup.click();
  reflection.click();
  assert.deepEqual(state.predict, { answer: 'yes', confidence: 'high' });
  assert.ok(yes.selected());
  assert.ok(confidence.selected());
  no.click();
  assert.equal(state.predict.answer, 'no');
  assert.equal(yes.selected(), false);
  assert.ok(no.selected());
});
