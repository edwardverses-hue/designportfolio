/* The research section's charts, drawn from the figures in the Region 4
   package and moved the way the charts in ramp.design's "Charts Glow Up"
   reel move. Measured from that reel at 50ms steps: a chart arrives in a
   150ms blur and fade, then its bars grow from the baseline and its numbers
   count up together over 400ms on an ease-out cubic (the gauge's 4, 19, 38,
   50, 57, 62, 65, 67, 68 is that curve), each series 50ms after the one
   before it.

   A chart is drawn at the width it has, not scaled, so its type is the
   page's 14px. It plays when it comes into view and plays again each time it
   comes back, as the prototype phones do. The Pause motion control and a
   system set to reduced motion both show it finished. */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var GROW = 400;
  var STAGGER = 50;
  var ARRIVE = 150;
  var SVG = 'http://www.w3.org/2000/svg';

  /* Coupon redemptions, August and September 2024 together, from the Coupon
     Redemptions tab: the in-app and printed rows, each age band's two months
     added. ExtraBucks rows are not part of the paper-against-app question. */
  var COUPONS = {
    bands: ['18–29', '30–49', '50–64', '65+'],
    series: [
      { key: 'app', label: 'In-app', values: [25696, 37637, 14822, 3276] },
      { key: 'print', label: 'Printed', values: [6057, 21795, 32180, 39241] }
    ],
    max: 40000,
    ticks: [0, 20000, 40000]
  };

  function el(name, attrs, parent) {
    var n = document.createElementNS(SVG, name);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(n);
    return n;
  }
  function fmt(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function tick(n) {
    return n === 0 ? '0' : (n / 1000) + 'K';
  }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  /* ---------- grouped bars ---------- */
  function bars(fig, data) {
    var parts = [];
    var done = false;
    var run = 0;

    function draw() {
      [].slice.call(fig.querySelectorAll('.chart__svg, .chart__legend')).forEach(function (n) { n.remove(); });
      parts = [];
      var W = Math.max(fig.clientWidth || 300, 240), H = 150;
      var top = 26, bottom = 24, left = 34, right = 22;
      var plotH = H - top - bottom, plotW = W - left - right;
      var groups = data.bands.length, per = data.series.length;
      var groupW = plotW / groups, barW = 13, gap = 3;
      var svg = el('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, class: 'chart__svg', 'aria-hidden': 'true' }, fig);
      var y = function (v) { return top + plotH - (v / data.max) * plotH; };

      data.ticks.forEach(function (t) {
        el('line', { x1: left, x2: W - right, y1: y(t), y2: y(t), class: 'chart__grid' }, svg);
        el('text', { x: left - 6, y: y(t) + 5, class: 'chart__tick', 'text-anchor': 'end' }, svg).textContent = tick(t);
      });

      data.bands.forEach(function (band, g) {
        var cx = left + groupW * (g + 0.5);
        el('text', { x: cx, y: H - 6, class: 'chart__label', 'text-anchor': 'middle' }, svg).textContent = band;
        data.series.forEach(function (s, i) {
          var v = s.values[g];
          var x = cx - (per * barW + (per - 1) * gap) / 2 + i * (barW + gap);
          var h = (v / data.max) * plotH;
          var rect = el('rect', { x: x, y: y(v), width: barW, height: h, rx: 2, class: 'chart__bar is-' + s.key }, svg);
          var label = null;
          // The last group is the one the card is about, so its two bars
          // carry their numbers. The left one's sits flush to its bar's right
          // edge so it stays clear of the black bar beside it.
          if (g === groups - 1) {
            var last = i === per - 1;
            label = el('text', {
              x: last ? x + barW / 2 : x + barW - 2,
              y: y(v) - 7,
              class: 'chart__value',
              'text-anchor': last ? 'middle' : 'end'
            }, svg);
            label.textContent = fmt(v);
          }
          parts.push({ rect: rect, label: label, value: v, base: y(0), height: h, order: g * per + i });
        });
      });

      var legend = document.createElement('p');
      legend.className = 'chart__legend';
      data.series.forEach(function (s) {
        var item = document.createElement('span');
        item.className = 'chart__key is-' + s.key;
        item.textContent = s.label;
        legend.appendChild(item);
      });
      fig.appendChild(legend);
      fig.insertBefore(svg, fig.firstChild);
      fig.insertBefore(legend, svg.nextSibling);
    }

    function set(k) {
      parts.forEach(function (p) {
        p.rect.setAttribute('y', p.base - p.height * k);
        p.rect.setAttribute('height', p.height * k);
        if (p.label) p.label.textContent = k > 0 ? fmt(p.value * k) : '';
      });
    }

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
            var k = easeOut(t);
            p.rect.setAttribute('y', p.base - p.height * k);
            p.rect.setAttribute('height', p.height * k);
            if (p.label) p.label.textContent = fmt(p.value * k);
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

  /* ---------- wiring ---------- */
  var charts = [].slice.call(document.querySelectorAll('.chart[data-chart]')).map(function (fig) {
    var c = fig.getAttribute('data-chart') === 'coupons' ? bars(fig, COUPONS) : null;
    return c ? { fig: fig, chart: c } : null;
  }).filter(Boolean);
  if (!charts.length) return;

  function paused() { return document.body.classList.contains('motion-paused'); }

  if ('ResizeObserver' in window) {
    var widths = {};
    var ro = new ResizeObserver(function (entries) {
      entries.forEach(function (en) {
        var w = Math.round(en.contentRect.width);
        var c = charts.filter(function (x) { return x.fig === en.target; })[0];
        if (!c || widths[c.fig.getAttribute('data-chart')] === w) return;
        widths[c.fig.getAttribute('data-chart')] = w;
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
  var seen = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      var c = charts.filter(function (x) { return x.fig === en.target; })[0];
      if (!c) return;
      if (en.isIntersecting) {
        if (paused()) c.chart.show(); else c.chart.play();
      } else {
        c.chart.reset();
      }
    });
  }, { threshold: 0.5 });
  charts.forEach(function (c) { seen.observe(c.fig); });
})();
