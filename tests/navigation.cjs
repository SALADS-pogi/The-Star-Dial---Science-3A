// No dependencies: node --test tests/navigation.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'navigation.js'), 'utf8');
const sections = {
  home: 'Home', motivation: 'Warm-up', discussion: 'The big idea',
  dial: 'Star Dial', atlas: 'Constellation Atlas', explore: 'Free roam',
  lesson: 'Assessment', reflection: 'Reflection', teacher: 'Teacher dashboard'
};

// Model only the browser behaviors the router uses. Views and their descendants
// retain identity, and history traversal emits the same hashchange as a browser.
class Events {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(callback);
  }
  dispatchEvent(event) {
    event.defaultPrevented ??= false;
    event.preventDefault ??= function () { this.defaultPrevented = true; };
    for (const callback of this.listeners.get(event.type) || []) callback(event);
    return !event.defaultPrevented;
  }
}

function fixture({ hash = '', mobile = false } = {}) {
  const document = new Events();
  class Element extends Events {
    constructor(tag, id = '') {
      super();
      this.tagName = tag.toUpperCase();
      this.id = id;
      this.children = [];
      this.dataset = {};
      this.attributes = new Map();
      this.hidden = false;
      this.inert = false;
      this.textContent = '';
      const classes = new Set();
      this.classList = {
        contains: name => classes.has(name),
        toggle(name, force = !classes.has(name)) {
          if (force) classes.add(name); else classes.delete(name);
          return force;
        }
      };
    }
    append(child) { child.parentElement = this; this.children.push(child); return child; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    hasAttribute(name) { return this.attributes.has(name); }
    matches(selector) {
      if (selector === '[data-app-view]') return this.hasAttribute('data-app-view');
      if (selector === '.app') return this.classList.contains('app');
      if (selector === 'a[data-section]') return this.tagName === 'A' && !!this.dataset.section;
      if (selector === 'a[href^="#"]') return this.tagName === 'A' && (this.getAttribute('href') || '').startsWith('#');
      if (selector === 'h1, h2') return ['H1', 'H2'].includes(this.tagName);
      throw new Error(`Unsupported fixture selector: ${selector}`);
    }
    querySelectorAll(selector) {
      return this.children.flatMap(child => [
        ...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)
      ]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    closest(selector) {
      for (let element = this; element; element = element.parentElement) {
        if (element.matches(selector)) return element;
      }
      return null;
    }
    focus(options) { document.activeElement = this; this.focusOptions = options; }
  }
  document.body = new Element('body');
  document.activeElement = document.body;
  document.querySelectorAll = selector => document.body.querySelectorAll(selector);
  document.querySelector = selector => document.body.querySelector(selector);
  document.getElementById = id => {
    const visit = element => element.id === id ? element : element.children.map(visit).find(Boolean);
    return visit(document.body) || null;
  };
  const toggle = document.body.append(new Element('button', 'sidebarToggle'));
  const sidebar = document.body.append(new Element('nav', 'sidebar'));
  const overlay = document.body.append(new Element('div', 'appOverlay'));
  const app = document.body.append(new Element('div'));
  app.classList.toggle('app', true);
  const currentLabel = app.append(new Element('span', 'currentViewLabel'));
  const views = {}, headings = {}, links = {};
  for (const [id, title] of Object.entries(sections)) {
    const link = sidebar.append(new Element('a'));
    link.dataset.section = id;
    link.setAttribute('href', `#${id}`);
    links[id] = link;
    const view = app.append(new Element('section', id));
    view.dataset.viewTitle = title;
    view.setAttribute('data-app-view', '');
    headings[id] = view.append(new Element(id === 'home' ? 'h1' : 'h2'));
    views[id] = view;
  }
  const window = new Events();
  const media = new Events();
  media.matches = mobile;
  window.matchMedia = () => media;
  window.location = { hash };
  const entries = [hash];
  let index = 0;
  const traverse = offset => {
    const next = index + offset;
    if (next < 0 || next >= entries.length) return;
    const previous = window.location.hash;
    index = next;
    window.location.hash = entries[index];
    if (previous !== window.location.hash) window.dispatchEvent({ type: 'hashchange' });
  };
  window.history = {
    pushState(_state, _title, url) {
      entries.splice(index + 1, Infinity, url);
      index++;
      window.location.hash = url;
    },
    replaceState(_state, _title, url) { entries[index] = url; window.location.hash = url; },
    back: () => traverse(-1), forward: () => traverse(1),
    get length() { return entries.length; }
  };
  const scrolls = [], changes = [];
  window.scrollTo = options => scrolls.push(options);
  window.addEventListener('app:viewchange', event => changes.push(event.detail.view));
  class CustomEvent { constructor(type, init) { this.type = type; this.detail = init.detail; } }
  vm.runInNewContext(source, { document, window, CustomEvent });
  function click(target, options = {}) {
    const event = { type: 'click', target, button: 0, ...options };
    // Bubble through elements before the delegated document listener.
    for (let element = target; element; element = element.parentElement) element.dispatchEvent(event);
    document.dispatchEvent(event);
    return event;
  }
  function key(key, options = {}) {
    const event = { type: 'keydown', key, ...options };
    document.dispatchEvent(event);
    return event;
  }
  function hashChange(value) {
    window.location.hash = value;
    window.dispatchEvent({ type: 'hashchange' });
  }
  function breakpoint(matches) { media.matches = matches; media.dispatchEvent({ type: 'change' }); }
  function assertView(id) {
    assert.deepEqual(Object.keys(views).filter(key => !views[key].hidden), [id]);
    assert.deepEqual(Object.keys(links).filter(key => links[key].classList.contains('active')), [id]);
    for (const [key, link] of Object.entries(links)) {
      assert.equal(link.getAttribute('aria-current'), key === id ? 'page' : null);
    }
    assert.equal(currentLabel.textContent, sections[id]);
    assert.equal(document.title, `${sections[id]} · Star Dial`);
  }
  return { document, window, sidebar, toggle, overlay, app, views, headings, links,
    changes, scrolls, Element, click, key, hashChange, breakpoint, assertView };
}

test('initial route shows only Home and canonicalizes an empty hash without stealing focus', () => {
  const f = fixture();
  f.assertView('home');
  assert.equal(f.window.location.hash, '#home');
  assert.equal(f.window.history.length, 1);
  assert.equal(f.document.activeElement, f.document.body);
  assert.deepEqual(f.changes, ['home']);
  assert.equal(f.sidebar.inert, false);
});

test('each direct section hash opens its own view; invalid hashes fall back to Home', () => {
  for (const id of Object.keys(sections)) {
    const f = fixture({ hash: `#${id}` });
    f.assertView(id);
    assert.equal(f.window.history.length, 1);
  }
  for (const hash of ['#missing', '#%ZZ', '#constructor']) {
    const f = fixture({ hash });
    f.assertView('home');
    assert.equal(f.window.location.hash, '#home');
    assert.equal(f.window.history.length, 1);
  }
});

test('sidebar clicks change one view, URL, focus and scroll without duplicating history', () => {
  const f = fixture();
  for (const id of Object.keys(sections).slice(1)) {
    assert.equal(f.click(f.links[id]).defaultPrevented, true);
    f.assertView(id);
    assert.equal(f.window.location.hash, `#${id}`);
    assert.equal(f.document.activeElement, f.headings[id]);
    assert.equal(f.headings[id].getAttribute('tabindex'), '-1');
    assert.equal(f.headings[id].focusOptions.preventScroll, true);
    assert.equal(f.scrolls.at(-1).top, 0);
  }
  const entries = f.window.history.length, changes = f.changes.length;
  f.click(f.links.teacher);
  assert.equal(f.window.history.length, entries);
  assert.equal(f.changes.length, changes);
});

test('delegation handles nested content in a link created after router initialization', () => {
  const f = fixture({ hash: '#lesson' });
  const link = f.views.lesson.append(new f.Element('a'));
  link.setAttribute('href', '#dial');
  const span = link.append(new f.Element('span'));
  assert.equal(f.click(span).defaultPrevented, true);
  f.assertView('dial');
  assert.equal(f.document.activeElement, f.headings.dial);
});

test('switching to tools and back retains assessment input values and element identities', () => {
  const f = fixture({ hash: '#lesson' });
  const assessment = f.views.lesson;
  const answer = assessment.append(new f.Element('textarea'));
  answer.value = 'Earth moves around the Sun.';
  const phase = assessment.append(new f.Element('div'));
  phase.dataset.panel = 'observe';
  phase.classList.toggle('active', true);
  f.click(f.links.explore);
  f.click(f.links.dial);
  f.click(f.links.lesson);
  f.assertView('lesson');
  assert.equal(f.views.lesson, assessment);
  assert.equal(assessment.children[1], answer);
  assert.equal(answer.value, 'Earth moves around the Sun.');
  assert.equal(phase.classList.contains('active'), true);
});

test('Back, Forward and external hash changes restore routes and heading focus', () => {
  const f = fixture();
  f.click(f.links.explore);
  f.click(f.links.lesson);
  f.window.history.back();
  f.assertView('explore');
  assert.equal(f.document.activeElement, f.headings.explore);
  f.window.history.back();
  f.assertView('home');
  f.window.history.forward();
  f.assertView('explore');
  f.hashChange('#atlas');
  f.assertView('atlas');
  f.hashChange('#unknown');
  f.assertView('home');
  assert.equal(f.window.location.hash, '#home');
});

test('modified, download, external-target and unknown links retain native behavior', () => {
  const f = fixture();
  for (const options of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true },
    { altKey: true }, { button: 1 }]) {
    assert.equal(f.click(f.links.dial, options).defaultPrevented, false);
    f.assertView('home');
  }
  const link = f.views.home.append(new f.Element('a'));
  link.setAttribute('href', '#dial');
  link.setAttribute('download', '');
  assert.equal(f.click(link).defaultPrevented, false);
  link.removeAttribute('download');
  link.target = '_blank';
  assert.equal(f.click(link).defaultPrevented, false);
  link.target = '';
  link.setAttribute('href', '#unknown');
  assert.equal(f.click(link).defaultPrevented, false);
  f.assertView('home');
  assert.equal(f.window.history.length, 1);
});

