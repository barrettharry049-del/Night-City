(function () {
  "use strict";

  function addClass(element, className) {
    if (!element) return;
    if ((" " + element.className + " ").indexOf(" " + className + " ") < 0) {
      element.className = element.className ? element.className + " " + className : className;
    }
  }

  function fixFooterAge() {
    var footer = document.querySelector("[data-sign-time]");
    var first = footer ? footer.querySelector("span:first-child") : null;
    if (!first) return;

    addClass(first, "data-age");
    first.innerHTML = first.innerHTML.replace(/^SIGNAL AGE/i, "DATA AGE");
  }

  fixFooterAge();
  setInterval(fixFooterAge, 1000);
})();
