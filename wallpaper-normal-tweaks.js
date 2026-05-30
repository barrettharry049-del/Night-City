(function () {
  "use strict";

  var extraSlideMs = 5000;
  var baseSlideMs = 10000;
  var fallbackUplinkMs = 6 * 60 * 1000;
  var fallbackNextUplinkAt = Date.now() + fallbackUplinkMs;

  function isCallable(value) {
    return typeof value === "function";
  }

  function safeHtml(value) {
    if (typeof escapeHtml === "function") return escapeHtml(value);
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function safeCountdown(target) {
    if (typeof formatCountdown === "function") return formatCountdown(target).toUpperCase();
    if (!target) return "WAITING";
    var diffMs = target.getTime() - Date.now();
    if (diffMs <= -15000) return "REFRESH DUE";
    if (diffMs <= 0) return "DUE NOW";
    var totalSeconds = Math.ceil(diffMs / 1000);
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    return minutes + ":" + String(seconds).padStart(2, "0");
  }

  function safeDataAge() {
    if (typeof formatSignalAge === "function") {
      return formatSignalAge().replace(/^SIGNAL AGE/i, "DATA AGE");
    }

    if (!window.RAINLINE_DATA || !window.RAINLINE_DATA.generatedAt) return "DATA AGE --";
    var generatedAt = new Date(window.RAINLINE_DATA.generatedAt);
    if (!Number.isFinite(generatedAt.getTime())) return "DATA AGE --";
    var minutes = Math.max(0, Math.floor((Date.now() - generatedAt.getTime()) / 60000));
    if (minutes < 60) return "DATA AGE " + String(minutes).padStart(2, "0") + "M";
    return "DATA AGE " + Math.floor(minutes / 60) + "H";
  }

  function nextSyncTarget(forceWarning) {
    if (forceWarning && typeof nextReconnectDate === "function") return nextReconnectDate();
    if (typeof nextRefreshDate === "function") return nextRefreshDate();
    if (window.RAINLINE_DATA && window.RAINLINE_DATA.nextRefreshAt) {
      var nextRefresh = new Date(window.RAINLINE_DATA.nextRefreshAt);
      if (Number.isFinite(nextRefresh.getTime())) return nextRefresh;
    }
    if (typeof nextUplinkDate === "function") return nextUplinkDate();
    return fallbackNextUplink();
  }

  function fallbackNextUplink() {
    if (Date.now() >= fallbackNextUplinkAt) {
      fallbackNextUplinkAt = Date.now() + fallbackUplinkMs;
    }
    return new Date(fallbackNextUplinkAt);
  }

  function fallbackNeedsAttention() {
    var shell = document.querySelector(".billboard-shell");
    if (shell && String(shell.className || "").indexOf("signal-lost") >= 0) return true;
    if (!window.RAINLINE_DATA || !window.RAINLINE_DATA.generatedAt) return false;

    var generatedAt = new Date(window.RAINLINE_DATA.generatedAt);
    if (!Number.isFinite(generatedAt.getTime())) return true;
    return Date.now() - generatedAt.getTime() > 12 * 60 * 1000;
  }

  function footerHtml(forceWarning) {
    var warning = Boolean(forceWarning || (typeof uplinkNeedsAttention === "function" ? uplinkNeedsAttention() : fallbackNeedsAttention()));
    var warningClass = warning ? " is-warning" : "";
    var uplinkTarget = typeof nextUplinkDate === "function" ? nextUplinkDate() : fallbackNextUplink();

    return [
      '<span class="data-age">' + safeHtml(safeDataAge()) + "</span>",
      '<span class="uplink-countdown' + warningClass + '">NEXT UPLINK ' + safeHtml(safeCountdown(uplinkTarget)) + "</span>"
    ].join("");
  }

  function renderFooterDom() {
    var target = document.querySelector("[data-sign-time]");
    if (target) target.innerHTML = footerHtml(false);
  }

  if (typeof buildRefreshFooterHtml === "function") {
    buildRefreshFooterHtml = footerHtml;
  }

  if (typeof buildIssueSlide === "function") {
    var originalBuildIssueSlide = buildIssueSlide;
    buildIssueSlide = function (issue) {
      var slide = originalBuildIssueSlide(issue);
      slide.timeHtml = footerHtml(true);
      return slide;
    };
  }

  if (typeof buildBaseSlides === "function") {
    var originalBuildBaseSlides = buildBaseSlides;
    buildBaseSlides = function () {
      var slides = originalBuildBaseSlides();
      return slides.map(function (slide) {
        var duration = Number(slide.durationMs || baseSlideMs);
        return Object.assign({}, slide, { durationMs: duration + extraSlideMs });
      });
    };
  }

  try {
    rotationPlan = null;
  } catch (ignore) {}

  if (typeof renderSlide === "function") {
    renderSlide();
  }

  renderFooterDom();
  setInterval(renderFooterDom, 1000);
})();
