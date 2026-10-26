/* A looping film in place of a still: the CVS banner and its card on the
   home page. The video carries its first frame as its poster, so the page
   shows a picture at once and keeps showing it where the film can't play.

   It plays only while it's on screen, holds while it's off, and never
   plays for a reader whose system asks for reduced motion: they get the
   poster. The CVS page's Pause motion control holds it too. */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var films = [].slice.call(document.querySelectorAll('video[data-film]'));
  if (!films.length) return;

  function paused() { return document.body.classList.contains('motion-paused'); }

  var seen = new Map();
  function sync(v) {
    if (reduce || paused() || !seen.get(v)) { if (!v.paused) v.pause(); return; }
    if (v.preload !== 'auto') v.preload = 'auto';
    var p = v.play();
    if (p && p.catch) p.catch(function () {});   // autoplay refused: the poster stays
  }

  if (reduce) return;

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { seen.set(en.target, en.isIntersecting); sync(en.target); });
    }, { threshold: 0.15 });
    films.forEach(function (v) { io.observe(v); });
  } else {
    films.forEach(function (v) { seen.set(v, true); sync(v); });
  }

  // Follow the page's Pause motion control, which toggles a class on body.
  new MutationObserver(function () { films.forEach(sync); })
    .observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();
