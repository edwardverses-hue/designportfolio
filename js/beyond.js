/* The photo globe at the end of the About page, after the "Beyond the work"
   section of ramp.design. This is a port of their CuriousTeamSection: the
   same sphere, the same projection, the same numbers for the spin, the drag,
   the momentum and the depth of field. Their lightbox, which opens a photo on
   click, is left out: the cards hold no pictures yet.

   The cards sit on a fibonacci sphere. Each frame the sphere's orientation,
   kept as a quaternion, turns every point, and the point is projected with a
   camera 3.6 radii out, so near cards come forward and far cards shrink back.
   A card's depth sets its opacity, its blur and its stacking order (200 to
   780). The heading sits above all of them at 800, on a white haze, so at
   the type system's 36px no card ever hides the words.

   Left alone the globe turns once in 56 seconds about the vertical. Dragging
   turns it by hand and throws it with momentum; a horizontal wheel turns it
   too, and a vertical one tilts it a little as the reader scrolls by. After
   any of these it waits 900ms, then eases back into its own turn. Under
   reduced motion it does not turn by itself and nothing coasts, but it can
   still be dragged. */
(function () {
  var root = document.querySelector('.beyond');
  if (!root) return;
  var stage = root.querySelector('.beyond__stage');
  var sphere = root.querySelector('.beyond__sphere');
  if (!stage || !sphere) return;

  /* The pictures, at their own aspect ratios. The globe holds seventeen, as
     ramp's does, so with fewer it cycles through them; a card's neighbours on
     a fibonacci sphere are about 3, 5, 8 and 13 places away, never 7 or 14, so
     with seven pictures no two copies sit side by side. Add more to repeat less. */
  var SRC = 'images/about/beyond/';
  var PICTURES = [
    { src: SRC + 'lights.jpg', full: SRC + 'lights-full.jpg', w: 640, h: 853, alt: 'People in a dark room of projected blue light and falling flowers at teamLab Borderless' },
    { src: SRC + 'tractor.jpg', full: SRC + 'tractor-full.jpg', w: 720, h: 480, alt: 'Sitting at the wheel of a red Farmall tractor in a sunny field' },
    { src: SRC + 'chalk.jpg', full: SRC + 'chalk-full.jpg', w: 640, h: 853, alt: 'Chalk drawings of flowers and leaves along a sidewalk at night' },
    { src: SRC + 'heron.jpg', full: SRC + 'heron-full.jpg', w: 640, h: 853, alt: 'A heron wading in calm blue water at dusk' },
    { src: SRC + 'palms.jpg', full: SRC + 'palms-full.jpg', w: 640, h: 960, alt: 'Palm trees in silhouette against a low sun on a beach path' },
    { src: SRC + 'porsche.jpg', full: SRC + 'porsche-full.jpg', w: 720, h: 480, alt: 'A crowd watching a white Porsche 911 being worked on in a service bay' },
    { src: SRC + 'dinner.jpg', full: SRC + 'dinner-full.jpg', w: 640, h: 884, alt: 'Five friends around a round restaurant table of shared dishes, making bunny ears behind each other' }
  ];
  var PHOTOS = [];
  for (var n = 0; n < 17; n++) PHOTOS.push(PICTURES[n % PICTURES.length]);

  var COMPACT = '(max-width: 760px), (max-height: 500px) and (orientation: landscape)';
  var SPIN = 2 * Math.PI / 56000; // radians per ms: one turn in 56 seconds

  /* ---------- vectors and quaternions ---------- */
  function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }
  function len(v) { return Math.hypot(v.x, v.y, v.z); }
  function norm(v) {
    var l = len(v);
    return l < 1e-9 ? { x: 0, y: 0, z: 0 } : { x: v.x / l, y: v.y / l, z: v.z / l };
  }
  function qnorm(q) {
    var l = Math.hypot(q.x, q.y, q.z, q.w);
    return l < 1e-9 ? { x: 0, y: 0, z: 0, w: 1 } : { x: q.x / l, y: q.y / l, z: q.z / l, w: q.w / l };
  }
  function qmul(a, b) {
    return qnorm({
      x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
      y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
      z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
      w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
    });
  }
  function axisAngle(axis, angle) {
    var a = norm(axis), h = angle / 2, s = Math.sin(h);
    return qnorm({ x: a.x * s, y: a.y * s, z: a.z * s, w: Math.cos(h) });
  }
  function rotate(v, q) {
    var r = qnorm(q);
    var tx = 2 * (r.y * v.z - r.z * v.y);
    var ty = 2 * (r.z * v.x - r.x * v.z);
    var tz = 2 * (r.x * v.y - r.y * v.x);
    return {
      x: v.x + r.w * tx + (r.y * tz - r.z * ty),
      y: v.y + r.w * ty + (r.z * tx - r.x * tz),
      z: v.z + r.w * tz + (r.x * ty - r.y * tx)
    };
  }
  function fibonacci(n) {
    var golden = Math.PI * (3 - Math.sqrt(5));
    var out = [];
    for (var i = 0; i < n; i++) {
      var y = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(1 - y * y);
      out.push({ x: Math.cos(i * golden) * r, y: y, z: Math.sin(i * golden) * r });
    }
    return out;
  }
  /* On a phone the globe carries ten of the seventeen, spread evenly through
     the list. */
  function tenOf(list) {
    if (list.length <= 10) return list;
    var out = [], used = {};
    for (var i = 0; i < 10; i++) {
      var k = Math.round(i * (list.length - 1) / 9);
      if (!used[k]) { used[k] = true; out.push(list[k]); }
    }
    for (var j = 0; out.length < 10 && j < list.length; j++) {
      if (!used[j]) { used[j] = true; out.push(list[j]); }
    }
    return out;
  }

  /* ---------- state ---------- */
  var compactMq = window.matchMedia(COMPACT);
  var reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  var dataMq = window.matchMedia('(prefers-reduced-data: reduce)');
  var reduce = reduceMq.matches;
  var still = false; // reduced motion or reduced data: no spin of its own, no coasting
  var compact = compactMq.matches;
  var set = compact ? PHOTOS.slice(0, 10) : PHOTOS;
  var points = fibonacci(set.length);
  var cards = [];
  var cache = [];
  var geo = { width: 0, height: 0, rX: 0, rY: 0, rZ: 0, offsetY: 0 };
  var orient = axisAngle({ x: 1, y: 0, z: 0 }, -0.07);
  var drag = null;
  var dragged = false;
  var spin = { x: 0, y: 0, z: 0 };
  var coasting = false;
  var inputKind = 'mouse';
  var ease = 0;       // how much of its own turn the globe has back, 0 to 1
  var resumeAt = 0;   // when it may start easing back in
  var inView = false;
  var live = false;
  var raf = 0;
  var lastT = 0;

  function updateStill() {
    var conn = navigator.connection;
    still = reduce || dataMq.matches || (conn && conn.saveData === true);
  }
  updateStill();

  function build() {
    sphere.querySelectorAll('.beyond__photo').forEach(function (n) { n.remove(); });
    cards = [];
    cache = [];
    var shown = {};
    set.forEach(function (p) {
      /* Each card is a link to its picture, opened over the page in the Play
         page's viewer (js/viewer.js) with the View cursor. The first card of
         each picture is the one a keyboard reaches; the repeats the globe
         needs to fill itself are hidden from it and from screen readers. */
      var photo = document.createElement(p.src ? 'a' : 'span');
      photo.className = 'beyond__photo';
      if (p.src) {
        photo.href = p.full || p.src;
        photo.setAttribute('data-viewer', '');
        photo.setAttribute('data-cursor', 'view');
        photo.draggable = false;
        if (shown[p.src]) { photo.setAttribute('aria-hidden', 'true'); photo.tabIndex = -1; }
        else { photo.setAttribute('aria-label', 'Open photo: ' + (p.alt || '')); shown[p.src] = true; }
      } else {
        photo.setAttribute('aria-hidden', 'true');
      }
      photo.style.aspectRatio = p.w + ' / ' + p.h;
      // Ramp's cards are about 3:2. A card of any other shape keeps that card's
      // area, so a portrait photo is narrower, not taller, and the globe keeps
      // its density round the heading.
      photo.style.setProperty('--s', Math.min(1, Math.sqrt((p.w / p.h) / 1.5)).toFixed(3));
      var push = document.createElement('span');
      push.className = 'beyond__push';
      var card = document.createElement('span');
      card.className = 'beyond__card';
      if (p.src) {
        var img = document.createElement('img');
        img.className = 'beyond__media';
        img.src = p.src;
        img.alt = p.alt || '';
        img.width = p.w;
        img.height = p.h;
        img.draggable = false;
        img.decoding = 'async';
        // The globe sits at the foot of the page; its pictures load as it nears.
        img.loading = 'lazy';
        card.appendChild(img);
      }
      push.appendChild(card);
      photo.appendChild(push);
      sphere.appendChild(photo);
      cards.push(photo);
      cache.push({ transform: '', opacity: '', filter: '', zIndex: '', pointerEvents: '', front: false });
    });
  }

  /* ---------- the projection ---------- */
  function render() {
    var rX = geo.rX, rY = geo.rY, rZ = geo.rZ;
    if (rX <= 0 || rY <= 0 || rZ <= 0) return;
    var camera = 3.6 * rZ;
    var cardW = cards[0] ? cards[0].offsetWidth : 0;
    if (!cardW) {
      var w = geo.width;
      cardW = compact ? clamp(w * (w >= 360 ? 0.31 : 0.3), 96, 144)
        : w < 1200 ? clamp(0.145 * w, 128, 148) : clamp(0.15 * w, 128, 216);
    }
    var maxBlur = clamp(0.028 * cardW, 2, 4.5);
    points.forEach(function (p, i) {
      var el = cards[i];
      if (!el) return;
      var t = rotate(p, orient);
      var x = t.x * rX, y = t.y * rY, z = t.z * rZ;
      var d = camera / Math.max(camera - z, 1.6 * rZ);
      var px = x * d, py = -y * d + geo.offsetY;
      var depth = clamp((z / rZ + 1) / 2, 0, 1);
      var a = clamp((depth - 0.12) / 0.44, 0, 1);
      var b = clamp((0.56 - depth) / 0.56, 0, 1);
      var blur = b * b * (3 - 2 * b) * maxBlur;
      var front = z > 0.12 * rZ;
      var transform = 'translate3d(' + px.toFixed(2) + 'px, ' + py.toFixed(2) + 'px, 0) scale(1.0000)';
      var opacity = (0.38 + a * a * (3 - 2 * a) * 0.62).toFixed(3);
      var filter = blur >= 0.45 ? 'blur(' + blur.toFixed(2) + 'px)' : 'none';
      var zIndex = String(Math.round(200 + 580 * depth));
      var c = cache[i];
      if (c.transform !== transform) { el.style.transform = transform; c.transform = transform; }
      if (c.opacity !== opacity) { el.style.opacity = opacity; c.opacity = opacity; }
      if (c.filter !== filter) { el.style.filter = filter; c.filter = filter; }
      if (c.zIndex !== zIndex) { el.style.zIndex = zIndex; c.zIndex = zIndex; }
      if (c.pointerEvents !== 'auto') { el.style.pointerEvents = 'auto'; c.pointerEvents = 'auto'; }
      if (c.front !== front) { el.toggleAttribute('data-front', front); c.front = front; }
    });
  }

  /* ---------- the stage's size ---------- */
  function measure() {
    var vv = window.visualViewport;
    var viewH = vv ? vv.height : window.innerHeight;
    var viewTop = vv ? vv.offsetTop : 0;
    var nav = document.querySelector('.nav');
    var navBottom = viewTop;
    if (nav) {
      var cs = getComputedStyle(nav);
      if (cs.display !== 'none' && cs.visibility !== 'hidden' && (cs.position === 'fixed' || cs.position === 'sticky')) {
        navBottom = Math.max(navBottom, nav.getBoundingClientRect().bottom);
      }
    }
    navBottom = clamp(navBottom - viewTop, 0, viewH);
    var safe = parseFloat(getComputedStyle(stage).getPropertyValue('--beyond-safe-area-bottom')) || 0;
    var usable = Math.max(viewH - navBottom - safe, 1);
    stage.style.setProperty('--beyond-nav-bottom', navBottom.toFixed(2) + 'px');
    stage.style.setProperty('--beyond-usable-height', usable.toFixed(2) + 'px');

    var s = stage.getBoundingClientRect();
    var cardW = cards[0] ? cards[0].offsetWidth : clamp(s.width * (compact ? 0.345 : 0.15), 108, 216);
    var pad = compact ? clamp(0.045 * cardW, 6, 14) : clamp(0.08 * cardW, 10, 18);
    var halfW = Math.max((s.width - cardW - 2 * pad) / 2, 1);
    var cardH = cardW;
    cards.forEach(function (c) { cardH = Math.max(cardH, c.offsetHeight); });
    var top = clamp(s.height * (compact ? 0.016 : 0.022), compact ? 8 : 12, compact ? 14 : 18);
    var bottom = clamp(s.height * (compact ? 0.012 : 0.018), compact ? 6 : 10, compact ? 12 : 16);
    var halfH = Math.max((s.height - cardH - top - bottom) / 2, 1);
    var reach = 3.6 / Math.sqrt(11.96);
    var rX = halfW / reach, rY = halfH / reach;
    geo = { width: s.width, height: s.height, rX: rX, rY: rY, rZ: Math.sqrt(rX * rY), offsetY: (top - bottom) / 2 };
    render();
  }

  /* ---------- the clock ---------- */
  function rest(now) {
    coasting = false;
    spin.x = 0; spin.y = 0; spin.z = 0;
    ease = 0;
    resumeAt = now + 900;
  }
  function running() {
    return !!drag || (!document.hidden && (coasting || !still));
  }
  function frame(t) {
    if (!running()) { live = false; raf = 0; render(); return; }
    var dt = Math.min(Math.max(t - lastT, 0), 80);
    lastT = t;
    if (!drag) {
      if (document.hidden) {
        rest(t);
      } else if (coasting) {
        var tau = inputKind === 'touch' ? 1050 : 900;
        var k = Math.exp(-dt / tau);
        var r = len(spin);
        if (r > 0) orient = qmul(axisAngle(spin, tau * (1 - k) * r), orient);
        spin.x *= k; spin.y *= k; spin.z *= k;
        if (len(spin) <= 25e-6) rest(t);
      } else {
        spin.x = 0; spin.y = 0; spin.z = 0;
        if (still) ease = 0;
        else if (t >= resumeAt) ease += (1 - ease) * (1 - Math.exp(-dt / 420));
        var a = dt * SPIN * ease;
        if (a > 0) orient = qmul(axisAngle({ x: 0, y: 1, z: 0 }, a), orient);
      }
    }
    render();
    if (running()) raf = window.requestAnimationFrame(frame);
    else { live = false; raf = 0; }
  }
  function wake() {
    if (live || !inView || reduce || !running()) return;
    live = true;
    lastT = performance.now();
    raf = window.requestAnimationFrame(frame);
  }
  function sleep() {
    window.cancelAnimationFrame(raf);
    raf = 0;
    live = false;
  }

  /* ---------- the hand ---------- */
  function release(id, cancelled) {
    if (!drag || drag.id !== id) return;
    var d = drag;
    drag = null;
    stage.removeAttribute('data-orbit-dragging');
    var now = performance.now();
    if (d.committed) {
      if (cancelled || still) {
        rest(now);
      } else {
        var touch = d.type === 'touch';
        var boost = touch ? 1.24 : 1.18;
        var cap = touch ? 0.0065 : 0.0085;
        var sum = { x: 0, y: 0, z: 0, weight: 0 };
        d.samples.forEach(function (s) {
          var w = clamp(1 - (now - s.time) / 140, 0.15, 1);
          sum.x += s.x * w; sum.y += s.y * w; sum.z += s.z * w; sum.weight += w;
        });
        var avg = sum.weight > 0 ? { x: sum.x / sum.weight, y: sum.y / sum.weight, z: sum.z / sum.weight } : spin;
        var v = { x: avg.x * boost, y: avg.y * boost, z: avg.z * boost };
        var m = len(v), s = m > cap ? cap / m : 1;
        spin = { x: v.x * s, y: v.y * s, z: v.z * s };
        coasting = len(spin) > 25e-6;
        inputKind = d.type;
        ease = 0;
        if (!coasting) { spin = { x: 0, y: 0, z: 0 }; resumeAt = now + 900; }
      }
    }
    try {
      if (d.capture.hasPointerCapture(id)) d.capture.releasePointerCapture(id);
    } catch (err) {}
  }

  function down(e) {
    if (!e.isPrimary || e.button !== 0 || drag) return;
    dragged = false;
    var card = e.target instanceof Element ? e.target.closest('.beyond__photo') : null;
    drag = {
      id: e.pointerId,
      type: e.pointerType,
      capture: card || stage,
      startX: e.clientX, startY: e.clientY,
      lastX: e.clientX, lastY: e.clientY,
      lastTime: performance.now(),
      sampled: false,
      samples: [],
      committed: false
    };
    wake();
  }

  function move(e) {
    if (!drag || drag.id !== e.pointerId) return;
    var touch = drag.type === 'touch';
    var dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
    if (!drag.committed) {
      if (Math.hypot(dx, dy) < (touch ? 10 : 6)) return;
      // A finger moving mostly up or down is scrolling the page, not the globe.
      if (touch && Math.abs(dy) > 1.2 * Math.abs(dx)) { release(e.pointerId, true); return; }
      drag.committed = true;
      dragged = true;
      try { drag.capture.setPointerCapture(e.pointerId); } catch (err) {}
      rest(performance.now());
      stage.setAttribute('data-orbit-dragging', '');
    }
    var now = performance.now();
    var dt = Math.max(now - drag.lastTime, 1);
    var mx = e.clientX - drag.lastX, my = e.clientY - drag.lastY;
    var w = clamp(geo.width, 390, 1000);
    var k = clamp(3.45 / w, 0.00345, 0.00885);
    var ax = my * k * (geo.rX / Math.max(geo.rY, 1)) * 0.9 * (touch ? 0.85 : 1);
    var ay = mx * k;
    var ang = Math.hypot(ax, ay);
    if (ang > 0) orient = qmul(axisAngle({ x: ax, y: ay, z: 0 }, ang), orient);
    var cap = touch ? 0.0065 : 0.0085;
    var v = { x: ax / dt, y: ay / dt, z: 0 };
    var m = len(v), s = m > cap ? cap / m : 1;
    var sample = { time: now, x: v.x * s, y: v.y * s, z: 0 };
    drag.samples.push(sample);
    while (drag.samples[0] && now - drag.samples[0].time > 140) drag.samples.shift();
    if (drag.sampled) {
      var blend = 1 - Math.exp(-dt / 45);
      spin.x += (sample.x - spin.x) * blend;
      spin.y += (sample.y - spin.y) * blend;
      spin.z += (sample.z - spin.z) * blend;
    } else {
      spin = { x: sample.x, y: sample.y, z: sample.z };
      drag.sampled = true;
    }
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    drag.lastTime = now;
    if (still) render();
  }

  function wheel(e) {
    if (still || drag || e.ctrlKey) return;
    var dx = e.deltaX, dy = e.deltaY;
    if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) { dx *= 16; dy *= 16; }
    else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      dx *= stage.clientWidth || window.innerWidth;
      dy *= stage.clientHeight || window.innerHeight;
    }
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= 0.5) e.preventDefault();
    spin.x += 4e-6 * dy;
    spin.y += -(35e-6 * dx);
    var m = len(spin);
    if (m > 0.004) { var s = 0.004 / m; spin.x *= s; spin.y *= s; spin.z *= s; }
    if (len(spin) <= 25e-6) return;
    coasting = true;
    inputKind = 'wheel';
    ease = 0;
    resumeAt = performance.now() + 900;
    wake();
  }

  // Swallow the click that ends a drag, before the viewer hears it.
  stage.addEventListener('click', function (e) {
    if (!dragged) return;
    dragged = false;
    e.preventDefault();
    e.stopPropagation();
  }, true);
  stage.addEventListener('pointerdown', down, true);
  stage.addEventListener('pointermove', move, true);
  stage.addEventListener('pointerup', function (e) { release(e.pointerId, false); }, true);
  stage.addEventListener('pointercancel', function (e) { release(e.pointerId, true); }, true);
  stage.addEventListener('lostpointercapture', function (e) { release(e.pointerId, true); });
  stage.addEventListener('wheel', wheel, { passive: false });
  window.addEventListener('pointerup', function (e) { release(e.pointerId, false); });
  window.addEventListener('pointercancel', function (e) { release(e.pointerId, true); });
  window.addEventListener('blur', function () {
    if (drag) release(drag.id, true);
    rest(performance.now());
  });
  document.addEventListener('visibilitychange', wake);

  /* ---------- being on screen ---------- */
  function setWill() {
    var on = inView && !reduce;
    cards.forEach(function (c) { c.style.willChange = on ? 'transform, opacity' : 'auto'; });
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        inView = en.isIntersecting;
        setWill();
        if (inView) wake();
        else { sleep(); coasting = false; spin = { x: 0, y: 0, z: 0 }; ease = 0; }
      });
    }, { threshold: 0.04 }).observe(root);
  } else {
    inView = true;
    setWill();
  }

  /* ---------- changes of setting ---------- */
  function relayout() {
    var wasCompact = compact;
    compact = compactMq.matches;
    if (compact !== wasCompact) {
      set = compact ? PHOTOS.slice(0, 10) : PHOTOS;
      points = fibonacci(set.length);
      build();
      setWill();
    }
    measure();
  }
  compactMq.addEventListener('change', relayout);
  reduceMq.addEventListener('change', function () {
    reduce = reduceMq.matches;
    updateStill();
    setWill();
    if (reduce) sleep(); else wake();
  });
  dataMq.addEventListener('change', function () { updateStill(); wake(); });
  if (navigator.connection && navigator.connection.addEventListener) {
    navigator.connection.addEventListener('change', function () { updateStill(); wake(); });
  }

  var pending = 0;
  function onResize() {
    if (pending) return;
    pending = window.requestAnimationFrame(function () { pending = 0; measure(); });
  }
  window.addEventListener('resize', onResize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
  if ('ResizeObserver' in window) {
    var ro = new ResizeObserver(measure);
    ro.observe(stage);
    var nav = document.querySelector('.nav');
    if (nav) ro.observe(nav);
  }

  build();
  measure();
  wake();
})();
