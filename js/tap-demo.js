/* Gemini's two tap demos: a home screen, a tap on one card, and the screen
   that card opens. Both screens are renders in the same mockup, so only the
   screen's contents change: the result fades in over the home screen, holds,
   and fades back before the next tap.

   It plays while half the phone is on screen, starts from the home screen
   each time it comes back, holds for the page's Pause motion control, and
   shows the opened screen without motion when reduced motion is asked for. */
(function () {
  var figs = [].slice.call(document.querySelectorAll('[data-tap-demo]'));
  if (!figs.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    figs.forEach(function (f) { f.classList.add('is-open'); });
    return;
  }

  var HOME = 1600, TAP = 450, OPEN = 3600, BACK = 700;
  function paused() { return document.body.classList.contains('motion-paused'); }

  figs.forEach(function (f) {
    var visible = false, timer = null, step = 0;

    function next() {
      timer = null;
      if (!visible) return;
      if (paused()) { timer = setTimeout(next, 300); return; }
      if (step === 0) {
        f.classList.remove('is-open');
        step = 1; timer = setTimeout(next, HOME);
      } else if (step === 1) {
        f.classList.remove('is-tap'); void f.offsetWidth; f.classList.add('is-tap');
        step = 2; timer = setTimeout(next, TAP);
      } else if (step === 2) {
        f.classList.add('is-open');
        step = 3; timer = setTimeout(next, OPEN);
      } else {
        f.classList.remove('is-open');
        step = 0; timer = setTimeout(next, BACK);
      }
    }

    if (!('IntersectionObserver' in window)) { visible = true; next(); return; }
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible && !timer) { step = 0; next(); }
      if (!visible) { clearTimeout(timer); timer = null; f.classList.remove('is-open', 'is-tap'); }
    }, { threshold: 0.5 }).observe(f);
  });
})();
