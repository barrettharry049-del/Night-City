(function () {
  const uplinkMs = 6 * 60 * 1000;
  const warningMs = 2 * uplinkMs;
  const cacheHoldMs = 2 * 60 * 60 * 1000;
  const source = "./live-data.js";
  let nextUplinkAt = Date.now() + uplinkMs;
  let loader = null;

  function liveData() {
    return window.RAINLINE_DATA || {};
  }

  function generatedAt() {
    const date = new Date(liveData().generatedAt || 0);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  function signalAgeMs() {
    const date = generatedAt();
    return date ? Math.max(0, Date.now() - date.getTime()) : Number.POSITIVE_INFINITY;
  }

  function holdLiveDataOpen() {
    const date = generatedAt();
    if (!date) return;

    const live = liveData();
    live.refreshIntervalSeconds = Math.floor(cacheHoldMs / 1000);
    live.nextRefreshAt = new Date(date.getTime() + cacheHoldMs).toISOString();
  }

  function formatAge() {
    const age = signalAgeMs();
    if (!Number.isFinite(age)) return "SIGNAL AGE --";

    const minutes = Math.floor(age / 60000);
    if (minutes < 60) return `SIGNAL AGE ${String(minutes).padStart(2, "0")}M`;
    return `SIGNAL AGE ${Math.floor(minutes / 60)}H`;
  }

  function formatCountdown() {
    const diffMs = nextUplinkAt - Date.now();
    if (diffMs <= 0) return "due now";

    const totalSeconds = Math.ceil(diffMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function needsAttention() {
    return signalAgeMs() > warningMs;
  }

  function refreshLiveData() {
    nextUplinkAt = Date.now() + uplinkMs;
    const script = document.createElement("script");
    script.src = `${source}?ts=${Date.now()}`;
    script.async = true;
    script.onload = () => {
      if (loader) loader.remove();
      loader = script;
      holdLiveDataOpen();
      window.dispatchEvent(new CustomEvent("rainline-data-updated", { detail: liveData() }));
    };
    script.onerror = () => {
      script.remove();
    };
    document.head.appendChild(script);
  }

  function paintFooter() {
    const time = document.querySelector("[data-sign-time]");
    if (!time || signalAgeMs() > cacheHoldMs) return;

    const warning = needsAttention();
    const colour = warning ? "rgba(255, 48, 88, 0.98)" : "rgba(124, 255, 178, 0.9)";
    const shadow = warning
      ? "1px 0 rgba(255,42,199,.72), -1px 0 rgba(76,225,255,.42), 0 0 14px rgba(255,48,88,.54)"
      : "0 0 9px rgba(124,255,178,.32)";

    time.innerHTML = `
      <span>${formatAge()}</span>
      <span class="${warning ? "is-warning" : ""}" style="color:${colour};text-shadow:${shadow};">NEXT UPLINK ${formatCountdown()}</span>
    `;

    const ticker = document.querySelector("[data-sign-ticker]");
    if (ticker) {
      ticker.textContent = ticker.textContent.replace(/NEXT SYNC [^/]+\/\//g, `NEXT UPLINK ${formatCountdown().toUpperCase()} //`);
    }
  }

  function tick() {
    holdLiveDataOpen();
    if (Date.now() >= nextUplinkAt) refreshLiveData();
    paintFooter();
  }

  holdLiveDataOpen();
  window.addEventListener("rainline-data-updated", holdLiveDataOpen);
  setInterval(tick, 500);
})();
