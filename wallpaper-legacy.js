(function () {
  "use strict";

  var uplinkMs = 6 * 60 * 1000;
  var warningMs = 2 * uplinkMs;
  var cacheHoldMs = 2 * 60 * 60 * 1000;
  var defaultDuration = 10000;
  var generationDuration = 20000;
  var rnzLimit = 6;
  var nextUplinkAt = new Date().getTime() + uplinkMs;
  var slideStartedAt = new Date().getTime();
  var slideIndex = 0;
  var slides = [];
  var lastSlideKey = "";
  var loader = null;

  var fuelOrder = ["Hydro", "Geothermal", "Wind", "Solar", "Gas", "Co-Gen", "Battery", "Coal", "Diesel/Oil"];
  var sponsors = [
    "RAINLINE SYSTEMS // CITY DATA, ALWAYS WATCHING",
    "NEXUS WEATHER GRID // LIVE URBAN CONDITIONS",
    "CHROMA TRANSIT // MOVE THROUGH THE NIGHT",
    "SYNTHVISION OPTICS // RETUNE YOUR EYES",
    "NEON AUTHORITY // NOTICE THE FUTURE"
  ];

  var dom = {};
  var paidAd = {};
  var currentPaidAd = null;
  var forcedAd = queryValue("ad");

  var paidAds = [
    {
      tag: "REAL TASTE // REAL MEMORIES",
      logoHtml: wordmarkLogo("Coca-Cola", "#ff2645", "Coca-Cola"),
      name: "COCA-COLA",
      copy: "SINCE BEFORE WW III",
      primary: "#ffffff",
      secondary: "#ff2645",
      primarySoft: "rgba(255, 255, 255, 0.28)",
      secondarySoft: "rgba(255, 38, 69, 0.24)"
    },
    {
      tag: "MIDNIGHT BUCKET",
      logoHtml: wordmarkLogo("KFC", "#f6fbff", "KFC"),
      name: "KFC",
      copy: "HOT FOOD // COLD CITY",
      primary: "#f6fbff",
      secondary: "#ff2a35",
      primarySoft: "rgba(246, 251, 255, 0.22)",
      secondarySoft: "rgba(255, 42, 53, 0.24)"
    },
    {
      tag: "NETWORK BUY",
      logoHtml: wordmarkLogo("Spark", "#ff4fd8", "spark"),
      name: "SPARK",
      copy: "HELLO TOMORROW",
      primary: "#ff4fd8",
      secondary: "#62f0ff",
      primarySoft: "rgba(255, 79, 216, 0.26)",
      secondarySoft: "rgba(98, 240, 255, 0.2)"
    },
    {
      tag: "CHARGE PARTNER",
      logoHtml: wordmarkLogo("BP Charge", "#78ff84", "bp charge"),
      name: "BP CHARGE",
      copy: "RAPID EV CHARGING",
      primary: "#78ff84",
      secondary: "#fff06d",
      primarySoft: "rgba(120, 255, 132, 0.24)",
      secondarySoft: "rgba(255, 240, 109, 0.22)"
    },
    {
      tag: "DISTRICT AD",
      logoHtml: wordmarkLogo("Nike", "#ffffff", "NIKE"),
      name: "NIKE",
      copy: "JUST DO IT",
      primary: "#ffffff",
      secondary: "#62f0ff",
      primarySoft: "rgba(255, 255, 255, 0.24)",
      secondarySoft: "rgba(98, 240, 255, 0.18)"
    },
    {
      tag: "GALAXY OPTIC",
      logoHtml: wordmarkLogo("Samsung", "#c7d4ff", "SAMSUNG"),
      name: "SAMSUNG",
      copy: "SEE THE NIGHT DIFFERENTLY",
      primary: "#c7d4ff",
      secondary: "#b05cff",
      primarySoft: "rgba(199, 212, 255, 0.26)",
      secondarySoft: "rgba(176, 92, 255, 0.24)"
    },
    {
      tag: "THINK LESS.",
      logoHtml: wordmarkLogo("Apple", "#f7fbff", "APPLE"),
      name: "APPLE",
      copy: "BE A SHEEP",
      primary: "#f7fbff",
      secondary: "#d9d9e8",
      primarySoft: "rgba(247, 251, 255, 0.24)",
      secondarySoft: "rgba(217, 217, 232, 0.18)"
    },
    {
      tag: "DREAM FEED AVAILABLE",
      logoHtml: wordmarkLogo("Netflix", "#E50914", "NETFLIX"),
      name: "NETFLIX",
      copy: "CONTINUE WATCHING: YOUR LIFE, BUT NICE",
      primary: "#ff2634",
      secondary: "#f7fbff",
      primarySoft: "rgba(255, 38, 52, 0.28)",
      secondarySoft: "rgba(247, 251, 255, 0.18)"
    },
    {
      tag: "PUBLIC SAFETY NOTICE",
      logoHtml: wordmarkLogo("Public Safety Notice", "#ffea84", "02:00"),
      name: "CURFEW BEGINS",
      copy: "STAY IN LIT DISTRICTS",
      primary: "#ffea84",
      secondary: "#ff3058",
      primarySoft: "rgba(255, 234, 132, 0.26)",
      secondarySoft: "rgba(255, 48, 88, 0.26)"
    },
    {
      tag: "MOBILITY BUY",
      logoHtml: wordmarkLogo("Toyota", "#f6fbff", "TOYOTA"),
      name: "TOYOTA",
      copy: "LET'S GO PLACES",
      primary: "#f6fbff",
      secondary: "#ff335a",
      primarySoft: "rgba(246, 251, 255, 0.22)",
      secondarySoft: "rgba(255, 51, 90, 0.22)"
    }
  ];

  function bySelector(selector) {
    return document.querySelector(selector);
  }

  function liveData() {
    return window.RAINLINE_DATA || {};
  }

  function isArray(value) {
    return Object.prototype.toString.call(value) === "[object Array]";
  }

  function asArray(value) {
    return isArray(value) ? value : [];
  }

  function text(value) {
    if (value === null || typeof value === "undefined") return "";
    return String(value);
  }

  function escapeHtml(value) {
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function queryValue(name) {
    var search = window.location && window.location.search ? window.location.search.substring(1) : "";
    var parts = search ? search.split("&") : [];
    var i;
    var pair;
    for (i = 0; i < parts.length; i += 1) {
      pair = parts[i].split("=");
      if (decodeURIComponent(pair[0] || "") === name) {
        return decodeURIComponent((pair[1] || "").replace(/\+/g, " "));
      }
    }
    return "";
  }

  function wordmarkLogo(label, fill, word) {
    var size = word.length > 14 ? 22 : word.length > 9 ? 27 : 34;
    return "<svg viewBox=\"0 0 180 58\" role=\"img\" aria-label=\"" + escapeHtml(label) + "\">" +
      "<text class=\"logo-word\" x=\"90\" y=\"38\" fill=\"" + escapeHtml(fill) + "\" text-anchor=\"middle\" style=\"font-size:" + size + "px;\">" +
      escapeHtml(word) +
      "</text></svg>";
  }

  function truncate(value, limit) {
    var output = text(value).replace(/\s+/g, " ");
    if (output.length <= limit) return output;
    return output.substring(0, Math.max(0, limit - 7)).replace(/\s+\S*$/, "") + " [more]";
  }

  function numberValue(value, fallback) {
    var parsed = Number(value);
    return isFinite(parsed) ? parsed : fallback;
  }

  function formatMw(value) {
    var number = numberValue(value, 0);
    return Math.round(number).toLocaleString() + " MW";
  }

  function formatCompactMw(value) {
    var number = numberValue(value, 0);
    if (Math.abs(number) >= 1000) {
      return (number / 1000).toFixed(1).replace(/\.0$/, "") + "GW";
    }
    return Math.round(number) + "MW";
  }

  function parseDate(value) {
    var source;
    var date;
    var match;
    var milliseconds;
    var offsetSign;
    var offsetMinutes;
    var time;

    if (!value) return null;

    date = new Date(value);
    if (isFinite(date.getTime())) return date;

    source = text(value).replace(/^\s+|\s+$/g, "");
    source = source.replace(/\.(\d{3})\d+/, ".$1");
    date = new Date(source);
    if (isFinite(date.getTime())) return date;

    match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|([+-])(\d{2}):?(\d{2}))?$/.exec(source);
    if (!match) return null;

    milliseconds = match[7] || "0";
    while (milliseconds.length < 3) milliseconds += "0";

    time = Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6] || 0),
      Number(milliseconds)
    );

    if (match[8] && match[8] !== "Z") {
      offsetSign = match[9] === "-" ? -1 : 1;
      offsetMinutes = (Number(match[10]) * 60) + Number(match[11]);
      time -= offsetSign * offsetMinutes * 60000;
    }

    date = new Date(time);
    return isFinite(date.getTime()) ? date : null;
  }

  function generatedAt() {
    return parseDate(liveData().generatedAt);
  }

  function signalAgeMs() {
    var date = generatedAt();
    if (!date) return Number.POSITIVE_INFINITY;
    return Math.max(0, new Date().getTime() - date.getTime());
  }

  function formatSignalAge() {
    var age = signalAgeMs();
    if (!isFinite(age)) return "SIGNAL AGE --";
    var minutes = Math.floor(age / 60000);
    if (minutes < 60) return "SIGNAL AGE " + pad(minutes, 2) + "M";
    return "SIGNAL AGE " + Math.floor(minutes / 60) + "H";
  }

  function pad(value, length) {
    var output = String(value);
    while (output.length < length) output = "0" + output;
    return output;
  }

  function formatCountdown() {
    var diffMs = nextUplinkAt - new Date().getTime();
    if (diffMs <= 0) return "due now";
    var totalSeconds = Math.ceil(diffMs / 1000);
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    return minutes + ":" + pad(seconds, 2);
  }

  function hasFreshEnoughData() {
    return signalAgeMs() <= cacheHoldMs;
  }

  function needsAttention() {
    return signalAgeMs() > warningMs;
  }

  function dataRoot(name) {
    var data = liveData();
    return data && data[name] ? data[name] : {};
  }

  function getRenewables() {
    var transpower = dataRoot("transpower");
    return {
      percent: typeof transpower.renewablePercent !== "undefined" ? transpower.renewablePercent : "--",
      renewableMw: transpower.renewableMw || 0,
      totalMw: transpower.totalMw || 0,
      fuels: transpower.fuels || {},
      capacityMw: transpower.capacityMw || {},
      utilisation: transpower.utilisation || {},
      loadZones: transpower.loadZones || null
    };
  }

  function formatFuel(fuel, renewables) {
    var fuels = renewables.fuels || {};
    var capacities = renewables.capacityMw || {};
    var utilisation = renewables.utilisation || {};
    var current = numberValue(fuels[fuel], 0);
    var capacity = numberValue(capacities[fuel], 0);
    var percent = utilisation[fuel] && isFinite(Number(utilisation[fuel].percent))
      ? Number(utilisation[fuel].percent)
      : capacity > 0 ? (current / capacity) * 100 : null;

    if (capacity > 0 && percent !== null) {
      return formatCompactMw(current) + "/" + formatCompactMw(capacity) + " " + Math.round(percent) + "%";
    }
    return formatMw(current);
  }

  function buildGenerationBody(renewables) {
    var rows = "";
    var i;
    for (i = 0; i < fuelOrder.length; i += 1) {
      if (typeof renewables.fuels[fuelOrder[i]] !== "undefined" || typeof renewables.capacityMw[fuelOrder[i]] !== "undefined") {
        rows += "<div class=\"fuel-row\"><span>" + escapeHtml(fuelOrder[i]) + "</span><span>" + escapeHtml(formatFuel(fuelOrder[i], renewables)) + "</span></div>";
      }
    }

    return "<div class=\"fuel-total\">" +
      "<span>Total " + escapeHtml(formatMw(renewables.totalMw)) + "</span>" +
      "<span>Renewable " + escapeHtml(formatMw(renewables.renewableMw)) + "</span>" +
      "<span>Fuel MW / cap / use</span>" +
      "</div><div class=\"fuel-grid\">" + (rows || "Waiting for generation breakdown.") + "</div>";
  }

  function buildLoadBody(load) {
    var zones = asArray(load && load.zones).slice(0, 6);
    var rows = "";
    var i;
    for (i = 0; i < zones.length; i += 1) {
      rows += "<div class=\"data-row\"><strong>" + escapeHtml(zones[i].region || zones[i].zone || "Zone") + "</strong>" +
        "<span>" + escapeHtml(formatCompactMw(zones[i].mw)) + " PF " + numberValue(zones[i].powerFactor, 0).toFixed(2) + "</span></div>";
    }
    return rows || "<p class=\"data-note\">Load data waiting.</p>";
  }

  function newsArticles() {
    var rnz = dataRoot("rnz");
    var articles = asArray(rnz.articles);
    if (articles.length) return articles.slice(0, rnzLimit);
    if (rnz.title || rnz.summary) {
      return [{ rank: 1, title: rnz.title, summary: rnz.summary, feed: "RNZ" }];
    }
    return [];
  }

  function buildNewsBody(article) {
    return "<div class=\"news-card\"><p>" + escapeHtml(truncate(article.summary || "Waiting for RNZ feed.", 220)) + "</p></div>";
  }

  function buildGeoNetBody(geo) {
    var quakes = asArray(geo && geo.quakes);
    var volcanoes = asArray(geo && geo.volcanoes);
    var strongest = quakes.length ? quakes[0] : null;
    var rows = "";
    rows += "<div class=\"data-row\"><strong>Quakes</strong><span>" + quakes.length + " recent listed</span></div>";
    if (strongest) {
      rows += "<div class=\"data-block\"><strong>M" + escapeHtml(strongest.magnitude) + " " + escapeHtml(strongest.locality || "") + "</strong><span>" + escapeHtml(strongest.depthKm || "--") + "km deep</span></div>";
    }
    rows += "<div class=\"data-row\"><strong>Volcanoes</strong><span>" + volcanoes.length + " status feeds</span></div>";
    if (volcanoes.length) {
      rows += "<div class=\"data-block\"><strong>" + escapeHtml(volcanoes[0].title || "Volcano") + "</strong><span>Level " + escapeHtml(volcanoes[0].level) + " // " + escapeHtml(volcanoes[0].activity || "") + "</span></div>";
    }
    return rows;
  }

  function buildRoadBody(roadEvents) {
    var events = asArray(roadEvents && roadEvents.events).slice(0, 3);
    var rows = "";
    var i;
    for (i = 0; i < events.length; i += 1) {
      rows += "<div class=\"data-block\"><strong>" + escapeHtml(events[i].type || events[i].status || "Road event") + "</strong>" +
        "<span>" + escapeHtml(events[i].location || events[i].description || "Location waiting") + "</span></div>";
    }
    return rows || "<p class=\"data-note\">No current road events in the feed.</p>";
  }

  function buildTrafficBody(counts) {
    var sites = asArray(counts && counts.sites).slice(0, 4);
    var rows = "<p class=\"data-note\">Daily counted vehicles at selected NZTA telemetry sites.</p>";
    var i;
    rows += "<div class=\"data-row\"><strong>" + escapeHtml(counts && counts.region || "Traffic") + "</strong><span>" + escapeHtml(formatMw(counts && counts.total || 0)).replace(" MW", " vehicles") + "</span></div>";
    for (i = 0; i < sites.length; i += 1) {
      rows += "<div class=\"data-row\"><strong>" + escapeHtml(truncate(sites[i].description || "Site", 36)) + "</strong><span>" + Number(sites[i].total || 0).toLocaleString() + "</span></div>";
    }
    return rows;
  }

  function buildNemaBody(alerts) {
    var rows = "";
    var i;
    for (i = 0; i < alerts.length; i += 1) {
      rows += "<div class=\"data-block urgent\"><strong>" + escapeHtml(truncate(alerts[i].title || "Emergency alert", 64)) + "</strong>" +
        "<span>" + escapeHtml(truncate(alerts[i].summary || "", 128)) + "</span></div>";
    }
    return rows;
  }

  function moonIllumination() {
    var date = new Date();
    var lp = 2551443;
    var now = date.getTime() / 1000;
    var newMoon = new Date(2001, 0, 24, 13, 7, 0).getTime() / 1000;
    var phase = ((now - newMoon) % lp) / lp;
    return Math.round((1 - Math.abs(phase - 0.5) * 2) * 100);
  }

  function buildSystemBody() {
    return "<div class=\"data-row\"><strong>Luminance grid</strong><span>94%</span></div>" +
      "<div class=\"data-row\"><strong>Skybridge flow</strong><span>61%</span></div>" +
      "<div class=\"data-row\"><strong>Lower district signal</strong><span>88%</span></div>";
  }

  function addSlide(source, title, body, heartbeat, duration) {
    slides.push({
      source: source,
      title: title,
      body: body,
      heartbeat: heartbeat || "CITY PULSE",
      duration: duration || defaultDuration
    });
  }

  function buildSlides() {
    var renewables = getRenewables();
    var rnz = newsArticles();
    var geonet = dataRoot("geonet");
    var waka = dataRoot("wakaKotahi");
    var nema = dataRoot("nema");
    var alerts = asArray(nema.alerts);
    var i;

    slides = [];
    addSlide("TRANSPOWER GENERATION", renewables.percent + "% renewable", buildGenerationBody(renewables), "GRID PULSE", generationDuration);
    if (renewables.loadZones) addSlide("TRANSPOWER LOAD", "Operational zones", buildLoadBody(renewables.loadZones), "GRID PULSE", defaultDuration);

    for (i = 0; i < rnz.length; i += 1) {
      addSlide("RNZ " + (i + 1) + "/" + rnz.length, rnz[i].title || "RNZ headline", buildNewsBody(rnz[i]), "FEED SIGNAL", defaultDuration);
    }

    if (geonet && (asArray(geonet.quakes).length || asArray(geonet.volcanoes).length)) {
      addSlide("GEONET DATA", "Quakes + volcanoes", buildGeoNetBody(geonet), "SEISMIC NOISE", defaultDuration);
    }
    if (waka && waka.roadEvents) addSlide("WAKA KOTAHI", "Road events", buildRoadBody(waka.roadEvents), "ROAD FLOW", defaultDuration);
    if (waka && waka.trafficCounts) addSlide("TRAFFIC COUNTS", "Daily vehicle count", buildTrafficBody(waka.trafficCounts), "ROAD FLOW", defaultDuration);
    if (alerts.length) addSlide("NEMA ALERT", "Emergency notice", buildNemaBody(alerts), "SIGNAL LOSS", defaultDuration);

    addSlide("NIGHT CYCLE", "Moon " + moonIllumination() + "%", "<div class=\"data-row\"><strong>City music feed</strong><span>Playlist: Neon Melancholy</span></div><div class=\"data-row\"><strong>Sunrise</strong><span>Local feed waiting</span></div>", "NIGHT CYCLE", defaultDuration);
    addSlide("CITY INFRASTRUCTURE", "Deep City System", buildSystemBody(), "CITY HEART", defaultDuration);

    if (!slides.length) {
      addSlide("CITY SIGNAL", "NO FRESH DATA", "<div class=\"issue-slide\"><p>No cached feed is available yet.</p></div>", "SIGNAL LOSS", defaultDuration);
    }
  }

  function asciiBars(value) {
    var filled = Math.max(0, Math.min(10, Math.round(value)));
    var output = "";
    var i;
    for (i = 0; i < 10; i += 1) output += i < filled ? "#" : "-";
    return output;
  }

  function heartbeatValue(slide) {
    var source = (slide.source + " " + slide.title).toLowerCase();
    var renewables = getRenewables();
    if (source.indexOf("road") >= 0 || source.indexOf("traffic") >= 0 || source.indexOf("waka") >= 0) return 6;
    if (source.indexOf("geonet") >= 0 || source.indexOf("quake") >= 0) return 4;
    if (source.indexOf("rnz") >= 0) return 8;
    if (source.indexOf("transpower") >= 0 || source.indexOf("grid") >= 0) return Math.max(2, Math.min(10, numberValue(renewables.percent, 50) / 10));
    return 7;
  }

  function setClass(element, className) {
    if (element) element.className = className;
  }

  function addClass(element, className) {
    if (!element) return;
    if ((" " + element.className + " ").indexOf(" " + className + " ") < 0) {
      element.className = element.className ? element.className + " " + className : className;
    }
  }

  function removeClass(element, className) {
    if (!element) return;
    element.className = (" " + element.className + " ").replace(" " + className + " ", " ").replace(/^\s+|\s+$/g, "");
  }

  function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function randomBetween(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function randomChoice(list) {
    if (!list || !list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
  }

  function nextFrame(callback) {
    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(callback);
    } else {
      setTimeout(callback, 16);
    }
  }

  function renderFooter() {
    var warning = needsAttention();
    var colour = warning ? "rgba(255, 48, 88, 0.98)" : "rgba(124, 255, 178, 0.9)";
    var shadow = warning ? "1px 0 rgba(255,42,199,.72), -1px 0 rgba(76,225,255,.42), 0 0 14px rgba(255,48,88,.54)" : "0 0 9px rgba(124,255,178,.32)";
    if (dom.time) {
      dom.time.innerHTML = "<span>" + escapeHtml(formatSignalAge()) + "</span>" +
        "<span style=\"color:" + colour + ";text-shadow:" + shadow + ";\">NEXT UPLINK " + escapeHtml(formatCountdown()) + "</span>";
    }
  }

  function renderTicker(slide) {
    var textValue = "GRID " + (dataRoot("transpower").renewablePercent ? "OK" : "WAIT") +
      " // RNZ " + (newsArticles().length ? "FEED OK" : "WAIT") +
      " // NEXT UPLINK " + formatCountdown().toUpperCase() +
      " // RAINLINE CITY NETWORK // PUBLIC DATA STREAM // SIGNAL STABLE";
    if (dom.ticker) dom.ticker.innerHTML = escapeHtml(textValue + " // " + textValue);
  }

  function renderSlide(force) {
    var now = new Date().getTime();
    var slide;
    var key;
    if (!slides.length) buildSlides();

    slide = slides[slideIndex % slides.length];
    if (!hasFreshEnoughData()) {
      slide = {
        source: "CITY SIGNAL",
        title: "NO FRESH DATA",
        body: "<div class=\"issue-slide\"><p>Cached city data is more than two hours old.</p></div>",
        heartbeat: "SIGNAL LOSS",
        duration: defaultDuration
      };
    }

    if (now - slideStartedAt > slide.duration) {
      slideStartedAt = now;
      slideIndex = (slideIndex + 1) % Math.max(1, slides.length);
      slide = slides[slideIndex];
      force = true;
    }

    key = slide.source + "|" + slide.title + "|" + slideIndex;
    if (force || key !== lastSlideKey) {
      lastSlideKey = key;
      if (dom.shell) setClass(dom.shell, "billboard-shell" + (slide.source === "CITY SIGNAL" ? " signal-lost" : ""));
      if (dom.source) dom.source.innerHTML = escapeHtml(slide.source);
      if (dom.title) dom.title.innerHTML = escapeHtml(slide.title);
      if (dom.sponsor) dom.sponsor.innerHTML = escapeHtml(sponsors[slideIndex % sponsors.length]);
      if (dom.body) dom.body.innerHTML = slide.body;
    }

    updateHeartbeat(slide);
    renderTicker(slide);
    renderFooter();
  }

  function updateHeartbeat(slide) {
    var value = heartbeatValue(slide);
    var progress = Math.min(1, (new Date().getTime() - slideStartedAt) / Math.max(1000, slide.duration));
    var shown = Math.max(1, value * progress);
    if (dom.heartbeatLabel) dom.heartbeatLabel.innerHTML = escapeHtml(slide.heartbeat);
    if (dom.heartbeatFill) dom.heartbeatFill.style.width = Math.max(3, shown * 10) + "%";
    if (dom.heartbeatBars) dom.heartbeatBars.innerHTML = asciiBars(shown);
  }

  function paidAdViewportSize(min, ratio, max) {
    return clampNumber(window.innerWidth * ratio, min, max);
  }

  function setPaidAdBaseSizes(ad) {
    var tagLength;
    var nameLength;
    var copyLength;
    var tagSize;
    var nameSize;
    var copySize;
    if (!paidAd.slot) return;

    tagLength = text(ad.tag).length;
    nameLength = text(ad.name).length;
    copyLength = text(ad.copy).length;

    tagSize = paidAdViewportSize(5, 0.0045, 9);
    nameSize = paidAdViewportSize(7, 0.0068, 13);
    copySize = paidAdViewportSize(6, 0.0062, 12);

    if (tagLength > 22) tagSize *= 0.84;
    else if (tagLength > 15) tagSize *= 0.92;

    if (nameLength > 12) nameSize *= 0.9;
    if (copyLength > 34) copySize *= 0.76;
    else if (copyLength > 25) copySize *= 0.88;

    paidAd.slot.style.setProperty("--paid-ad-tag-size", clampNumber(tagSize, 4, 9).toFixed(1) + "px");
    paidAd.slot.style.setProperty("--paid-ad-name-size", clampNumber(nameSize, 5.5, 13).toFixed(1) + "px");
    paidAd.slot.style.setProperty("--paid-ad-copy-size", clampNumber(copySize, 4.2, 12).toFixed(1) + "px");
    paidAd.slot.style.setProperty("--paid-ad-logo-scale", copyLength > 30 || tagLength > 20 ? "62%" : "70%");
  }

  function shrinkPaidAdText(element, propertyName, minSize) {
    var style;
    var size;
    var attempts = 0;
    if (!element || !paidAd.slot || !window.getComputedStyle) return;

    style = window.getComputedStyle(element, null);
    size = parseFloat(style && style.fontSize ? style.fontSize : "8");

    while (
      attempts < 16 &&
      size > minSize &&
      (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)
    ) {
      size -= 0.5;
      paidAd.slot.style.setProperty(propertyName, Math.max(minSize, size).toFixed(1) + "px");
      attempts += 1;
    }
  }

  function fitPaidAdText() {
    if (!paidAd.slot || !paidAd.frame) return;
    shrinkPaidAdText(paidAd.tag, "--paid-ad-tag-size", 4);
    shrinkPaidAdText(paidAd.name, "--paid-ad-name-size", 5.5);
    shrinkPaidAdText(paidAd.copy, "--paid-ad-copy-size", 4.2);
  }

  function setPaidAd(ad) {
    if (!ad || !paidAd.slot || !paidAd.frame) return;

    currentPaidAd = ad;
    setPaidAdBaseSizes(ad);
    if (paidAd.tag) paidAd.tag.innerHTML = escapeHtml(ad.tag);
    if (paidAd.logo) paidAd.logo.innerHTML = ad.logoHtml;
    if (paidAd.name) paidAd.name.innerHTML = escapeHtml(ad.name);
    if (paidAd.copy) paidAd.copy.innerHTML = escapeHtml(ad.copy);
    paidAd.slot.style.setProperty("--ad-primary", ad.primary);
    paidAd.slot.style.setProperty("--ad-secondary", ad.secondary);
    paidAd.slot.style.setProperty("--ad-primary-soft", ad.primarySoft);
    paidAd.slot.style.setProperty("--ad-secondary-soft", ad.secondarySoft);

    nextFrame(function () {
      nextFrame(fitPaidAdText);
    });
  }

  function choosePaidAd() {
    var target;
    var i;
    var haystack;
    if (forcedAd) {
      target = forcedAd.toLowerCase();
      for (i = 0; i < paidAds.length; i += 1) {
        haystack = (paidAds[i].tag + " " + paidAds[i].name + " " + paidAds[i].copy).toLowerCase();
        if (haystack.indexOf(target) >= 0) return paidAds[i];
      }
    }
    return randomChoice(paidAds);
  }

  function showPaidAd() {
    if (!paidAd.slot) return;
    setPaidAd(choosePaidAd());
    removeClass(paidAd.slot, "is-active");
    if (paidAd.slot.getBoundingClientRect) paidAd.slot.getBoundingClientRect();
    addClass(paidAd.slot, "is-active");
    setTimeout(function () {
      removeClass(paidAd.slot, "is-active");
    }, 6000);
  }

  function schedulePaidAds() {
    setTimeout(function () {
      showPaidAd();
      schedulePaidAds();
    }, randomBetween(6500, 18000));
  }

  function loadFreshData() {
    var script = document.createElement("script");
    nextUplinkAt = new Date().getTime() + uplinkMs;
    script.src = "./live-data.js?ts=" + new Date().getTime();
    script.async = true;
    script.onload = function () {
      if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
      loader = script;
      buildSlides();
      renderSlide(true);
    };
    script.onerror = function () {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
    document.getElementsByTagName("head")[0].appendChild(script);
  }

  function tick() {
    if (new Date().getTime() >= nextUplinkAt) loadFreshData();
    renderSlide(false);
  }

  function initDom() {
    dom.video = document.getElementById("background-video");
    dom.shell = bySelector(".billboard-shell");
    dom.source = bySelector("[data-sign-source]");
    dom.title = bySelector("[data-sign-title]");
    dom.sponsor = bySelector("[data-sign-sponsor]");
    dom.heartbeatLabel = bySelector("[data-heartbeat-label]");
    dom.heartbeatFill = bySelector("[data-heartbeat-fill]");
    dom.heartbeatBars = bySelector("[data-heartbeat-bars]");
    dom.body = bySelector("[data-sign-body]");
    dom.ticker = bySelector("[data-sign-ticker]");
    dom.time = bySelector("[data-sign-time]");
    paidAd.slot = bySelector(".paid-ad-slot");
    paidAd.frame = bySelector("[data-paid-ad-frame]");
    paidAd.tag = bySelector("[data-paid-ad-tag]");
    paidAd.logo = bySelector("[data-paid-ad-logo]");
    paidAd.name = bySelector("[data-paid-ad-name]");
    paidAd.copy = bySelector("[data-paid-ad-copy]");
  }

  function start() {
    initDom();
    if (dom.video && dom.video.play) {
      try {
        var playResult = dom.video.play();
        if (playResult && playResult.catch) playResult.catch(function () {});
      } catch (ignore) {}
    }
    buildSlides();
    renderSlide(true);
    showPaidAd();
    schedulePaidAds();
    if (window.addEventListener) {
      window.addEventListener("resize", function () {
        if (!currentPaidAd) return;
        setPaidAdBaseSizes(currentPaidAd);
        nextFrame(fitPaidAdText);
      });
    }
    setInterval(tick, 1000);
  }

  start();
})();
