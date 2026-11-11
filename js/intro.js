/* The loading screen, after butter.video's: a white screen, one line faded in
   word by word and out again, then the screen fades away. The look and the
   timing are in css/style.css under LOADING SCREEN; the markup is the first
   thing in each page's body.

   It plays when someone arrives at the site, from a link elsewhere, a typed
   address or a bookmark, and on a reload. Butter is one page that swaps its
   content, so its screen plays once per visit and again on a reload but not
   between its pages; these are separate pages, so a move from one of them to
   another is recognised by where it came from and skipped, as are back and
   forward.

   Loaded in the head without defer, so the class is on the page before
   anything is drawn and the page never shows through first. */
(function () {
  var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
  var type = nav ? nav.type : 'navigate';
  var from = '';
  try { from = document.referrer ? new URL(document.referrer).origin : ''; } catch (e) {}
  if (!(type === 'reload' || (type === 'navigate' && from !== location.origin))) return;

  var root = document.documentElement;
  root.classList.add('intro');

  // The page underneath stays put while the screen is up, as Butter's does.
  var KEYS = { ' ': 1, PageUp: 1, PageDown: 1, End: 1, Home: 1, ArrowUp: 1, ArrowDown: 1 };
  function hold(e) { if (e.type !== 'keydown' || KEYS[e.key]) e.preventDefault(); }
  ['wheel', 'touchmove', 'keydown'].forEach(function (t) { window.addEventListener(t, hold, { passive: false }); });

  var done = false;
  function end() {
    if (done) return;
    done = true;
    root.classList.remove('intro', 'intro-still');
    ['wheel', 'touchmove', 'keydown'].forEach(function (t) { window.removeEventListener(t, hold, { passive: false }); });
  }
  // Gone once the screen's own fade has finished, and after four seconds
  // whatever happens, as Butter's is.
  document.addEventListener('animationend', function (e) { if (e.animationName === 'intro-hide') end(); });
  window.setTimeout(end, 4000);

  // While the words come and go the page underneath keeps still (the home
  // page's ink reads html.intro-still), so the fades have the machine to
  // themselves, as Butter stops its own scene. It runs before them, in the
  // empty second where it can settle unseen, and again as the screen fades,
  // so the page is moving when it appears. Timed from the screen's own clock,
  // with the times in css/style.css.
  document.addEventListener('DOMContentLoaded', function () {
    var s = document.querySelector('.intro-screen');
    var a = s && s.getAnimations && s.getAnimations()[0];
    if (!a || done) return;
    var n = parseFloat(getComputedStyle(s).getPropertyValue('--n')) || 1;
    var now = a.currentTime || 0;
    var from = 950 - now, to = 2250 + 2 * (n - 1) * 30 - now;
    if (to <= 0) return;
    window.setTimeout(function () { if (!done) root.classList.add('intro-still'); }, Math.max(0, from));
    window.setTimeout(function () { root.classList.remove('intro-still'); }, to);
  });
})();
