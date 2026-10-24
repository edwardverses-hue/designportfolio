/* Liquid glass for the nav pills.

   The CSS gives every browser the rim light and thickness. What it cannot do
   is the lens: the page behind bending as it passes under the rim, with a
   faint colour fringe where it bends hardest. That takes an SVG filter run as
   the pill's backdrop-filter, which only Chromium draws, so this runs only
   there. Safari and Firefox keep the CSS glass rather than lose the blur to a
   filter they would ignore.

   Each pill gets a displacement map drawn to its own size and corner radius.
   Within BAND px of the edge, every pixel is told to sample from further in,
   most strongly at the rim, which is what makes the backdrop look magnified
   and curved there. The three colour channels are displaced by slightly
   different amounts, which is the fringe. */
(function () {
  var pills = [].slice.call(document.querySelectorAll('.nav-logo, .nav-center, .nav-right, .lg-glass'));

  // The header pills in the cursor's lens (data-lg="lens" below) and its
  // white rim (.lg-lens-header in the stylesheet) rather than the pane look.
  // To go back, set this to false. It is set before the browser checks so the
  // rim applies everywhere, even where the bend cannot be drawn.
  var HEADER_LENS = true;
  if (HEADER_LENS) {
    document.documentElement.classList.add('lg-lens-header');
    [].forEach.call(document.querySelectorAll('.nav .nav-logo, .nav .nav-center, .nav .nav-right'), function (p) {
      p.setAttribute('data-lg', 'lens');
    });
  }

  // Every glass on the site in Aave's glass, ported line for line from the
  // code behind aave.com/design/building-glass-for-the-web, with the defaults
  // of that article's Glass Playground. To go back to the site's own glass,
  // set this to false; the look lives under .lg-aave in the stylesheet and in
  // the AAVE section below, and nothing else changes.
  var AAVE = true;
  if (AAVE) document.documentElement.classList.add('lg-aave');

  var brands = navigator.userAgentData && navigator.userAgentData.brands;
  var chromium = !!(brands && brands.some(function (b) { return /Chromium/.test(b.brand); }));
  if (!chromium) return;
  if (window.matchMedia('(prefers-reduced-transparency: reduce)').matches) return;

  var NS = 'http://www.w3.org/2000/svg';

  // Two looks. 'clear' is the one the site had; 'lensed' bends the backdrop
  // further in from the rim and harder, splits its colours more at the edge,
  // and frosts it less, so more of what is behind shows through bent. To go
  // back, set LOOK to LOOKS.clear. Nothing else changes between them.
  var LOOKS = {
    clear:  { band: 14, scale: 22, fringe: 0.04, blur: 8 },
    lensed: { band: 20, scale: 40, fringe: 0.15, blur: 6 }   // was band 18, scale 34, fringe 0.12, blur 5
  };
  var LOOK = LOOKS.lensed;

  var BAND = LOOK.band;     // px from the rim that bends
  var SCALE = LOOK.scale;   // strongest pull, in px, at the very edge
  var FRINGE = LOOK.fringe; // how much further green and blue are pulled than red
  var BLUR = LOOK.blur;     // frost on the backdrop before it is bent

  var defs = document.createElementNS(NS, 'svg');
  defs.setAttribute('width', '0');
  defs.setAttribute('height', '0');
  defs.setAttribute('aria-hidden', 'true');
  defs.style.position = 'absolute';
  document.body.appendChild(defs);

  /* ---------- AAVE ----------
     Their Glass Playground's defaults, as set in its source and measured on
     the live page. Its lens is 159px across (the source's 80 is a
     half-width), so the sizes are kept as shares of the glass's shorter
     side: on 159px they come back to the Playground's own 40px fade, a dome
     as deep as the lens allows, 53.5px of pull (0.07 of its 764px box) and
     0.5px of blur. */
  var AV = {
    depth: 40 / 159,    // the soft step that brings the bend in from the rim
    curvature: 1,       // dome depth = curvature x the shorter side
    scale: 0.07 / 0.208,// pull, as a share of the shorter side
    chroma: 0.4,        // red pulled 1 + 0.2c, green 1 + 0.1c, blue 1
    blur: 0.5,          // px, on the backdrop before it is bent
    rotation: 45,       // the angle the rim catches the light at
    glow: 0.1, glowSpread: 1, glowExponent: 0.5,
    edge: 0.25, edgeWidth: 3, edgeExponent: 1.5,
    specular: 1
  };

  // Their erf, dome and slope, unchanged.
  function avErf(x) { return Math.tanh(1.7724538509 * x); }
  function avMeanSlope(R, h) {
    var sum = 0;
    for (var n = 0; n <= 200; n++) {
      var a = n / 200 * h, s = a / Math.sqrt(R * R - a * a);
      sum += (n === 0 || n === 200) ? 0.5 * s : s;
    }
    return sum / 200;
  }
  function avDome(depth, hw, hh) {
    var a = Math.max(0.01, Math.min(depth, Math.min(hw, hh) - 1));
    var Rx = (hw * hw + a * a) / (2 * a), Ry = (hh * hh + a * a) / (2 * a);
    var l = avMeanSlope(Rx, hw), i = avMeanSlope(Ry, hh);
    return { Rx: Rx, Ry: Ry, scaleX: l > 0 ? 0.5 / l : 1, scaleY: i > 0 ? 0.5 / i : 1 };
  }
  function avDomeGradient(d, R, scale) {
    var n = Math.min(d, 0.999 * R);
    return n / Math.sqrt(R * R - n * n) * scale;
  }

  // Their displacement map: red and green the push, blue the rim's light,
  // neutral grey outside the shape.
  function avMap(w, h, radius) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var img = c.getContext('2d').createImageData(w, h), D = img.data;
    var hw = w / 2, hh = h / 2, short = Math.min(w, h);
    var depth = AV.depth * short;
    var S = Math.min(radius, Math.min(hw, hh));
    var iw = Math.max(0, hw - depth), ih = Math.max(0, hh - depth);
    var v = Math.max(0, Math.min(radius, Math.min(iw, ih)));
    var E = depth > 0 ? 1 / (depth * Math.SQRT2) : 1e6;
    var rot = AV.rotation * Math.PI / 180, k = Math.cos(rot), j = Math.sin(rot);
    var I = (1 - AV.glowSpread) * Math.SQRT2, T = AV.glowSpread * Math.SQRT2;
    var F = AV.curvature > 0 ? avDome(AV.curvature * short, hw, hh) : null;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var p = (y * w + x) * 4;
        var o = x + 0.5 - hw, f = y + 0.5 - hh, g = Math.abs(o), q = Math.abs(f);
        var M = g - hw + S, C = q - hh + S, L = Math.max(M, 0), H = Math.max(C, 0);
        var sd = Math.sqrt(L * L + H * H) + Math.min(Math.max(M, C), 0) - S;
        if (sd < 0) {
          var u = F ? Math.sign(o) * avDomeGradient(g, F.Rx, F.scaleX) : Math.max(-1, Math.min(1, o / hw));
          var m = F ? Math.sign(f) * avDomeGradient(q, F.Ry, F.scaleY) : Math.max(-1, Math.min(1, f / hh));
          var e1 = g - iw + v, t1 = q - ih + v;
          var rin = Math.sqrt(Math.pow(Math.max(e1, 0), 2) + Math.pow(Math.max(t1, 0), 2)) + Math.min(Math.max(e1, t1), 0) - v;
          var fall = 0.5 * (1 + avErf(rin * E));
          D[p] = Math.round((0.5 - 0.5 * u * fall) * 255);
          D[p + 1] = Math.round((0.5 - 0.5 * m * fall) * 255);
          var e2 = Math.abs(Math.max(-1, Math.min(1, o / hw)) * k + Math.max(-1, Math.min(1, f / hh)) * j), r = 0;
          if (AV.glow > 0) r += AV.glow * Math.pow(T > 0.001 ? Math.min(1, Math.max(0, e2 - I) / T) : 0, AV.glowExponent) * fall;
          if (AV.edge > 0) r += AV.edge * Math.max(0, 1 + sd / AV.edgeWidth) * Math.pow(e2, AV.edgeExponent);
          D[p + 2] = Math.round(127 * Math.min(1, r) + 128);
        } else {
          D[p] = 128; D[p + 1] = 128; D[p + 2] = 128;
        }
        D[p + 3] = 255;
      }
    }
    c.getContext('2d').putImageData(img, 0, 0);
    return c.toDataURL();
  }

  // Their filter: blur, three displacements a channel each, added back
  // together, then the rim's light added on top.
  function avFilter(id, w, h, radius) {
    var short = Math.min(w, h), s = AV.scale * short, c = AV.chroma;
    var f = el('filter', {
      id: id, x: '0', y: '0', width: w, height: h,
      filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse',
      'color-interpolation-filters': 'sRGB'
    });
    var url = avMap(w, h, radius);
    var map = el('feImage', { x: '0', y: '0', width: w, height: h, preserveAspectRatio: 'none', result: 'map' });
    map.setAttribute('href', url);
    map.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', url);
    f.appendChild(map);
    f.appendChild(el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: String(AV.blur), result: 'blurred' }));
    [[s * (1 + 0.2 * c), '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', 'dispR'],
     [s * (1 + 0.1 * c), '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', 'dispG'],
     [s, '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0', 'dispB']].forEach(function (pass) {
      f.appendChild(el('feDisplacementMap', { in: 'blurred', in2: 'map', scale: pass[0].toFixed(3), xChannelSelector: 'R', yChannelSelector: 'G' }));
      f.appendChild(el('feColorMatrix', { type: 'matrix', values: pass[1], result: pass[2] }));
    });
    f.appendChild(el('feComposite', { in: 'dispR', in2: 'dispG', operator: 'arithmetic', k1: '0', k2: '1', k3: '1', k4: '0', result: 'rg' }));
    f.appendChild(el('feComposite', { in: 'rg', in2: 'dispB', operator: 'arithmetic', k1: '0', k2: '1', k3: '1', k4: '0', result: 'lensRaw' }));
    // Chrome's displacement takes the nearest pixel with no smoothing, so
    // where the lens stretches the page each pixel becomes a block, and the
    // colour split, rounded to whole pixels, leaves single red, green and
    // blue dots instead of a fringe. On a 2x screen these are small enough to
    // pass; on a 1x screen they show. A smoothing pass of 0.8 device pixels
    // blends them into the smooth result they stand for (Chrome skips one
    // under about 0.6), little enough that the page behind still reads
    // through. Their filter has no such pass; it is the one addition.
    var smooth = 0.8 / Math.min(2, window.devicePixelRatio || 1);
    f.appendChild(el('feGaussianBlur', { in: 'lensRaw', stdDeviation: smooth.toFixed(2), result: 'lensResult' }));
    f.appendChild(el('feColorMatrix', { in: 'map', type: 'matrix', values: '0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 1 0 ' + (-128 / 255), result: 'specMask' }));
    f.appendChild(el('feComposite', { in: 'specMask', in2: 'lensResult', operator: 'arithmetic', k1: '0', k2: String(AV.specular), k3: '1', k4: '0' }));
    return f;
  }

  // Signed distance to a rounded rectangle centred on the origin.
  function sdf(x, y, hw, hh, r) {
    var qx = Math.abs(x) - hw + r, qy = Math.abs(y) - hh + r;
    var ox = Math.max(qx, 0), oy = Math.max(qy, 0);
    return Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(qx, qy), 0) - r;
  }

  function drawMap(w, h, r, band) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    var img = ctx.createImageData(w, h), d = img.data;
    var hw = w / 2, hh = h / 2;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var px = x + 0.5 - hw, py = y + 0.5 - hh;
        var s = sdf(px, py, hw, hh, r);
        var dx = 0, dy = 0;
        if (s > -band) {
          // Outward normal from the distance field's slope.
          var nx = sdf(px + 1, py, hw, hh, r) - sdf(px - 1, py, hw, hh, r);
          var ny = sdf(px, py + 1, hw, hh, r) - sdf(px, py - 1, hw, hh, r);
          var len = Math.sqrt(nx * nx + ny * ny) || 1;
          var m = 1 + Math.max(s, -band) / band;   // 0 at the band's inner edge, 1 at the rim
          m = m * m;
          // Pull inward: sample from further inside the pill.
          dx = -nx / len * m;
          dy = -ny / len * m;
        }
        var i = (y * w + x) * 4;
        d[i] = 128 + dx * 127;
        d[i + 1] = 128 + dy * 127;
        d[i + 2] = 128;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL();
  }

  function el(name, attrs) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  // One channel of the displaced backdrop, the other two zeroed.
  function channel(filter, scale, keep, result) {
    filter.appendChild(el('feDisplacementMap', {
      in: 'soft', in2: 'map', scale: scale.toFixed(1),
      xChannelSelector: 'R', yChannelSelector: 'G', result: result + '-d'
    }));
    var rows = ['0 0 0 0 0', '0 0 0 0 0', '0 0 0 0 0'];
    rows[keep] = ['1 0 0 0 0', '0 1 0 0 0', '0 0 1 0 0'][keep];
    filter.appendChild(el('feColorMatrix', {
      in: result + '-d', type: 'matrix', values: rows.join(' ') + ' 0 0 0 1 0', result: result
    }));
  }

  function build(pill, i) {
    var r = pill.getBoundingClientRect();
    var w = Math.round(r.width), h = Math.round(r.height);
    if (!w || !h) return;
    var key = w + 'x' + h;
    if (pill._lgKey === key) return;
    pill._lgKey = key;

    // Aave's glass for every element, a filter per size, built once.
    if (AAVE) {
      var aid = 'lg-aave-' + key;
      if (!document.getElementById(aid)) defs.appendChild(avFilter(aid, w, h, Math.min(w / 2, h / 2)));
      pill.style.setProperty('--lg-backdrop', 'url(#' + aid + ')');
      return;
    }

    // The cursor's lens changes size every frame as it grows and shrinks, and
    // drawing a map is the costly part, so a lens is built once per size and
    // kept; passing through the same sizes again reuses it.
    var lens = pill.getAttribute('data-lg') === 'lens';
    var id = lens ? 'lg-lens-' + key : 'lg-' + i;
    if (lens && document.getElementById(id)) {
      pill.style.setProperty('--lg-backdrop', 'url(#' + id + ')');
      return;
    }
    var old = document.getElementById(id);
    if (old) old.remove();

    var radius = Math.min(h / 2, w / 2);
    // Something smaller than the header pills, such as the cursor at rest,
    // would be pulled from beyond its own edge at full strength, so the pull
    // is held to its size there. The pills themselves are untouched.
    var scale = radius < 16 ? radius * 1.2 : SCALE;
    var band = BAND, fringe = FRINGE, blur = BLUR, sat = '1.5', warm = false;
    // data-lg="lens" is a round magnifier rather than a pane, measured off the
    // two lenses Edward chose by tracing the shapes behind them: a light
    // frost, which they do not have but Edward asked for; the middle of the
    // disc shows the page where it really is, out to about 74 per cent of
    // the radius; in the outer band the page is pulled
    // in from the middle, by 0.5 of the radius at the rim (a step past the references, by Edward's call); a copper fringe
    // about 5 per cent of the radius wide; colours left as they are.
    if (lens) {
      band = 0.26 * radius;   // was 0.22
      scale = 1.0 * radius;   // was 0.8; the map holds half its range, so this pulls 0.5 of the radius
      fringe = 0.05;          // was 0.03
      blur = 2;               // was 1.2; a light frost, by Edward's call
      sat = '1';
      warm = true;            // red pulled furthest, so the fringe on the rim side is copper, as in the references
    }
    var f = el('filter', {
      id: id, x: '0', y: '0', width: w, height: h,
      filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse',
      'color-interpolation-filters': 'sRGB'
    });
    var map = el('feImage', { x: '0', y: '0', width: w, height: h, preserveAspectRatio: 'none', result: 'map' });
    var url = drawMap(w, h, radius, band);
    map.setAttribute('href', url);
    map.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', url);
    f.appendChild(map);
    f.appendChild(el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: String(blur), result: 'soft' }));
    channel(f, scale * (1 + (warm ? 2 : 0) * fringe), 0, 'r');
    channel(f, scale * (1 + fringe), 1, 'g');
    channel(f, scale * (1 + (warm ? 0 : 2) * fringe), 2, 'b');
    f.appendChild(el('feBlend', { in: 'r', in2: 'g', mode: 'screen', result: 'rg' }));
    f.appendChild(el('feBlend', { in: 'rg', in2: 'b', mode: 'screen', result: 'rgb' }));
    f.appendChild(el('feColorMatrix', { in: 'rgb', type: 'saturate', values: sat }));
    defs.appendChild(f);

    pill.style.setProperty('--lg-backdrop', 'url(#' + id + ')');
  }

  function buildAll() { pills.forEach(build); }

  buildAll();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildAll);
  if ('ResizeObserver' in window) {
    var ro = new ResizeObserver(buildAll);
    pills.forEach(function (p) { ro.observe(p); });
  } else {
    window.addEventListener('resize', buildAll);
  }

  // Glass made after this script has run, such as the cursor, which
  // js/cursor.js draws, asks for its own lens here and is kept up to date as
  // it changes size.
  window.liquidGlass = function (node) {
    if (pills.indexOf(node) >= 0) return;
    pills.push(node);
    build(node, pills.length - 1);
    if (ro) ro.observe(node);
  };
})();
