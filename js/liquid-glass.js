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
  var pills = [].slice.call(document.querySelectorAll('.nav-logo, .nav-center, .nav-right'));
  if (!pills.length) return;

  var brands = navigator.userAgentData && navigator.userAgentData.brands;
  var chromium = !!(brands && brands.some(function (b) { return /Chromium/.test(b.brand); }));
  if (!chromium) return;
  if (window.matchMedia('(prefers-reduced-transparency: reduce)').matches) return;

  var NS = 'http://www.w3.org/2000/svg';
  var BAND = 14;     // px from the rim that bends
  var SCALE = 22;    // strongest pull, in px, at the very edge
  var FRINGE = 0.04; // how much further green and blue are pulled than red

  var defs = document.createElementNS(NS, 'svg');
  defs.setAttribute('width', '0');
  defs.setAttribute('height', '0');
  defs.setAttribute('aria-hidden', 'true');
  defs.style.position = 'absolute';
  document.body.appendChild(defs);

  // Signed distance to a rounded rectangle centred on the origin.
  function sdf(x, y, hw, hh, r) {
    var qx = Math.abs(x) - hw + r, qy = Math.abs(y) - hh + r;
    var ox = Math.max(qx, 0), oy = Math.max(qy, 0);
    return Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(qx, qy), 0) - r;
  }

  function drawMap(w, h, r) {
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
        if (s > -BAND) {
          // Outward normal from the distance field's slope.
          var nx = sdf(px + 1, py, hw, hh, r) - sdf(px - 1, py, hw, hh, r);
          var ny = sdf(px, py + 1, hw, hh, r) - sdf(px, py - 1, hw, hh, r);
          var len = Math.sqrt(nx * nx + ny * ny) || 1;
          var m = 1 + Math.max(s, -BAND) / BAND;   // 0 at the band's inner edge, 1 at the rim
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

    var id = 'lg-' + i;
    var old = document.getElementById(id);
    if (old) old.remove();

    var radius = Math.min(h / 2, w / 2);
    var f = el('filter', {
      id: id, x: '0', y: '0', width: w, height: h,
      filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse',
      'color-interpolation-filters': 'sRGB'
    });
    var map = el('feImage', { x: '0', y: '0', width: w, height: h, preserveAspectRatio: 'none', result: 'map' });
    var url = drawMap(w, h, radius);
    map.setAttribute('href', url);
    map.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', url);
    f.appendChild(map);
    f.appendChild(el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '4', result: 'soft' }));
    channel(f, SCALE, 0, 'r');
    channel(f, SCALE * (1 + FRINGE), 1, 'g');
    channel(f, SCALE * (1 + 2 * FRINGE), 2, 'b');
    f.appendChild(el('feBlend', { in: 'r', in2: 'g', mode: 'screen', result: 'rg' }));
    f.appendChild(el('feBlend', { in: 'rg', in2: 'b', mode: 'screen', result: 'rgb' }));
    f.appendChild(el('feColorMatrix', { in: 'rgb', type: 'saturate', values: '1.5' }));
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
})();
