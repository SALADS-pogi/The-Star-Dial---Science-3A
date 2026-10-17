// Increment this version whenever app assets change.
const CACHE_VERSION = "v20";
// GitHub Pages projects share an origin; isolate caches by registration scope.
const CACHE_PREFIX = `star-dial:${self.registration.scope}:`;
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const FILES_TO_CACHE = [
  // ATLAS ASSETS START
  "./atlas-data.js",
  "./atlas.js",
  "./atlas.css",
  "./ATLAS_REFERENCES.md",
  "./assets/atlas/AND.gif",
  "./assets/atlas/ANT.gif",
  "./assets/atlas/APS.gif",
  "./assets/atlas/AQR.gif",
  "./assets/atlas/AQL.gif",
  "./assets/atlas/ARA.gif",
  "./assets/atlas/ARI.gif",
  "./assets/atlas/AUR.gif",
  "./assets/atlas/BOO.gif",
  "./assets/atlas/CAE.gif",
  "./assets/atlas/CAM.gif",
  "./assets/atlas/CNC.gif",
  "./assets/atlas/CVN.gif",
  "./assets/atlas/CMA.gif",
  "./assets/atlas/CMI.gif",
  "./assets/atlas/CAP.gif",
  "./assets/atlas/CAR.gif",
  "./assets/atlas/CAS.gif",
  "./assets/atlas/CEN.gif",
  "./assets/atlas/CEP.gif",
  "./assets/atlas/CET.gif",
  "./assets/atlas/CHA.gif",
  "./assets/atlas/CIR.gif",
  "./assets/atlas/COL.gif",
  "./assets/atlas/COM.gif",
  "./assets/atlas/CRA.gif",
  "./assets/atlas/CRB.gif",
  "./assets/atlas/CRV.gif",
  "./assets/atlas/CRT.gif",
  "./assets/atlas/CRU.gif",
  "./assets/atlas/CYG.gif",
  "./assets/atlas/DEL.gif",
  "./assets/atlas/DOR.gif",
  "./assets/atlas/DRA.gif",
  "./assets/atlas/EQU.gif",
  "./assets/atlas/ERI.gif",
  "./assets/atlas/FOR.gif",
  "./assets/atlas/GEM.gif",
  "./assets/atlas/GRU.gif",
  "./assets/atlas/HER.gif",
  "./assets/atlas/HOR.gif",
  "./assets/atlas/HYA.gif",
  "./assets/atlas/HYI.gif",
  "./assets/atlas/IND.gif",
  "./assets/atlas/LAC.gif",
  "./assets/atlas/LEO.gif",
  "./assets/atlas/LMI.gif",
  "./assets/atlas/LEP.gif",
  "./assets/atlas/LIB.gif",
  "./assets/atlas/LUP.gif",
  "./assets/atlas/LYN.gif",
  "./assets/atlas/LYR.gif",
  "./assets/atlas/MEN.gif",
  "./assets/atlas/MIC.gif",
  "./assets/atlas/MON.gif",
  "./assets/atlas/MUS.gif",
  "./assets/atlas/NOR.gif",
  "./assets/atlas/OCT.gif",
  "./assets/atlas/OPH.gif",
  "./assets/atlas/ORI.gif",
  "./assets/atlas/PAV.gif",
  "./assets/atlas/PEG.gif",
  "./assets/atlas/PER.gif",
  "./assets/atlas/PHE.gif",
  "./assets/atlas/PIC.gif",
  "./assets/atlas/PSC.gif",
  "./assets/atlas/PSA.gif",
  "./assets/atlas/PUP.gif",
  "./assets/atlas/PYX.gif",
  "./assets/atlas/RET.gif",
  "./assets/atlas/SGE.gif",
  "./assets/atlas/SGR.gif",
  "./assets/atlas/SCO.gif",
  "./assets/atlas/SCL.gif",
  "./assets/atlas/SCT.gif",
  "./assets/atlas/SERCP.gif",
  "./assets/atlas/SERCD.gif",
  "./assets/atlas/SEX.gif",
  "./assets/atlas/TAU.gif",
  "./assets/atlas/TEL.gif",
  "./assets/atlas/TRI.gif",
  "./assets/atlas/TRA.gif",
  "./assets/atlas/TUC.gif",
  "./assets/atlas/UMA.gif",
  "./assets/atlas/UMI.gif",
  "./assets/atlas/VEL.gif",
  "./assets/atlas/VIR.gif",
  "./assets/atlas/VOL.gif",
  "./assets/atlas/VUL.gif",
  // ATLAS ASSETS END
  "./",
  "./index.html",
  "./observatory.css",
  "./assets/fonts/oxanium-variable.ttf",
  "./assets/fonts/source-sans-3-variable.ttf",
  "./assets/fonts/oxanium-OFL.txt",
  "./assets/fonts/source-sans-3-OFL.txt",
  "./observer.js",
  "./BATAAN_REFERENCE.md",
  "./sources/deped-school-coordinates-2021.pdf",
  "./install.js",
  "./navigation.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(FILES_TO_CACHE.map(path => new Request(new URL(path, self.registration.scope), { cache: "reload" }))))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin ||
      !url.href.startsWith(self.registration.scope)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Serve one complete app version immediately, even on a stalled connection.
    const cached = await cache.match(event.request, { ignoreSearch: true });
    if (cached) return cached;
    if (event.request.mode === "navigate") {
      const app = await cache.match(new URL("./index.html", self.registration.scope).href);
      if (app) return app;
    }
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        // A full cache should not prevent a successful online response.
        await cache.put(event.request, response.clone()).catch(() => undefined);
      }
      return response;
    } catch {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      if (event.request.mode === "navigate") {
        const app = await cache.match(new URL("./index.html", self.registration.scope).href);
        if (app) return app;
      }
      return new Response("Offline", { status: 503, statusText: "Offline" });
    }
  })());
});

// Confirm every required file exists before showing the offline-ready indicator.
self.addEventListener("message", event => {
  if (event.data?.type !== "CHECK_OFFLINE") return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const files = await Promise.all(FILES_TO_CACHE.map(path => cache.match(new URL(path, self.registration.scope).href)));
    event.ports[0]?.postMessage({ ready: files.every(Boolean) });
  })());
});
