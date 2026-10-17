// No dependencies: node --test tests/offline.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const version = fs.readFileSync(path.join(root, 'sw.js'), 'utf8').match(/const CACHE_VERSION = "([^"]+)"/)[1];

function worker(scope = 'https://example.com/star-dial/') {
  const events = {}, stores = new Map();
  const key = request => typeof request === 'string' ? request : request.url;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async addAll(requests) {
          for (const request of requests) {
            const relative = new URL(key(request)).pathname.slice(new URL(scope).pathname.length) || 'index.html';
            assert.ok(fs.existsSync(path.join(root, relative)), `Missing offline asset: ${relative}`);
            entries.set(key(request), new Response(fs.readFileSync(path.join(root, relative))));
          }
        },
        async match(request, options = {}) {
          let url = key(request);
          if (options.ignoreSearch) url = url.split('?')[0];
          return entries.get(url)?.clone();
        },
        async put(request, response) { entries.set(key(request), response); }
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), {
    self: { registration: { scope }, location: new URL(scope), clients: { claim: async () => {} }, addEventListener: (name, fn) => events[name] = fn },
    caches, URL, Request, Response,
    fetch: async () => { throw new Error('No internet'); }
  });
  return { events, stores, scope };
}
async function lifecycle(fn) { let work; fn({ waitUntil: promise => work = promise }); await work; }

test('complete offline install works at root and GitHub repository paths', async () => {
  for (const scope of ['https://example.com/', 'https://example.com/star-dial/']) {
    const { events, stores } = worker(scope);
    await lifecycle(events.install);
    stores.set(`star-dial:${scope}:old`, new Map());
    stores.set('unrelated-app', new Map());
    await lifecycle(events.activate);
    assert.ok(stores.has('unrelated-app'));
    assert.ok(!stores.has(`star-dial:${scope}:old`));
    for (const [url, mode] of [['index.html', 'navigate'], ['?source=home', 'navigate'], ['observatory.css', 'cors'], ['assets/fonts/oxanium-variable.ttf', 'cors'], ['assets/fonts/source-sans-3-variable.ttf', 'cors'], ['observer.js', 'cors'], ['BATAAN_REFERENCE.md', 'cors'], ['sources/deped-school-coordinates-2021.pdf', 'cors'], ['install.js', 'cors'], ['navigation.js', 'cors'], ['atlas-data.js', 'cors'], ['atlas.js', 'cors'], ['atlas.css', 'cors'], ['ATLAS_REFERENCES.md', 'cors'], ['assets/atlas/ORI.gif', 'cors'], ['assets/atlas/SERCP.gif', 'cors'], ['assets/atlas/SERCD.gif', 'cors'], ['icon-192.png', 'cors'], ['icon-512.png', 'cors']]) {
      let result;
      events.fetch({ request: { url: new URL(url, scope).href, method: 'GET', mode }, respondWith: p => result = p });
      assert.equal((await result).status, 200, url);
    }
    let reply, work;
    events.message({ data: { type: 'CHECK_OFFLINE' }, ports: [{ postMessage: data => reply = data }], waitUntil: p => work = p });
    await work;
    assert.equal(reply.ready, true);
    stores.get(`star-dial:${scope}:${version}`).delete(new URL('install.js', scope).href);
    events.message({ data: { type: 'CHECK_OFFLINE' }, ports: [{ postMessage: data => reply = data }], waitUntil: p => work = p });
    await work;
    assert.equal(reply.ready, false);
  }
});

test('manifest and HTML point to bundled local files', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) assert.ok(fs.existsSync(path.join(root, icon.src)));
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const match of html.matchAll(/<(?:script|link|img)\b[^>]*\b(?:src|href)="([^"]+)"/g)) {
    assert.ok(!/^https?:/.test(match[1]), `External dependency: ${match[1]}`);
    if (!match[1].startsWith('data:')) assert.ok(fs.existsSync(path.join(root, match[1])), match[1]);
  }
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
});
