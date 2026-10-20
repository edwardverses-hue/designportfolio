/* The cursor.

   Modelled on the one on mimicrydesign.co.jp. At rest it is a small ring.
   Over a link or a button it fills into a disc, and over something that opens
   work to look at, the disc grows and reads "view". The whole thing is drawn
   with the difference blend mode, so it inverts whatever is beneath it: black
   on the white page, white on a dark picture, and the word comes out in the
   colour of the page behind it.

   Only for a mouse or trackpad. On touch there is no cursor to replace, so
   nothing here runs and the page keeps its normal behaviour. */
(function () {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Anything that does something when clicked.
  var CLICKABLE = 'a[href], button:not([disabled]), [role="button"], summary, label[for], .work';
  // The things that open a piece of work: the project cards on the home page,
  // the pieces on the Play page, and anything marked data-cursor="view".
  var VIEW = '.project-card, .work, [data-cursor="view"]';

  var el = document.createElement('div');
  el.className = 'cursor';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<span class="cursor__shape"></span><span class="cursor__label">view</span>';
  document.body.appendChild(el);
  document.documentElement.classList.add('has-cursor');

  var x = 0, y = 0, cx = 0, cy = 0, seen = false, running = false, state = '';

  // The ring trails the pointer slightly, which is what makes it feel like an
  // object rather than a sprite. With reduced motion it sits exactly on it.
  var EASE = reduce ? 1 : 0.35;

  function frame() {
    cx += (x - cx) * EASE;
    cy += (y - cy) * EASE;
    if (Math.abs(x - cx) < 0.1 && Math.abs(y - cy) < 0.1) { cx = x; cy = y; running = false; }
    el.style.transform = 'translate3d(' + cx.toFixed(2) + 'px,' + cy.toFixed(2) + 'px,0)';
    if (running) requestAnimationFrame(frame);
  }

  function kick() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  function setState(next) {
    if (next === state) return;
    state = next;
    el.classList.toggle('is-link', next === 'link');
    el.classList.toggle('is-view', next === 'view');
  }

  function stateFor(target) {
    var hit = target && target.closest ? target.closest(CLICKABLE) : null;
    if (!hit) return '';
    return hit.closest(VIEW) ? 'view' : 'link';
  }

  window.addEventListener('mousemove', function (e) {
    x = e.clientX;
    y = e.clientY;
    if (!seen) {
      // Start where the pointer is rather than gliding in from the corner.
      seen = true;
      cx = x; cy = y;
    }
    el.classList.add('is-on');
    kick();
  }, { passive: true });

  document.addEventListener('mouseover', function (e) {
    setState(stateFor(e.target));
  }, { passive: true });

  // The page can move under a still pointer, by scrolling or by the Play room
  // turning, without a mouseover firing. Check what is under it again then.
  var pending = false;
  function recheck() {
    if (pending || !seen) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      setState(stateFor(document.elementFromPoint(x, y)));
    });
  }
  window.addEventListener('scroll', recheck, { passive: true });
  window.addEventListener('wheel', recheck, { passive: true });

  // Hidden while the pointer is outside the window, so it does not sit frozen
  // at the edge it left from.
  document.documentElement.addEventListener('mouseleave', function () {
    el.classList.remove('is-on');
  });
})();
