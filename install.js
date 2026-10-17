(() => {
  const status = document.getElementById("offline-status");
  const button = document.getElementById("install-app");
  let installPrompt;
  const standalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    button.hidden = !!standalone();
  });
  button.addEventListener("click", async () => {
    if (!installPrompt) return;
    button.hidden = true;
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } finally { installPrompt = null; }
  });
  window.addEventListener("appinstalled", () => { button.hidden = true; installPrompt = null; });

  async function checkOffline() {
    const worker = navigator.serviceWorker.controller;
    if (!worker) return;
    const channel = new MessageChannel();
    const timeout = setTimeout(() => {
      status.textContent = "Offline setup pending. Connect to the internet and reopen the app to finish setup.";
      channel.port1.close();
    }, 10000);
    channel.port1.onmessage = ({ data }) => {
      clearTimeout(timeout);
      channel.port1.close();
      status.textContent = data.ready
        ? "Ready for offline use"
        : "Offline files are incomplete. Connect to the internet and reload to finish setup.";
    };
    worker.postMessage({ type: "CHECK_OFFLINE" }, [channel.port2]);
  }
  if (!("serviceWorker" in navigator) || !window.isSecureContext) {
    status.textContent = "For installation and offline use, open the published HTTPS website in Safari or Chrome.";
    return;
  }
  navigator.serviceWorker.addEventListener("controllerchange", checkOffline);
  window.addEventListener("online", checkOffline);
  navigator.serviceWorker.register("./sw.js").then(registration => {
    if (registration.waiting) status.textContent = "Update downloaded. Close all Star Dial windows and reopen to apply it.";
    const installing = registration.installing;
    installing?.addEventListener("statechange", () => {
      if (installing.state === "redundant" && !navigator.serviceWorker.controller) {
        status.textContent = "Offline download failed. Connect to the internet and reload to retry.";
      }
    });
    return navigator.serviceWorker.ready;
  }).then(checkOffline).catch(() => {
    status.textContent = "Offline setup failed. Connect to the internet and reload; allow browser storage.";
  });
})();
