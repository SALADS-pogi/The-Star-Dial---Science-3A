// Each section stays mounted so switching views preserves student work and sky controls.
(() => {
  const views = Array.from(document.querySelectorAll('[data-app-view]'));
  const byId = new Map(views.map(view => [view.id, view]));
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebarToggle');
  const overlay = document.getElementById('appOverlay');
  const app = document.querySelector('.app');
  const links = Array.from(sidebar.querySelectorAll('a[data-section]'));
  const currentLabel = document.getElementById('currentViewLabel');
  const mobile = window.matchMedia('(max-width: 860px)');
  let activeId;

  function setMenu(open, returnFocus = false) {
    open = open && mobile.matches;
    sidebar.classList.toggle('open', open);
    overlay.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    sidebar.inert = mobile.matches && !open;
    app.inert = open;
    document.body.classList.toggle('menu-open', open);
    if (returnFocus) toggle.focus();
  }

  function routeId() {
    const id = window.location.hash.slice(1);
    return byId.has(id) ? id : 'home';
  }

  function showView(id, focus = true) {
    const view = byId.get(id);
    if (!view) return;
    views.forEach(item => { item.hidden = item !== view; });
    links.forEach(link => {
      const selected = link.dataset.section === id;
      link.classList.toggle('active', selected);
      if (selected) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    currentLabel.textContent = view.dataset.viewTitle;
    document.title = `${view.dataset.viewTitle} · Star Dial`;
    setMenu(false);
    if (focus) {
      const heading = view.querySelector('h1, h2');
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (activeId !== id) {
      activeId = id;
      window.dispatchEvent(new CustomEvent('app:viewchange', { detail: { view: id } }));
    }
  }

  function readRoute(focus = true) {
    const id = routeId();
    if (window.location.hash !== `#${id}`) {
      window.history.replaceState(null, '', `#${id}`);
    }
    showView(id, focus);
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
        link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const id = link.getAttribute('href').slice(1);
    if (!byId.has(id)) return;
    event.preventDefault();
    if (window.location.hash !== `#${id}`) window.history.pushState(null, '', `#${id}`);
    showView(id);
  });
  window.addEventListener('hashchange', () => readRoute());
  toggle.addEventListener('click', () => setMenu(!sidebar.classList.contains('open')));
  overlay.addEventListener('click', () => setMenu(false, true));
  document.addEventListener('keydown', event => {
    if (!sidebar.classList.contains('open')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setMenu(false, true);
    } else if (event.key === 'Tab') {
      const stops = [toggle, ...links];
      const index = stops.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) {
        event.preventDefault();
        stops[stops.length - 1].focus();
      } else if (!event.shiftKey && (index === stops.length - 1 || index < 0)) {
        event.preventDefault();
        toggle.focus();
      }
    }
  });
  mobile.addEventListener('change', () => setMenu(false));
  readRoute(false);
})();
