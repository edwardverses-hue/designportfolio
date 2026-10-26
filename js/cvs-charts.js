/* The CVS case study's charts, drawn from the figures the page cites and
   moved the way the charts in ramp.design's "Charts Glow Up" reel move.
   Measured from that reel at 50ms steps: a chart arrives in a 150ms blur and
   fade, then its bars grow and its numbers count up together over 400ms on
   an ease-out cubic (the gauge's 4, 19, 38, 50, 57, 62, 65, 67, 68 is that
   curve), each bar 50ms after the one before it.

   A chart is drawn at the width it has, not scaled, so its type is the
   page's own. It plays when it comes into view and plays again each time it
   comes back, as the prototype phones do. The Pause motion control and a
   system set to reduced motion both show it finished. */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var GROW = 400;
  var STAGGER = 50;
  var ARRIVE = 150;
  var SVG = 'http://www.w3.org/2000/svg';
  var NAVY = '#1E4B94';
  var WASH = '#C9D8EF';

  /* GLASS: the bars and the dial as navy liquid glass, after the site's own
     glass. There is nothing behind a bar but white page and the dashed
     gridlines, so a backdrop blur would have nothing to show; what makes
     glass read on white is a translucent body, a bright rim on the inside of
     its edge, a highlight along the top, and the gridlines seen through it,
     bent a few pixels as a lens would bend them. false puts back the plain
     navy gradient. */
  var GLASS = false;

  /* LOOK: 'glow' draws the bars and the dial as frosted glass with a light
     in the site's greys behind it, after a glass pie by Irina Devyatova: the colour
     sits in the middle, the glass softens it and keeps a white rim at the
     edge. The glass blurs what is behind it for real (backdrop-filter), so
     these layers are HTML over the chart's SVG; axes and labels are
     unchanged. 'flat' puts back the plain navy gradient. */
  var LOOK = 'bare';
  // BLUE: the bare look in the reference's fading blue instead of grey bars
  // and a flat highlight. false puts back grey bars with the --chart-accent.
  var BLUE = true;
  // 'surface' is the panel on the site's flat --surface grey, #F5F5F5, with
  // the bars in white and black. Both share the panel's layout.
  // 'bare' is the same on the white page itself, no panel, the bars in the
  // site's #D9D9D9 grey and the one a chart is about in black.
  var PANEL = LOOK === 'panel' || LOOK === 'surface' || LOOK === 'bare';

  /* 'panel': each chart on a panel of its own, a soft grainy gradient in the
     site's greys, with the bars as frosted white glass (the series a chart is
     about near-opaque, the rest translucent) and every line, label and figure
     in thin white. After a chart in an AI agents reel. The panel's colours are
     in style.css under CHARTS: PANEL LOOK. */

  function pct(v) { return Math.round(v) + '%'; }
  function usd(v) { return '$' + Math.round(v); }

  /* ---------- the figures ---------- */

  /* The share of each age band's coupon redemptions made in the app, from
     the Coupon Redemptions tab, August and September 2024 added together:
     in-app / (in-app + printed). 25,696 of 31,753; 37,637 of 59,432; 14,822
     of 47,002; 3,276 of 42,517. */
  var SHARE = {
    bands: [['18–29'], ['30–49'], ['50–64'], ['65+']],
    values: [81, 63, 32, 8],
    focus: [3],
    max: 100,
    ticks: [0, 50, 100],
    fmt: pct
  };

  /* EBRI's Fast Fact, December 2024: the average forfeiture of workers whose
     claims were all auto-substantiated against those with at least one
     manual claim, 407 and 293 dollars as reported by Investopedia; the 114
     dollar gap between them is EBRI's own figure. */
  var SUBST = {
    bands: [['All approved', 'at the register'], ['At least one', 'by hand']],
    values: [407, 293],
    // The automatic group is the point: it forfeited more.
    focus: [0],
    max: 500,
    ticks: [0, 250, 500],
    fmt: usd
  };

  /* EBRI's analysis of 3.2 million FSAs for 2022: 52% of accountholders
     forfeited funds. */
  var FORFEIT = { percent: 52 };

  /* ---------- helpers ---------- */
  var uid = 0;
  function el(name, attrs, parent) {
    var n = document.createElementNS(SVG, name);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(n);
    return n;
  }
  function html(tag, cls, text, parent) {
    var n = document.createElement(tag);
    n.className = cls;
    if (text) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  // A bar with its top corners rounded and its foot square on the baseline.
  function barPath(x, base, w, h, r) {
    if (h <= 0) return 'M' + x + ',' + base + 'h' + w + 'v0h' + (-w) + 'z';
    r = Math.min(r, w / 2, h);
    return 'M' + x + ',' + base +
      'V' + (base - h + r) +
      'Q' + x + ',' + (base - h) + ' ' + (x + r) + ',' + (base - h) +
      'H' + (x + w - r) +
      'Q' + (x + w) + ',' + (base - h) + ' ' + (x + w) + ',' + (base - h + r) +
      'V' + base + 'Z';
  }
  function gradient(svg, top, bottom) {
    var id = 'cvs-chart-grad-' + (++uid);
    var defs = el('defs', {}, svg);
    var g = el('linearGradient', { id: id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: '0%', 'stop-color': top }, g);
    el('stop', { offset: '100%', 'stop-color': bottom }, g);
    return 'url(#' + id + ')';
  }

  /* Every chart is a list of parts, each able to show itself at a fraction k
     of the way grown, in the order it should start. The scaffold does the
     arriving, the growing, the staggering, the resetting and the redrawing. */
  function scaffold(fig, build) {
    var parts = [];
    var done = false;
    var run = 0;

    function draw() {
      [].slice.call(fig.children).forEach(function (n) { n.remove(); });
      // Drawn inside the figure's padding, which the panel look gives it.
      fig.classList.toggle('is-panel', LOOK === 'panel' || LOOK === 'surface');
      fig.classList.toggle('is-surface', LOOK === 'surface' || LOOK === 'bare');
      fig.classList.toggle('is-bare', LOOK === 'bare');
      fig.classList.toggle('is-blue', LOOK === 'bare' && BLUE);
      var cs = getComputedStyle(fig);
      var inner = fig.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      parts = build(fig, Math.max(inner || 300, 240));
    }
    function set(k) { parts.forEach(function (p) { p.at(k); }); }

    var chart = {
      show: function () { run++; done = true; set(1); },
      reset: function () { run++; done = false; set(0); },
      play: function () {
        var id = ++run;
        done = false;
        set(0);
        fig.animate([{ opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: ARRIVE, easing: 'ease-out', fill: 'both' });
        parts.forEach(function (p, i) {
          var start = null;
          function frame(now) {
            if (id !== run) return;
            if (start === null) start = now;
            var t = Math.min((now - start) / GROW, 1);
            p.at(easeOut(t));
            if (t < 1) window.requestAnimationFrame(frame);
            else if (i === parts.length - 1) done = true;
          }
          window.setTimeout(function () { if (id === run) window.requestAnimationFrame(frame); }, ARRIVE + p.order * STAGGER);
        });
      },
      redraw: function () {
        var wasDone = done;
        draw();
        if (wasDone) chart.show(); else chart.reset();
      }
    };
    draw();
    return chart;
  }

  /* ---------- bars: one series, one point ---------- */
  function bars(data) { return function (fig, W) { return buildBars(fig, W, data); }; }
  function buildBars(fig, W, data) {
    var H = W < 480 ? 240 : 300;
    // A band label may run to a second line; the foot grows to hold it.
    var lines = Math.max.apply(null, data.bands.map(function (b) { return b.length; }));
    var top = 30, bottom = 34 + (lines - 1) * 20, left = 50;
    H += (lines - 1) * 20;
    var plotH = H - top - bottom, plotW = W - left;
    var n = data.values.length;
    var slot = plotW / n;
    var barW = Math.min(slot * 0.62, 104);
    var svg = el('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, class: 'chart__svg', 'aria-hidden': 'true' }, fig);
    var fill = gradient(svg, NAVY, WASH);
    var base = top + plotH;
    var y = function (v) { return base - (v / data.max) * plotH; };
    var parts = [];

    data.ticks.forEach(function (t) {
      if (t) el('line', { x1: left, x2: W, y1: y(t), y2: y(t), class: 'chart__grid' }, svg);
      el('text', { x: left - 10, y: y(t) + 5, class: 'chart__tick', 'text-anchor': 'end' }, svg).textContent = data.fmt(t);
    });
    el('line', { x1: left, x2: W, y1: base, y2: base, class: 'chart__base' }, svg);
    var layer = null;
    if (LOOK === 'glow' || PANEL) {
      layer = html('div', 'chart__glow', '', fig);
      layer.style.left = getComputedStyle(fig).paddingLeft;
      layer.style.top = getComputedStyle(fig).paddingTop;
      layer.style.width = W + 'px';
      layer.style.height = H + 'px';
    }

    data.values.forEach(function (v, i) {
      var x = left + slot * i + (slot - barW) / 2;
      var cx = x + barW / 2;
      var h = (v / data.max) * plotH;
      var bar = PANEL ? panelBar(layer, x, barW, base, data.focus.indexOf(i) >= 0)
        : LOOK === 'glow' ? glowBar(layer, x, barW, base)
        : GLASS ? glassBar(svg, data, x, barW, base, left, W, y)
        : el('path', { d: barPath(x, base, barW, 0, 6), fill: fill }, svg);
      var band = el('text', { x: cx, y: base + 25, class: 'chart__label', 'text-anchor': 'middle' }, svg);
      data.bands[i].forEach(function (line, k) {
        el('tspan', { x: cx, dy: k ? 20 : 0 }, band).textContent = line;
      });
      var label = el('text', { x: cx, y: base - h - 10, class: 'chart__value' + (data.focus.indexOf(i) >= 0 ? ' is-focus' : ''), 'text-anchor': 'middle' }, svg);
      parts.push({
        order: i,
        at: function (k) {
          if (LOOK === 'glow' || PANEL || GLASS) bar.grow(h * k);
          else bar.setAttribute('d', barPath(x, base, barW, h * k, 6));
          label.setAttribute('y', base - h * k - 10);
          label.textContent = k > 0 ? data.fmt(v * k) : '';
        }
      });
    });
    return parts;
  }

  /* One glass bar: a clip in the bar's shape holding a translucent navy body,
     the gridlines seen through it three pixels lower and lighter, and a
     highlight along its top; then a white rim on the inside of the edge and
     a navy hairline outside it, so the shape holds on white. */
  function glassBar(svg, data, x, w, base, left, W, y) {
    var id = 'cvs-glass-' + (++uid);
    var defs = el('defs', {}, svg);
    var body = el('linearGradient', { id: id + '-body', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: '0%', 'stop-color': NAVY, 'stop-opacity': 0.82 }, body);
    el('stop', { offset: '100%', 'stop-color': NAVY, 'stop-opacity': 0.34 }, body);
    var sheen = el('linearGradient', { id: id + '-sheen', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: '0%', 'stop-color': '#fff', 'stop-opacity': 0.5 }, sheen);
    el('stop', { offset: '100%', 'stop-color': '#fff', 'stop-opacity': 0 }, sheen);
    var side = el('linearGradient', { id: id + '-side', x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    el('stop', { offset: '0%', 'stop-color': '#fff', 'stop-opacity': 0.28 }, side);
    el('stop', { offset: '22%', 'stop-color': '#fff', 'stop-opacity': 0 }, side);
    el('stop', { offset: '82%', 'stop-color': '#fff', 'stop-opacity': 0 }, side);
    el('stop', { offset: '100%', 'stop-color': '#fff', 'stop-opacity': 0.14 }, side);
    var clip = el('clipPath', { id: id + '-clip' }, defs);
    var shape = el('path', { d: barPath(x, base, w, 0, 6) }, clip);

    var g = el('g', { 'clip-path': 'url(#' + id + '-clip)' }, svg);
    // The body's gradient runs down each bar, so a short bar is as deep as a tall one.
    var fillRect = el('rect', { x: x, y: base, width: w, height: 0, fill: 'url(#' + id + '-body)' }, g);
    data.ticks.forEach(function (t) {
      if (t) el('line', { x1: x, x2: x + w, y1: y(t) + 3, y2: y(t) + 3, stroke: '#fff', 'stroke-opacity': 0.45, 'stroke-width': 1, 'stroke-dasharray': '3 4' }, g);
    });
    el('rect', { x: x, y: y(data.max), width: w, height: base - y(data.max), fill: 'url(#' + id + '-side)' }, g);
    var top = el('rect', { x: x, y: base, width: w, height: 34, fill: 'url(#' + id + '-sheen)' }, g);
    var rim = el('path', { d: barPath(x, base, w, 0, 6), fill: 'none', stroke: '#fff', 'stroke-opacity': 0.8, 'stroke-width': 2 }, g);
    var edge = el('path', { d: barPath(x, base, w, 0, 6), fill: 'none', stroke: NAVY, 'stroke-opacity': 0.35, 'stroke-width': 0.75 }, svg);

    return {
      grow: function (h) {
        var d = barPath(x, base, w, h, 6);
        shape.setAttribute('d', d);
        rim.setAttribute('d', d);
        edge.setAttribute('d', d);
        top.setAttribute('y', base - h);
        fillRect.setAttribute('y', base - h);
        fillRect.setAttribute('height', h);
      }
    };
  }

  /* One glow bar: the light, a blurred blue to cyan block inset from the
     bar's sides so its colour gathers in the middle, and over it the pane,
     frosted glass the bar's full size with a white rim. A short bar keeps
     most of its light, so it does not wash out to white. */
  function glowBar(layer, x, w, base) {
    var light = html('i', 'chart__glow-light', '', layer);
    var pane = html('i', 'chart__glow-pane', '', layer);
    return {
      grow: function (h) {
        var vis = h > 0.5 ? '' : 'hidden';
        var ix = Math.min(10, w * 0.14), iy = Math.min(10, h * 0.18);
        light.style.cssText = 'left:' + (x + ix) + 'px;width:' + (w - 2 * ix) + 'px;top:' + (base - h + iy) + 'px;height:' + Math.max(0, h - 2 * iy) + 'px;visibility:' + vis;
        pane.style.cssText = 'left:' + x + 'px;width:' + w + 'px;top:' + (base - h) + 'px;height:' + h + 'px;visibility:' + vis;
      }
    };
  }

  /* One panel bar: frosted white glass the bar's size, its corners rounded;
     brighter for the series the chart is about. */
  function panelBar(layer, x, w, base, focus) {
    var pane = html('i', 'chart__pane' + (focus ? ' is-focus' : ''), '', layer);
    return {
      grow: function (h) {
        pane.style.cssText = 'left:' + x + 'px;width:' + w + 'px;top:' + (base - h) + 'px;height:' + h + 'px;visibility:' + (h > 0.5 ? '' : 'hidden');
      }
    };
  }

  /* ---------- gauge ---------- */
  /* The reference's dial: an arc of 250 degrees open at the bottom, round
     ends, the number in the middle, the fill and the number rising together. */
  function buildGauge(fig, W) {
    var data = FORFEIT;
    // As tall as a bar chart (300px with the stroke), narrower if the column is.
    var stroke = LOOK === 'glow' ? 28 : 16, span = 250;
    // Room round the ring for the glow's blur, which the SVG would otherwise
    // cut off at its edge. The whole dial stays 300px.
    var pad = LOOK === 'glow' ? 16 : 0;
    var R = Math.min(150 - stroke / 2 - pad, (W - stroke) / 2 - pad);
    var size = R * 2 + stroke + pad * 2;
    var cx = size / 2, cy = size / 2;
    var C = 2 * Math.PI * R;
    var arc = C * span / 360;
    var wrap = html('div', 'chart__dial', '', fig);
    var svg = el('svg', { width: size, height: size, viewBox: '0 0 ' + size + ' ' + size, class: 'chart__svg', 'aria-hidden': 'true' }, wrap);
    // Dashes start at 3 o'clock; turning the circle puts the arc's start at
    // the lower left, 55 degrees past 6, and its end the same short of it.
    var turn = 'rotate(' + (90 + (360 - span) / 2) + ' ' + cx + ' ' + cy + ')';
    el('circle', { cx: cx, cy: cy, r: R, fill: 'none', class: 'chart__track', 'stroke-width': stroke, 'stroke-linecap': 'round', 'stroke-dasharray': arc + ' ' + C, transform: turn }, svg);
    var fill = el('circle', { cx: cx, cy: cy, r: R, fill: 'none', class: 'chart__fill', 'stroke-width': stroke, 'stroke-linecap': 'round', 'stroke-dasharray': '0 ' + C, transform: turn }, svg);
    // As glass: the band goes translucent, with a white rim running inside
    // its outer edge and a fainter one inside its inner edge.
    var rims = [];
    if (GLASS) {
      fill.setAttribute('stroke-opacity', 0.72);
      [[R + stroke / 2 - 2, 0.85, 1.6], [R - stroke / 2 + 2, 0.4, 1]].forEach(function (r) {
        var c2 = 2 * Math.PI * r[0];
        rims.push({ c: c2, n: el('circle', { cx: cx, cy: cy, r: r[0], fill: 'none', stroke: '#fff', 'stroke-opacity': r[1], 'stroke-width': r[2], 'stroke-linecap': 'round', 'stroke-dasharray': '0 ' + c2, transform: turn }, svg) });
      });
    }
    var glow = LOOK === 'glow' ? glowDial(wrap, svg, size, cx, cy, R, stroke, C, arc, turn) : null;
    // In blue, the arc fades the way the bars do: pale where it starts at the
    // lower left, the full blue where it ends.
    if (LOOK === 'bare' && BLUE) {
      var gid = 'cvs-dial-blue-' + (++uid);
      var defs = el('defs', {}, svg);
      var lg = el('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse', x1: 0, y1: size, x2: 0, y2: 0 }, defs);
      el('stop', { offset: '0%', 'stop-color': '#0B57F2', 'stop-opacity': 0.14 }, lg);
      el('stop', { offset: '100%', 'stop-color': '#0B57F2', 'stop-opacity': 1 }, lg);
      fill.style.stroke = 'url(#' + gid + ')';
    }
    var num = html('p', 'chart__big', '', wrap);
    html('p', 'chart__under', 'forfeited FSA money', wrap);
    return [{
      order: 0,
      at: function (k) {
        var v = data.percent * k;
        fill.setAttribute('stroke-dasharray', (arc * v / 100) + ' ' + C);
        if (glow) glow(v);
        // The rims stop short of the round ends so they stay on the band.
        rims.forEach(function (r) {
          var len = Math.max(0, r.c * span / 360 * v / 100 - stroke * 0.9);
          r.n.setAttribute('stroke-dasharray', len + ' ' + r.c);
          r.n.setAttribute('stroke-dashoffset', -stroke * 0.45);
        });
        num.textContent = Math.round(v) + '%';
      }
    }];
  }

  /* The dial as glow: under a frosted ring the length of the whole arc, the
     value's arc as light, blurred and kept to just past the ring's edge;
     the ring's body is a pale track, so it reads on white, and the navy fill
     goes. */
  function glowDial(wrap, svg, size, cx, cy, R, stroke, C, arc, turn) {
    var id = 'cvs-glowdial-' + (++uid);
    svg.querySelector('.chart__fill').setAttribute('stroke-opacity', 0);
    svg.querySelector('.chart__track').setAttribute('class', 'chart__track is-glow');
    var defs = el('defs', {}, svg);
    var grad = el('linearGradient', { id: id + '-g', gradientUnits: 'userSpaceOnUse', x1: 0, y1: size, x2: size, y2: 0 }, defs);
    el('stop', { offset: '0%', 'stop-color': '#111111' }, grad);
    el('stop', { offset: '55%', 'stop-color': '#4D4D4D' }, grad);
    el('stop', { offset: '100%', 'stop-color': '#999999' }, grad);
    var blur = el('filter', { id: id + '-b', x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs);
    el('feGaussianBlur', { stdDeviation: 7 }, blur);
    var mask = el('mask', { id: id + '-m', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: size, height: size }, defs);
    el('circle', { cx: cx, cy: cy, r: R, fill: 'none', stroke: '#fff', 'stroke-width': stroke + 10, 'stroke-linecap': 'round', 'stroke-dasharray': arc + ' ' + C, transform: turn }, mask);
    var g = el('g', { mask: 'url(#' + id + '-m)' }, svg);
    var light = el('circle', { cx: cx, cy: cy, r: R, fill: 'none', stroke: 'url(#' + id + '-g)', 'stroke-width': stroke - 4, 'stroke-linecap': 'round', 'stroke-dasharray': '0 ' + C, transform: turn, filter: 'url(#' + id + '-b)' }, g);
    // The frosted ring: a div over the SVG, cut to the arc by a mask of the same shape.
    var ring = html('div', 'chart__glow-ring', '', wrap);
    var shape = "<svg xmlns='http://www.w3.org/2000/svg' width='" + size + "' height='" + size + "'><circle cx='" + cx + "' cy='" + cy + "' r='" + R + "' fill='none' stroke='#000' stroke-width='" + stroke + "' stroke-linecap='round' stroke-dasharray='" + arc + " " + C + "' transform='" + turn + "'/></svg>";
    var url = 'url("data:image/svg+xml,' + encodeURIComponent(shape) + '")';
    ring.style.cssText = 'width:' + size + 'px;height:' + size + 'px;-webkit-mask-image:' + url + ';mask-image:' + url;
    // Its rim, inside each edge, over the ring.
    var rims = el('svg', { width: size, height: size, viewBox: '0 0 ' + size + ' ' + size, class: 'chart__svg', 'aria-hidden': 'true' }, wrap);
    [[R + stroke / 2 - 1.2, 0.95, 1.4], [R - stroke / 2 + 1.2, 0.7, 1]].forEach(function (r) {
      var c2 = 2 * Math.PI * r[0];
      el('circle', { cx: cx, cy: cy, r: r[0], fill: 'none', stroke: '#fff', 'stroke-opacity': r[1], 'stroke-width': r[2], 'stroke-dasharray': (c2 * 250 / 360) + ' ' + c2, transform: turn }, rims);
    });
    return function (v) { light.setAttribute('stroke-dasharray', (arc * v / 100) + ' ' + C); };
  }

  /* ---------- wiring ---------- */
  var builders = { share: bars(SHARE), substantiation: bars(SUBST), forfeit: buildGauge };
  var charts = [].slice.call(document.querySelectorAll('.chart[data-chart]')).map(function (fig) {
    var build = builders[fig.getAttribute('data-chart')];
    return build ? { fig: fig, chart: scaffold(fig, build) } : null;
  }).filter(Boolean);
  if (!charts.length) return;

  function paused() { return document.body.classList.contains('motion-paused'); }
  function of(target) { return charts.filter(function (x) { return x.fig === target; })[0]; }

  if ('ResizeObserver' in window) {
    var widths = {};
    var ro = new ResizeObserver(function (entries) {
      entries.forEach(function (en) {
        var c = of(en.target);
        var w = Math.round(en.contentRect.width);
        var key = c && c.fig.getAttribute('data-chart');
        if (!c || widths[key] === w) return;
        widths[key] = w;
        c.chart.redraw();
      });
    });
    charts.forEach(function (c) { ro.observe(c.fig); });
  }

  if (reduce) {
    charts.forEach(function (c) { c.chart.show(); });
    return;
  }
  charts.forEach(function (c) { c.chart.reset(); });

  var toggle = document.querySelector('.motion-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      // The toggle flips the class on the same click; read it after.
      window.setTimeout(function () {
        if (paused()) charts.forEach(function (c) { c.chart.show(); });
      }, 0);
    });
  }

  if (!('IntersectionObserver' in window)) {
    charts.forEach(function (c) { c.chart.show(); });
    return;
  }
  /* Two thresholds, so a chart is never seen emptying. It plays once half of
     it is on screen, and only resets once none of it is, out of sight, ready
     to play again on the way back. */
  var armed = {};
  var play = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      var c = of(en.target);
      var key = c && c.fig.getAttribute('data-chart');
      if (!c || !en.isIntersecting || armed[key] === false) return;
      armed[key] = false;
      if (paused()) c.chart.show(); else c.chart.play();
    });
  }, { threshold: 0.5 });
  var gone = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      var c = of(en.target);
      if (!c || en.isIntersecting) return;
      armed[c.fig.getAttribute('data-chart')] = true;
      c.chart.reset();
    });
  }, { threshold: 0 });
  charts.forEach(function (c) { play.observe(c.fig); gone.observe(c.fig); });
})();
