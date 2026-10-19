/* The rain behind the hero on the home page.

   The rain is all CSS (see RAIN BEHIND THE HERO in css/style.css). This file runs the
   objects, on the timing read out of mimicrydesign.co.jp's own script: each
   one fades in over 0.4s while sliding up the line of the rain, holds for 4s,
   fades out over 0.8s sliding back down it, and the next follows 0.3s later.
   A flipbook object plays its frames at 6 a second the whole time it shows.

   Everything runs on one clock that stops when the hero is scrolled out of
   view, so nothing jumps ahead while unseen. With reduced motion asked for,
   the first object simply stands still. */
(function () {
  var hero = document.querySelector('.rain-hero');
  if (!hero) return;

  var objects = [].slice.call(hero.querySelectorAll('.rain-object'));
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var IN_MS = 400, HOLD_MS = 4000, OUT_MS = 800, GAP_MS = 300, FRAME_MS = 1000 / 6;
  var DRIFT = 36; // px along the diagonal, theirs is 60 at a stage scale of about 0.5

  var offscreen = true;
  function paused() { return offscreen; }

  /* Flipbooks: swap the img's src through the listed frames. The frames are
     preloaded so the first pass does not flicker. */
  objects.forEach(function (o) {
    var list = (o.getAttribute('data-frames') || '').trim();
    if (!list) return;
    o.frames = list.split(/\s+/);
    o.frames.forEach(function (src) { var i = new Image(); i.src = src; });
    var img = o.querySelector('img');
    if (!img) { img = document.createElement('img'); img.alt = ''; o.appendChild(img); }
    img.src = o.frames[0];
    o.img = img;
    o.frame = 0;
  });

  function setPose(o, alpha, t) {
    o.style.opacity = alpha;
    o.style.transform = 'translate3d(' + (-DRIFT * t) + 'px,' + (DRIFT * t) + 'px,0)';
  }

  // easeOutQuad, the default ease of the TweenMax calls the timing came from
  function ease(p) { return p * (2 - p); }

  /* One clock for everything. `run` advances by real time only while not
     paused, so a pause holds every object exactly where it is. */
  var current = 0, phase = 'gap', elapsed = 0, frameClock = 0, last = null;

  function tick(now) {
    if (last === null) last = now;
    var dt = paused() ? 0 : Math.min(now - last, 100);
    last = now;
    if (dt) advance(dt);
    requestAnimationFrame(tick);
  }

  function advance(dt) {
    var o = objects[current];
    elapsed += dt;

    if (o.frames && phase !== 'gap') {
      frameClock += dt;
      while (frameClock >= FRAME_MS) {
        frameClock -= FRAME_MS;
        o.frame = (o.frame + 1) % o.frames.length;
        o.img.src = o.frames[o.frame];
      }
    }

    if (phase === 'gap') {
      if (elapsed >= GAP_MS) { phase = 'in'; elapsed = 0; frameClock = 0; if (o.frames) { o.frame = 0; o.img.src = o.frames[0]; } }
    } else if (phase === 'in') {
      var p = Math.min(elapsed / IN_MS, 1);
      setPose(o, ease(p), 1 - ease(p));
      if (p >= 1) { phase = 'hold'; elapsed = 0; }
    } else if (phase === 'hold') {
      if (elapsed >= HOLD_MS) { phase = 'out'; elapsed = 0; }
    } else if (phase === 'out') {
      var q = Math.min(elapsed / OUT_MS, 1);
      setPose(o, 1 - ease(q), ease(q));
      if (q >= 1) { phase = 'gap'; elapsed = 0; current = (current + 1) % objects.length; }
    }
  }

  objects.forEach(function (o) { setPose(o, 0, 1); });

  if (reduce) {
    if (objects[0]) setPose(objects[0], 1, 0);
    return;
  }

  /* The clock and the rain stop whenever the hero is off screen, so nothing
     runs while the reader is down among the work. */
  function setOffscreen(v) {
    offscreen = v;
    hero.classList.toggle('is-offscreen', v);
  }

  if ('IntersectionObserver' in window) {
    setOffscreen(true);
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        setOffscreen(!en.isIntersecting);
      });
    }).observe(hero);
  } else {
    setOffscreen(false);
  }

  requestAnimationFrame(tick);
})();
