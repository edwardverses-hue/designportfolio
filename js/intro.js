/* How the home page's ink arrives (js/hero-ink.js does the drawing).

   Arriving at the site on the home page, from a link elsewhere, a typed
   address or a bookmark, and on a reload: the name is written into the empty
   water stroke by stroke, then the homepage comes up around it (the header,
   the copy, the Pause motion control). This took the place of the loading
   screen ("Craft is care."). A move between the site's own pages, and back
   and forward, are recognised by where they came from and skipped.

   Coming home by the "Edward Chen" logo on another page (js/nav.js leaves a
   note of where it was clicked): a thread of ink runs from the click to the
   middle of the page instead, and the name spreads out from where it lands.

   Neither plays for a reader who asks for reduced motion or has paused the
   motion: the homepage is simply there. Other pages have no ink and open as
   they are.

   Decided here, loaded in the head without defer, so the copy and header are
   hidden before anything is drawn (css/hero-ink.css). For tuning: ?write
   and ?thread on the home page's address play them on any visit (add &slow
   for a third of the pace; T plays it again). */
(function () {
  var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
  var type = nav ? nav.type : 'navigate';
  var from = '';
  try { from = document.referrer ? new URL(document.referrer).origin : ''; } catch (e) {}

  var home = /\/(index\.html)?$/.test(location.pathname);
  var q = location.search, slow = /[?&]slow(&|=|$)/.test(q);
  var debugThread = home && /[?&]thread(&|=|$)/.test(q), debugWrite = home && /[?&]write(&|=|$)/.test(q);
  var note = null;
  try { note = JSON.parse(sessionStorage.getItem('inkThread')); sessionStorage.removeItem('inkThread'); } catch (e) {}
  var paused = false;
  try { paused = localStorage.getItem('motion-paused') === '1'; } catch (e) {}
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!home || paused || reduced) return;

  var root = document.documentElement;
  var fresh = note && typeof note.x === 'number' && typeof note.y === 'number' && Date.now() - note.at >= 0 && Date.now() - note.at < 4000;
  var arrived = type === 'reload' || (type === 'navigate' && from !== location.origin);

  if (debugThread || (!debugWrite && fresh && type === 'navigate' && from === location.origin)) {
    window.inkThread = debugThread ? { x: null, y: null, debug: true, slow: slow } : { x: note.x, y: note.y };
    root.classList.add('thread');
  } else if (debugWrite || arrived) {
    window.inkThread = { write: true, x: null, y: null, debug: debugWrite, slow: slow };
    root.classList.add('thread', 'inkintro');
    // The page stays put while the name is written, and is let go when the
    // homepage comes up (hero-ink.js takes the classes off).
    var KEYS = { ' ': 1, PageUp: 1, PageDown: 1, End: 1, Home: 1, ArrowUp: 1, ArrowDown: 1 };
    var hold = function (e) { if (e.type !== 'keydown' || KEYS[e.key]) e.preventDefault(); };
    ['wheel', 'touchmove', 'keydown'].forEach(function (t) { window.addEventListener(t, hold, { passive: false }); });
    var release = function () { ['wheel', 'touchmove', 'keydown'].forEach(function (t) { window.removeEventListener(t, hold, { passive: false }); }); };
    new MutationObserver(function (r, o) { if (!root.classList.contains('inkintro')) { release(); o.disconnect(); } })
      .observe(root, { attributes: true, attributeFilter: ['class'] });
  } else return;

  // If the ink never takes it up (no WebGL, a script that failed to load),
  // the homepage comes up rather than staying hidden.
  window.setTimeout(function () { if (!window.inkThread.taken) root.classList.remove('thread', 'inkintro'); }, 5000);
})();
