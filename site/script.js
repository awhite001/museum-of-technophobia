/* The Museum of Technophobia — interactivity.
   Written by the curator. Handle with care; it bites no one. */

(function () {
  "use strict";

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- panic meters: light segments per data-panic ---------- */
  document.querySelectorAll(".exhibit").forEach(function (ex) {
    var level = parseInt(ex.dataset.panic || "0", 10);
    ex.querySelectorAll(".meter i").forEach(function (seg, idx) {
      if (idx < level) seg.classList.add("lit");
    });
  });

  /* ---------- reveal on scroll + timeline + year plaque ---------- */
  var exhibits = Array.prototype.slice.call(document.querySelectorAll(".exhibit"));
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".timeline a"));
  var plaque = document.querySelector(".year-plaque");
  var plaqueYear = document.getElementById("yp-year");
  var typedStarted = false;

  function setActive(id, year) {
    navLinks.forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("href") === "#" + id);
    });
    if (year && plaqueYear) plaqueYear.textContent = year;
  }

  var revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("revealed");
      if (entry.target.id === "ex-15" && !typedStarted) {
        typedStarted = true;
        startTyping();
      }
    });
  }, { threshold: 0.15 });

  var activeObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      setActive(entry.target.id, entry.target.dataset.year);
    });
  }, { rootMargin: "-45% 0px -45% 0px" });

  exhibits.forEach(function (ex) {
    revealObserver.observe(ex);
    activeObserver.observe(ex);
  });

  /* plaque appears once the visitor leaves the lobby,
     and retires politely before the footer */
  if (plaque) {
    var mastVisible = true;
    var footVisible = false;
    var updatePlaque = function () {
      plaque.classList.toggle("visible", !mastVisible && !footVisible);
    };
    new IntersectionObserver(function (entries) {
      mastVisible = entries[0].isIntersecting;
      updatePlaque();
    }, { threshold: 0.1 }).observe(document.querySelector(".masthead"));
    new IntersectionObserver(function (entries) {
      footVisible = entries[0].isIntersecting;
      updatePlaque();
    }, { threshold: 0 }).observe(document.querySelector(".colophon"));
  }

  /* ---------- curator typing effect ---------- */
  function startTyping() {
    var body = document.getElementById("term-body");
    if (!body) return;
    var text = body.dataset.text || "";
    var cursor = body.querySelector(".term-cursor");

    if (reducedMotion) {
      body.insertBefore(document.createTextNode(text), cursor);
      return;
    }

    var i = 0;
    (function tick() {
      if (i >= text.length) return;
      /* type in small variable chunks so it reads as writing, not printing */
      var chunk = 1 + Math.floor(Math.random() * 2);
      body.insertBefore(document.createTextNode(text.slice(i, i + chunk)), cursor);
      i += chunk;
      var ch = text.charAt(i - 1);
      var delay = 14;
      if (ch === "." || ch === "!" || ch === "?") delay = 260;
      else if (ch === ",") delay = 120;
      else if (ch === "\n") delay = 200;
      setTimeout(tick, delay);
    })();
  }

  /* ---------- panic button ---------- */
  var panicBtn = document.getElementById("panic-btn");
  var overlay = document.getElementById("panic-overlay");
  var toast = document.getElementById("toast");
  var panicCount = 0;
  var toastTimer = null;

  var toastLines = [
    "That helped nothing. It rarely does.",
    "Still nothing. Panic is not cumulative.",
    "The museum admires your persistence.",
    "Exhibit XVI: The Visitor Who Kept Pressing the Button."
  ];

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove("show");
    }, 3200);
  }

  if (panicBtn) {
    panicBtn.addEventListener("click", function () {
      var line = toastLines[Math.min(panicCount, toastLines.length - 1)];
      panicCount++;

      if (reducedMotion) {
        showToast(line);
        return;
      }

      document.body.classList.add("panic");
      overlay.classList.remove("active");
      /* force restart of the flicker animation */
      void overlay.offsetWidth;
      overlay.classList.add("active");

      setTimeout(function () {
        overlay.classList.remove("active");
        document.body.classList.remove("panic");
        showToast(line);
      }, 950);
    });
  }

  /* ---------- footer year ---------- */
  var footYear = document.getElementById("foot-year");
  if (footYear) footYear.textContent = new Date().getFullYear();
})();
