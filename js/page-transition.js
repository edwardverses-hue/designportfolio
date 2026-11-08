/* The project card on the home page becomes its case study's hero, and back.
   The names are on the elements and the motion is in style.css under VIEW
   TRANSITIONS.

   A named element is lifted out of the page onto its own layer, above the
   page and so above the header. So just before each transition, on both
   pages, only the one element that has a partner on the other side keeps
   its name: a card when going to (or coming from) its own case study, the
   hero when going to (or coming from) the home page. Every other card stays
   in the page, under the header, and fades with it.

   The partner also has to be on screen. The browser pairs the two wherever
   they are, so a hero scrolled far up the page, or a card below the fold,
   would streak across the screen to meet it.

   Names come back once the transition is over, ready for the next one.

   Loaded in the head without defer: pagereveal fires before deferred
   scripts run. */
(function () {
  // Whatever carries a name: the card and hero boxes for the films, and the
  // phones picture itself for Sessions, whose card and hero differ in shape.
  var SEL = '[style*="view-transition-name"]';

  function each(fn) { [].forEach.call(document.querySelectorAll(SEL), fn); }

  // The page at a URL, without its hash, with /index.html and / the same.
  function page(url) {
    var u = new URL(url, location.href);
    return u.origin + u.pathname.replace(/index\.html$/, '');
  }

  // A card leads to its case study; the hero leads home.
  function partner(el) {
    var link = el.closest('a[href]') || document.querySelector('.nav-logo');
    return link ? page(link.href) : null;
  }

  function onScreen(el) {
    var r = el.getBoundingClientRect(), h = window.innerHeight;
    var shown = Math.min(r.bottom, h) - Math.max(r.top, 0);
    return shown >= Math.min(r.height, h) / 3;
  }

  // other: the page on the far side of this transition, if the browser says.
  function pair(other) {
    var there = other ? page(other) : null;
    each(function (el) {
      var keep = onScreen(el) && (!there || partner(el) === there);
      el.classList.toggle('vt-off', !keep);
    });
  }
  function nameAll() { each(function (el) { el.classList.remove('vt-off'); }); }

  // Leaving: measured where the reader left the page.
  window.addEventListener('pageswap', function (e) {
    if (!e.viewTransition) return;
    var entry = e.activation && e.activation.entry;
    pair(entry && entry.url);
  });

  // Arriving, or coming back from the back/forward cache with names a
  // previous swap took away.
  window.addEventListener('pagereveal', function (e) {
    nameAll();
    if (!e.viewTransition) return;
    var act = window.navigation && navigation.activation;
    pair(act && act.from && act.from.url);
    e.viewTransition.finished.then(nameAll, nameAll);
  });
})();
