/* The project card on the home page becomes its case study's hero, and back.
   The names are on the elements and the motion is in style.css under VIEW
   TRANSITIONS.

   The browser pairs the two by name wherever they are, so a hero scrolled
   far up the page, or a card below the fold, would streak across the screen
   to meet its partner. So just before each transition, on both pages, a card
   or hero that is mostly off screen sits it out (.vt-off) and fades with the
   page instead. It takes its name back once the transition is over.

   Loaded in the head without defer: pagereveal fires before deferred
   scripts run. */
(function () {
  var SEL = '.project-card, .case-hero-image';

  function each(fn) { [].forEach.call(document.querySelectorAll(SEL), fn); }

  function sitOutOffScreen() {
    var h = window.innerHeight;
    each(function (el) {
      var r = el.getBoundingClientRect();
      var shown = Math.min(r.bottom, h) - Math.max(r.top, 0);
      el.classList.toggle('vt-off', shown < Math.min(r.height, h) / 3);
    });
  }
  function nameAll() { each(function (el) { el.classList.remove('vt-off'); }); }

  // Leaving: the outgoing page is measured where the reader left it.
  window.addEventListener('pageswap', function (e) {
    if (e.viewTransition) sitOutOffScreen();
  });

  // Arriving, or coming back from the back/forward cache with names a
  // previous swap took away.
  window.addEventListener('pagereveal', function (e) {
    nameAll();
    if (!e.viewTransition) return;
    sitOutOffScreen();
    e.viewTransition.finished.then(nameAll, nameAll);
  });
})();