test('mobile menu makes the inactive area inert and Escape or backdrop returns focus', () => {
  const f = fixture({ mobile: true });
  assert.equal(f.sidebar.inert, true);
  assert.equal(f.app.inert, false);
  f.toggle.focus();
  f.click(f.toggle);
  assert.equal(f.sidebar.inert, false);
  assert.equal(f.app.inert, true);
  assert.equal(f.toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(f.overlay.classList.contains('open'), true);
  assert.equal(f.document.body.classList.contains('menu-open'), true);
  f.links.explore.focus();
  assert.equal(f.key('Escape').defaultPrevented, true);
  assert.equal(f.document.activeElement, f.toggle);
  assert.equal(f.sidebar.inert, true);
  assert.equal(f.app.inert, false);
  assert.equal(f.toggle.getAttribute('aria-expanded'), 'false');
  f.click(f.toggle);
  f.links.lesson.focus();
  f.click(f.overlay);
  assert.equal(f.document.activeElement, f.toggle);
  assert.equal(f.sidebar.classList.contains('open'), false);
  assert.equal(f.document.body.classList.contains('menu-open'), false);
});

test('mobile keyboard focus wraps at menu edges; navigation and resizing close the menu', () => {
  const f = fixture({ mobile: true });
  f.toggle.focus();
  f.click(f.toggle);
  assert.equal(f.key('Tab', { shiftKey: true }).defaultPrevented, true);
  assert.equal(f.document.activeElement, f.links.teacher);
  assert.equal(f.key('Tab').defaultPrevented, true);
  assert.equal(f.document.activeElement, f.toggle);
  f.links.explore.focus();
  assert.equal(f.key('Tab').defaultPrevented, false);
  f.click(f.links.lesson);
  f.assertView('lesson');
  assert.equal(f.sidebar.inert, true);
  assert.equal(f.app.inert, false);
  assert.equal(f.document.activeElement, f.headings.lesson);
  f.click(f.toggle);
  f.breakpoint(false);
  assert.equal(f.sidebar.inert, false);
  assert.equal(f.app.inert, false);
  assert.equal(f.sidebar.classList.contains('open'), false);
  f.click(f.toggle);
  assert.equal(f.sidebar.classList.contains('open'), false);
  f.breakpoint(true);
  assert.equal(f.sidebar.inert, true);
});
