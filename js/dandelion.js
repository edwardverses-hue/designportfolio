/* The dandelion field behind the headline on the home page.

   Three heads sit in the first screen, each a ring of glass panes around a
   bloom of light, on a stem that fades out into the paper before it reaches
   the bottom of the frame. Nothing is cropped, so there is no edge where this
   screen meets the next. Loose seeds drift through the air at rest.

   The panes carry the look. Most are frosted, drawn once into a blurred sprite
   and laid down soft, and roughly a quarter are drawn as hard-edged paths
   instead. That mixture is the point: a crisp facet sitting over soft
   neighbours is what gives the head some edges you can follow and others that
   melt, rather than the even fan a single treatment produces. The glass is
   very nearly neutral, a pale grey with only a breath of warm or cool in any
   one pane.

   The ground is white, which inverts the reference: there a pane is lighter
   than the grey behind it, here it can only be read as a faint tint over the
   paper, so the panes are tinted where the reference is bright and a wide
   white bloom over the middle opens the core.

   Hovering breaks a head apart. Which seeds go is worked out from where the
   cursor actually is, so the head opens from that point outwards rather than
   bursting all at once, and each seed leaves along the line running from the
   cursor through it. A loose seed is not thrown: it gets a small push, a
   little lift and a sideways sway, and drag takes the push out of it within a
   second, so what is left is a drift. As it recedes its pane shrinks away and
   it reads as one of the pins in the air. Seeds grow back into their own slots
   a second or so later, quickly but from nothing, so a head refills without
   pulling the eye to it. */
