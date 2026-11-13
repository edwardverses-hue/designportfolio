/* A film in place of a still: the CVS and Gemini banners and their cards
   on the home page. Each video carries a poster, so the page shows a
   picture at once and keeps showing it where the film can't play.

   A film with loop (CVS) runs continuously. One without (Gemini) builds
   once and holds its last frame, and builds again only when it comes back
   into view, so it never blanks out between loops.

   It plays only while it's on screen, holds while it's off, and never
   plays for a reader whose system asks for reduced motion: they get the
   poster. The CVS page's Pause motion control holds it too. */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var films = [].slice.call(document.querySelectorAll('video[data-film]'));
  if (!films.length) return;

  function paused() { return document.body.classList.contains('motion-paused'); }

  // Arriving from a film's own case study, its banner has just shrunk into
  // the card showing the finished picture. Building it again from blank
  // would undo that, so a film that builds once keeps the finished picture
  // the first time it is seen, and builds as usual whenever it comes back.
  var built = new Set();
  var from = window.navigation && navigation.activation && navigation.activation.from;
  if (from && from.url) {
    var fromPage = new URL(from.url).pathname;
    films.forEach(function (v) {
      var a = v.closest('a[href]');
      if (!v.loop && a && new URL(a.href, location.href).pathname === fromPage) built.add(v);
    });
  }

  var seen = new Map();
  function sync(v, entered) {
    if (reduce || paused() || !seen.get(v)) { if (!v.paused) v.pause(); return; }
    // Carried over from the other page by js/page-transition.js: a film that
    // had finished holds its last frame; one under way carries on from there.
    if (entered && v.dataset.carried) {
      var held = v.dataset.carried === 'held';
      delete v.dataset.carried; built.delete(v);
      if (held) return;
    } else if (entered && built.has(v)) { built.delete(v); return; }
    if (!v.loop && v.ended) { if (!entered) return; v.currentTime = 0; }
    if (v.preload !== 'auto') v.preload = 'auto';
    var p = v.play();
    if (p && p.catch) p.catch(function () {});   // autoplay refused: the poster stays
  }

  if (reduce) return;

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var was = seen.get(en.target);
        seen.set(en.target, en.isIntersecting);
        sync(en.target, en.isIntersecting && !was);
      });
    }, { threshold: 0.15 });
    films.forEach(function (v) { io.observe(v); });
  } else {
    films.forEach(function (v) { seen.set(v, true); sync(v); });
  }

  // Follow the page's Pause motion control, which toggles a class on body.
  new MutationObserver(function () { films.forEach(sync); })
    .observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();
