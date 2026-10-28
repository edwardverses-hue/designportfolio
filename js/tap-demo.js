/* Gemini's two tap demos: a home screen, a tap on one card, and the chat that
   card opens. All the screens share the home render's status bar, title and
   frame, so only the conversation changes: the greeting and cards clear, the
   chat fades in, holds, and both fade back before the next tap.

   It plays while half the phone is on screen, starts from the home screen
   each time it comes back, holds for the page's Pause motion control, and
   shows the opened screen without motion when reduced motion is asked for. */
(function () {
  var figs = [].slice.call(document.querySelectorAll('[data-tap-demo]'));
  if (!figs.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    figs.forEach(function (f) { f.classList.add('is-clear', 'is-open'); });
    return;
  }

  // home, tap, clear, chat held, chat out, clear out
  var STEPS = [1600, 450, 120, 3600, 300, 500];
  function paused() { return document.body.classList.contains('motion-paused'); }

  figs.forEach(function (f) {
    var visible = false, timer = null, step = 0;

    function next() {
      timer = null;
      if (!visible) return;
      if (paused()) { timer = setTimeout(next, 300); return; }
      if (step === 0) {
        f.classList.remove('is-open', 'is-clear');
      } else if (step === 1) {
        f.classList.remove('is-tap'); void f.offsetWidth; f.classList.add('is-tap');
      } else if (step === 2) {
        f.classList.add('is-clear');
      } else if (step === 3) {
        f.classList.add('is-open');
      } else if (step === 4) {
        f.classList.remove('is-open');
      } else {
        f.classList.remove('is-clear');
      }
      timer = setTimeout(next, STEPS[step]);
      step = (step + 1) % STEPS.length;
    }

    if (!('IntersectionObserver' in window)) { visible = true; next(); return; }
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible && !timer) { step = 0; next(); }
      if (!visible) { clearTimeout(timer); timer = null; f.classList.remove('is-open', 'is-clear', 'is-tap'); }
    }, { threshold: 0.5 }).observe(f);
  });
})();