(function () {
  var canvas = document.querySelector('.dandelion-field');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TAU = Math.PI * 2;

  /* ---------- the composition ---------- */

  /* x is a fraction of the width, y of the height, r of the scene size worked
     out in build(). Every head sits far enough off the bottom that neither it
     nor its stem reaches the edge. */
  var LAYOUT = [
    { x: 0.145, y: 0.370, r: 0.115, n: 18 },
    { x: 0.380, y: 0.745, r: 0.200, n: 20 },
    { x: 0.760, y: 0.665, r: 0.170, n: 20 }
  ];

  /* On a phone the three heads sit almost on top of one another at those
     fractions, so they are spread out. */
  var NARROW = [
    { x: 0.190, y: 0.315, r: 0.115, n: 16 },
    { x: 0.400, y: 0.790, r: 0.185, n: 18 },
    { x: 0.720, y: 0.630, r: 0.155, n: 18 }
  ];

  var FILL = 0.86;         // how much of its slot a pane takes up
  var R0 = 0.14;           // where a pane starts; the bloom covers most of it
  var INK = '166,166,172'; // the neutral grey the hairlines are drawn in

  /* Very nearly white. One pane leans warm, its neighbour cool, and no pane is
     far enough from grey to be called a colour. */
  var GLASS = [
    [234, 234, 237],
    [232, 233, 239],
    [238, 236, 231],
    [233, 233, 234],
    [237, 235, 230],
    [233, 234, 238]
  ];

  var W = 0, H = 0, S = 0, dpr = 1;
  var heads = [];
  var flyers = [];
  var pointer = { x: 0, y: 0, on: false };
  var touchHold = 0;
  var last = 0, clock = 0, ambientAt = 0, frame = 0, visible = true;

  function ease(t) { var u = 1 - t; return 1 - u * u * u; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* ---------- the pane ---------- */

  function panePath(c, r0, r1, half) {
    c.beginPath();
    c.arc(0, 0, r0, -half, half, false);
    c.arc(0, 0, r1, half, -half, true);
    c.closePath();
  }

  /* Gradients are read in the user space in force when they are painted, so
     one built in a head's own coordinates keeps working under the rotation and
     the scale each pane is drawn with. */
  function glass(c, r0, r1, rgb) {
    var g = c.createLinearGradient(r0, 0, r1, 0);
    var s = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',';
    g.addColorStop(0.00, s + '0.34)');
    g.addColorStop(0.16, s + '0.80)');
    g.addColorStop(0.54, s + '0.74)');
    g.addColorStop(0.86, s + '0.50)');
    g.addColorStop(0.97, s + '0.13)');
    g.addColorStop(1.00, s + '0)');
    return g;
  }

  /* A frosted pane, blurred once here rather than on every frame. */
  function frost(head, rgb, blur) {
    var pad = blur * 3 + 2;
    var w = head.r + pad * 2;
    var h = 2 * head.r * Math.sin(head.half) + pad * 2;
    var ox = pad, oy = h / 2;

    var raw = document.createElement('canvas');
    raw.width = Math.ceil(w * dpr);
    raw.height = Math.ceil(h * dpr);
    var c = raw.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.translate(ox, oy);
    c.fillStyle = glass(c, head.r0, head.r, rgb);
    panePath(c, head.r0, head.r, head.half);
    c.fill();

    var out = document.createElement('canvas');
    out.width = raw.width;
    out.height = raw.height;
    var o = out.getContext('2d');
    if ('filter' in o) o.filter = 'blur(' + (blur * dpr).toFixed(2) + 'px)';
    o.drawImage(raw, 0, 0);

    return { img: out, ox: ox, oy: oy, w: w, h: h };
  }

  /* ---------- layout ---------- */

  function build() {
    var rect = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    /* Tied to the height on a wide screen and to the width on a narrow one, so
       the heads keep their weight against the text either way. */
    S = Math.min(H, Math.max(W * 0.62, H * 0.55));

    var plan = W < 720 ? NARROW : LAYOUT;
    heads = [];
    for (var h = 0; h < plan.length; h++) {
      var spec = plan[h];
      var r = S * spec.r;
      var head = {
        cx: W * spec.x, cy: H * spec.y,
        r: r, r0: r * R0,
        half: Math.PI / spec.n * FILL,
        stem: Math.min(r * 1.9, H - H * spec.y - S * 0.04),
        tints: [], sprites: [], seeds: []
      };

      for (var t = 0; t < GLASS.length; t++) {
        head.tints.push(glass(ctx, head.r0, head.r, GLASS[t]));
        head.sprites.push([
          null,                                   // drawn hard-edged instead
          frost(head, GLASS[t], r * 0.045),
          frost(head, GLASS[t], r * 0.100)
        ]);
      }

      for (var i = 0; i < spec.n; i++) {
        var soft = Math.random();
        head.seeds.push({
          ang: (i + 0.5) / spec.n * TAU + rnd(-0.18, 0.18) * TAU / spec.n,
          len: rnd(0.88, 1.09),
          alpha: rnd(0.7, 1.0),
          tint: (Math.random() * GLASS.length) | 0,
          blur: soft < 0.26 ? 0 : (soft < 0.70 ? 1 : 2),
          facet: rnd(-0.42, 0.42) * head.half,
          state: 2, t0: 0, dur: 1, wob: 0, growAt: 0
        });
      }
      heads.push(head);
    }

    flyers.length = 0;
    for (var k = 0; k < 9; k++) flyers.push(ambient(true));
  }

  /* ---------- seeds in the air ---------- */

  function pin(x, y, ang) {
    return {
      x: x, y: y, ang: ang,
      vx: 0, vy: 0,
      sway: rnd(0.35, 0.9), phase: rnd(0, TAU), swayA: S * rnd(0.02, 0.05),
      lift: S * rnd(0.02, 0.045), drag: rnd(0.75, 1.15),
      dot: S * rnd(0.0048, 0.0084),
      tail: S * rnd(0.07, 0.14),
      ringed: Math.random() < 0.18,
      age: 0, life: 6, head: null, sprite: null, grad: null, len: 1, alpha: 1
    };
  }

  /* A seed that has always been in the air, crossing at its own pace. The
     scene holds a few of these at rest, which is how the reference reads. */
  function ambient(scatter) {
    var f = pin(rnd(-0.05, 1.05) * W, scatter ? rnd(-0.05, 1.0) * H : H + S * 0.06, 0);
    f.life = rnd(26, 40);
    f.age = scatter ? rnd(0, f.life * 0.55) : 0;
    f.vx = S * rnd(-0.035, 0.035);
    f.vy = -S * rnd(0.014, 0.034);
    f.drag = 0;
    f.lift = 0;
    f.alpha = rnd(0.55, 0.9);
    f.ang = Math.atan2(f.vy, f.vx);
    return f;
  }

  function release(head, seed, now) {
    var dir = seed.ang;
    var len = head.r * seed.len;
    var f = pin(head.cx + Math.cos(dir) * len, head.cy + Math.sin(dir) * len, dir);

    /* Away from the cursor, blended with the way the seed already points, so a
       cursor on one side of the head clears that side first and the seeds fan
       out rather than all running down the same line. */
    var ax = f.x - pointer.x, ay = f.y - pointer.y;
    var m = Math.sqrt(ax * ax + ay * ay) || 1;
    var dx = ax / m * 0.6 + Math.cos(dir) * 0.85;
    var dy = ay / m * 0.6 + Math.sin(dir) * 0.85;
    var dm = Math.sqrt(dx * dx + dy * dy) || 1;
    var a = Math.atan2(dy / dm, dx / dm) + rnd(-0.28, 0.28);
    var sp = S * rnd(0.10, 0.26);

    f.vx = Math.cos(a) * sp;
    f.vy = Math.sin(a) * sp;
    f.life = rnd(3.4, 5.6);
    f.head = head;
    f.sprite = head.sprites[seed.tint][seed.blur];
    f.grad = head.tints[seed.tint];
    f.len = seed.len;
    f.alpha = seed.alpha;
    flyers.push(f);

    seed.state = 0;
    seed.growAt = now + rnd(1.0, 2.6);
  }

  function step(f, dt) {
    f.age += dt;
    f.vx += Math.sin(f.age * f.sway + f.phase) * f.swayA * dt;
    f.vy += Math.cos(f.age * f.sway * 0.8 + f.phase) * f.swayA * 0.35 * dt - f.lift * dt;
    if (f.drag) {
      var d = Math.exp(-f.drag * dt);
      f.vx *= d;
      f.vy *= d;
    }
    f.x += f.vx * dt;
    f.y += f.vy * dt;

    var want = Math.atan2(f.vy, f.vx);
    var diff = ((want - f.ang + Math.PI) % TAU + TAU) % TAU - Math.PI;
    f.ang += diff * Math.min(1, dt * 2.2);
  }

  function paintFlyer(f) {
    var t = f.age / f.life;
    var fade = t < 0.62 ? 1 : (1 - t) / 0.38;
    if (fade <= 0) return;

    if (f.head && f.age < 1.15) {
      var shrink = 1 - 0.92 * ease(Math.min(1, f.age / 1.25));
      var wa = f.alpha * fade * Math.max(0, 1 - f.age / 1.15);
      if (wa > 0.012) {
        var s = f.len * shrink;
        ctx.save();
        ctx.globalAlpha = wa;
        ctx.translate(f.x, f.y);
        ctx.rotate(f.ang);
        ctx.translate(-f.head.r * s, 0);
        ctx.scale(s, s);
        if (f.sprite) {
          ctx.drawImage(f.sprite.img, -f.sprite.ox, -f.sprite.oy, f.sprite.w, f.sprite.h);
        } else {
          ctx.fillStyle = f.grad;
          panePath(ctx, f.head.r0, f.head.r, f.head.half);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    var open = f.head ? Math.min(1, f.age / 0.8) : 1;
    var a = fade * open * f.alpha;
    if (a <= 0.012) return;

    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.ang);

    /* The stalk is strongest where it meets the seed and gives out before it
       ends, so a pin reads as one drawn stroke rather than a scratch. */
    var len = f.tail * open;
    ctx.lineWidth = Math.max(0.7, S * 0.0013);
    ctx.globalAlpha = a;
    if (len > 0.5) {
      var line = ctx.createLinearGradient(0, 0, -len, 0);
      line.addColorStop(0.00, 'rgba(' + INK + ',0.58)');
      line.addColorStop(0.55, 'rgba(' + INK + ',0.3)');
      line.addColorStop(1.00, 'rgba(' + INK + ',0)');
      ctx.strokeStyle = line;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-len, 0);
      ctx.stroke();
    }

    /* On white a seed head has to be drawn rather than lit, so it is a soft
       filled bead rather than the bright dot of the reference. */
    ctx.strokeStyle = 'rgba(' + INK + ',0.4)';
    ctx.fillStyle = 'rgba(' + INK + ',0.42)';
    ctx.beginPath();
    ctx.arc(0, 0, f.dot, 0, TAU);
    ctx.fill();
    if (f.ringed) {
      ctx.globalAlpha = a * 0.28;
      ctx.beginPath();
      ctx.arc(0, 0, f.dot * 3.4, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- the heads ---------- */

  function paintHead(head, now) {
    var r = head.r;

    /* The stem carries no weight of its own. It comes out from under the bloom,
       holds for a moment and is gone well before the bottom of the frame, so
       there is nothing to meet the edge of the screen. */
    var stem = ctx.createLinearGradient(head.cx, head.cy, head.cx, head.cy + head.stem);
    stem.addColorStop(0.00, 'rgba(' + INK + ',0)');
    stem.addColorStop(0.20, 'rgba(' + INK + ',0.46)');
    stem.addColorStop(0.58, 'rgba(' + INK + ',0.28)');
    stem.addColorStop(1.00, 'rgba(' + INK + ',0)');
    ctx.strokeStyle = stem;
    ctx.beginPath();
    ctx.moveTo(head.cx, head.cy);
    ctx.lineTo(head.cx, head.cy + head.stem);
    ctx.lineWidth = Math.max(1, r * 0.008);
    ctx.stroke();
    ctx.lineWidth = Math.max(3, r * 0.05);
    ctx.globalAlpha = 0.16;
    ctx.stroke();
    ctx.globalAlpha = 1;

    for (var i = 0; i < head.seeds.length; i++) {
      var s = head.seeds[i];
      if (s.state === 0) continue;
      var k = s.len, a = s.alpha, ang = s.ang;
      if (s.state === 1) {
        var t = (now - s.t0) / s.dur;
        if (t >= 1) {
          s.state = 2;
        } else {
          var e = ease(t);
          k = s.len * (0.12 + 0.88 * e);
          a *= Math.min(1, t / 0.5);
          ang += s.wob * (1 - e);
        }
      }
      var sp = head.sprites[s.tint][s.blur];
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(head.cx, head.cy);
      ctx.rotate(ang);
      ctx.scale(k, k);
      if (sp) {
        ctx.drawImage(sp.img, -sp.ox, -sp.oy, sp.w, sp.h);
      } else {
        ctx.fillStyle = head.tints[s.tint];
        panePath(ctx, head.r0, head.r, head.half);
        ctx.fill();
        /* Only the hard-edged panes get a second, narrower pane laid off-centre
           inside them, which reads as the thickness of the sheet. On a frosted
           one it would only be mush. */
        ctx.globalAlpha = a * 0.4;
        ctx.rotate(s.facet);
        panePath(ctx, head.r0 * 1.06, head.r * 0.99, head.half * 0.4);
        ctx.fill();
      }
      ctx.restore();
    }

    /* A bloom of white over the middle, which is where the light in the
       reference comes from. Kept narrow: any wider and the head hollows out
       into a ring instead of reading as a disc with a lit centre. */
    var bloom = r * 0.46;
    var core = ctx.createRadialGradient(head.cx, head.cy, 0, head.cx, head.cy, bloom);
    core.addColorStop(0.00, 'rgba(255,255,255,0.74)');
    core.addColorStop(0.45, 'rgba(255,255,255,0.52)');
    core.addColorStop(0.78, 'rgba(255,255,255,0.20)');
    core.addColorStop(1.00, 'rgba(255,255,255,0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(head.cx, head.cy, bloom, 0, TAU);
    ctx.fill();
  }

  /* Seeds go when the cursor is near them, and the nearer it is the sooner
     they go. That alone gives an opening that starts under the cursor and
     spreads, with no wavefront to keep track of. */
  function loosen(head, dt, now) {
    if (!pointer.on) return;
    var far = head.r * 1.4;
    var dx = pointer.x - head.cx, dy = pointer.y - head.cy;
    if (dx * dx + dy * dy > far * far) return;

    var reach = head.r * 0.9;
    for (var i = 0; i < head.seeds.length; i++) {
      var s = head.seeds[i];
      if (s.state !== 2) continue;
      var mx = head.cx + Math.cos(s.ang) * head.r * s.len * 0.76;
      var my = head.cy + Math.sin(s.ang) * head.r * s.len * 0.76;
      var ex = mx - pointer.x, ey = my - pointer.y;
      var d = Math.sqrt(ex * ex + ey * ey);
      if (d > reach) continue;
      if (Math.random() < Math.pow(1 - d / reach, 1.5) * 7 * dt) release(head, s, now);
    }
  }

  /* ---------- the ground ---------- */

  function paint(now, dt) {
    /* White, and nothing else. Any wash laid over it would have to stop at the
       bottom of the section and that edge is exactly what must not be there. */
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    for (var h = 0; h < heads.length; h++) {
      var head = heads[h];
      if (dt) loosen(head, dt, now);
      for (var i = 0; i < head.seeds.length; i++) {
        var s = head.seeds[i];
        if (s.state === 0 && now >= s.growAt) {
          s.state = 1;
          s.t0 = now;
          s.dur = rnd(0.9, 1.5);
          s.wob = rnd(-0.06, 0.06);
        }
      }
      paintHead(head, now);
    }

    for (var f = flyers.length - 1; f >= 0; f--) {
      var fl = flyers[f];
      if (dt) step(fl, dt);
      if (fl.age >= fl.life || fl.y < -S * 0.3 || fl.x < -S * 0.3 || fl.x > W + S * 0.3) {
        flyers.splice(f, 1);
        continue;
      }
      paintFlyer(fl);
    }

    if (dt && now >= ambientAt) {
      ambientAt = now + rnd(2.0, 4.5);
      var loose = 0;
      for (var k = 0; k < flyers.length; k++) if (!flyers[k].head) loose++;
      if (loose < 12) flyers.push(ambient(false));
    }
  }

  /* ---------- running ---------- */

  /* Everything runs off one clock that only ever advances by the frame delta,
     and by no more than a frame's worth at a time. Reading the timestamp
     directly would let a dropped frame or a backgrounded tab carry the growing
     seeds forward while the drifting ones stood still. */
  function tick(ms) {
    frame = requestAnimationFrame(tick);
    if (!visible) { last = ms; return; }
    var dt = last ? Math.min((ms - last) / 1000, 0.05) : 0;
    last = ms;
    clock += dt;
    if (touchHold > 0) {
      touchHold -= dt;
      if (touchHold <= 0) { touchHold = 0; pointer.on = false; }
    }
    paint(clock, dt);
  }

  function start() {
    if (frame) return;
    last = 0;
    frame = requestAnimationFrame(tick);
  }

  function stop() {
    if (!frame) return;
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function track(e, touch) {
    var r = canvas.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;
    pointer.x = x;
    pointer.y = y;
    pointer.on = x >= 0 && y >= 0 && x <= r.width && y <= r.height;
    /* A finger has no hover, so a tap opens the head for a moment and lets go. */
    if (touch && pointer.on) touchHold = 0.55;
  }

  window.addEventListener('pointermove', function (e) {
    track(e, e.pointerType === 'touch');
  }, { passive: true });

  window.addEventListener('pointerdown', function (e) {
    track(e, e.pointerType !== 'mouse');
  }, { passive: true });

  window.addEventListener('pointerleave', function () { pointer.on = false; });

  var resizeAt = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeAt);
    resizeAt = setTimeout(function () {
      build();
      if (still) paint(0, 0);
    }, 150);
  });

  document.addEventListener('visibilitychange', function () {
    visible = !document.hidden;
    if (visible) last = 0;
  });

  build();

  /* With motion turned down the scene is still drawn, it simply holds still. */
  if (still) {
    paint(0, 0);
    return;
  }

  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) start(); else stop();
    }, { threshold: 0 }).observe(canvas);
  }
  start();
})();
