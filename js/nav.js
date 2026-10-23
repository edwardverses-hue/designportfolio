/* Header behaviour.

   Two jobs. The bar itself is transparent, and each pill stays invisible until
   there is something behind it to frost. And Work/Play share one pill with a
   thumb that slides between them.

   "Something behind it" means either the page has been scrolled at all, which
   puts body copy under the bar, or a picture actually overlaps the bar, which
   is how the Play page behaves: that page never scrolls and instead turns
   artwork up through the top of the frame. */
(function () {
  var nav = document.querySelector('.nav');
  if (!nav) return;

  // The header's words drawn white in difference, as the cursor's "View" is,
  // so they come out black over light and white over dark by themselves.
  // Difference only reaches what shares a layer with the words, and the
  // header is a fixed layer of its own, so blended in place they would only
  // ever see the header and turn white on the white page. Instead each word
  // is copied into a layer on the page itself, set exactly over the real
  // one, and the real words are made transparent. The links stay where they
  // are for clicking, keyboards and screen readers; the copies are hidden
  // from them. To go back, set this to false; the look lives under
  // .nav-blend and .nav-ghost in the stylesheet.
  var LABEL_BLEND = true;
  if (LABEL_BLEND) {
    document.documentElement.classList.add('nav-blend');
    var ghost = document.createElement('div');
    ghost.className = 'nav-ghost';
    ghost.setAttribute('aria-hidden', 'true');
    var words = [].slice.call(nav.querySelectorAll('.nav-logo, .nav-right, .nav-center a'));
    var copies = words.map(function (w) {
      var s = document.createElement('span');
      s.className = 'nav-ghost__word';
      s.textContent = w.textContent.trim();
      ghost.appendChild(s);
      return s;
    });
    document.body.appendChild(ghost);

    // The copy takes the word's own type and sits on the box the text itself
    // draws in, so the two line up to the pixel.
    var placeWords = function () {
      words.forEach(function (w, i) {
        var range = document.createRange();
        range.selectNodeContents(w);
        var r = range.getBoundingClientRect();
        var cs = getComputedStyle(w), c = copies[i];
        c.style.font = cs.font;
        c.style.letterSpacing = cs.letterSpacing;
        c.style.transform = 'translate(' + r.left.toFixed(2) + 'px,' + r.top.toFixed(2) + 'px)';
        // A block's text starts a little inside its box; measure that and
        // take it off, so the copy's letters land on the real ones.
        var cr = document.createRange();
        cr.selectNodeContents(c);
        var b = cr.getBoundingClientRect();
        var x = 2 * r.left - b.left, y = 2 * r.top - b.top;
        c.style.transform = 'translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px)';
      });
    };
    placeWords();
    window.addEventListener('resize', placeWords);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeWords);
  }

  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- frosted pills ---------- */

  var ART = 'img, .project-card, .case-hero-image, .about-image, .panel';
  // The home page's rain also counts as something behind the bar, so the pills
  // frost over it. It does not count as a picture for the Work marker below:
  // thin grey lines are not a reason to swap its stroke for a white fill.
  // It is the rain layer itself that counts, so while it is hidden the hero is
  // plain white again and the pills stay clear over it.
  var BEHIND = ART + ', .rain-hero__sky';
  var lit = null;
  var onRain = null;

  function overlapsBar(height, selector) {
    var art = document.querySelectorAll(selector || BEHIND);
    for (var i = 0; i < art.length; i++) {
      var el = art[i];
      if (nav.contains(el)) continue;
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.bottom <= 0 || r.top >= height) continue;
      if (r.right <= 0 || r.left >= window.innerWidth) continue;
      if (getComputedStyle(el).visibility === 'hidden') continue;
      return true;
    }
    return false;
  }

  var onArt = null;

  function check() {
    var height = nav.getBoundingClientRect().height;
    var next = window.scrollY > 4 || overlapsBar(height);
    if (next !== lit) {
      lit = next;
      nav.classList.toggle('nav-lit', next);
    }
    var art = artBehindMarker();
    if (art !== onArt) {
      onArt = art;
      nav.classList.toggle('nav-art', art);
    }
    // White glass on a white page cannot be seen, so over the rain the pills
    // take the rim the CSS gives them under nav-rain.
    var rain = overlapsBar(height, '.rain-hero__sky') && !overlapsBar(height, ART);
    if (rain !== onRain) {
      onRain = rain;
      nav.classList.toggle('nav-rain', rain);
    }
    slow();
  }

  // The two checks that read pixels or hit-test the Play room are the costly
  // ones, so they run at most every 100ms while things move, and once more
  // when they stop, so the header always ends on the right state.
  var slowAt = 0, slowLater = null;
  function slow() {
    var now = Date.now();
    window.clearTimeout(slowLater);
    if (now - slowAt >= 100) {
      slowAt = now;
      if (room) playOver();
      tone();
    }
    slowLater = window.setTimeout(function () {
      slowAt = Date.now();
      if (room) playOver();
      tone();
    }, 120);
  }

  // Scroll events can arrive several times a frame; the header is checked
  // once per frame.
  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(function () { queued = false; check(); });
  }

  /* ---------- Play: a work under the wordmark or About ---------- */

  // The Play room draws its works as facets, which the checks above do not
  // count, and the header there stays clear until a work actually passes
  // under the words of the wordmark or About. The test is points across the
  // text itself, the pill less its padding, asked of the browser's own hit
  // testing: a poster on a side wall is a slanted shape, and its bounding box
  // would light the pill while only empty floor was under the words.
  var room = document.getElementById('room');
  var playPills = room ? [].slice.call(nav.querySelectorAll('.nav-logo, .nav-right')) : [];

  function workUnder(el) {
    var r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    var left = r.left + (parseFloat(cs.paddingLeft) || 0), right = r.right - (parseFloat(cs.paddingRight) || 0);
    var top = r.top + (parseFloat(cs.paddingTop) || 0), bottom = r.bottom - (parseFloat(cs.paddingBottom) || 0);
    // Eight points, four across the middle and four across the foot of the
    // words, where a poster rising from below arrives first.
    for (var gy = 1; gy < 3; gy++) {
      for (var gx = 0; gx < 4; gx++) {
        var x = left + (right - left) * gx / 3, y = top + (bottom - top) * gy / 2;
        var hits = document.elementsFromPoint(x, y);
        for (var i = 0; i < hits.length; i++) {
          if (hits[i].classList && hits[i].classList.contains('facet')) return true;
        }
      }
    }
    return false;
  }

  function playOver() {
    for (var k = 0; k < playPills.length; k++) {
      var hit = workUnder(playPills[k]);
      if (playPills[k].classList.contains('is-over') !== hit) playPills[k].classList.toggle('is-over', hit);
    }
  }

  /* ---------- the sliding marker ---------- */

  // The pill is handed over to one element that can travel between the links,
  // because a class moving from one link to the other can only jump. The
  // marker animates to the clicked link first and the page follows once it has
  // arrived, so the movement is seen rather than cut off by the navigation.
  var centre  = nav.querySelector('.nav-center');
  var current = centre ? centre.querySelector('a.is-current') : null;
  var marker  = null;

  function place(link, animate) {
    if (!marker || !link) return;
    var box = centre.getBoundingClientRect();
    var r = link.getBoundingClientRect();
    var inset = parseFloat(getComputedStyle(centre).borderLeftWidth) || 0;
    if (!animate) marker.classList.add('no-anim');
    marker.style.width = r.width.toFixed(2) + 'px';
    marker.style.transform = 'translateX(' + (r.left - box.left - inset).toFixed(2) + 'px)';
    marker.classList.add('is-set');
    if (!animate) {
      void marker.offsetWidth;            // flush, so the next move does animate
      marker.classList.remove('no-anim');
    }
  }

  if (centre && current) {
    marker = document.createElement('span');
    marker.className = 'nav-marker';
    centre.insertBefore(marker, centre.firstChild);
    nav.classList.add('nav-js');
    place(current, false);

    centre.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a') : null;
      if (!a || !centre.contains(a) || a === current) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#') return;

      e.preventDefault();
      if (still) { window.location.href = href; return; }

      place(a, true);

      var gone = false;
      function follow() {
        if (gone) return;
        gone = true;
        window.location.href = href;
      }
      // Leave once the marker has arrived, with a timer in reserve in case the
      // transition never reports finishing.
      marker.addEventListener('transitionend', function (ev) {
        if (ev.propertyName === 'transform') follow();
      }, { once: true });
      window.setTimeout(follow, 460);
    });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { place(current, false); });
    }
  }

  /* ---------- is a picture behind the marker? ---------- */

  // The pill swaps its black stroke for a white fill only when a picture is
  // genuinely behind it, not merely because the page has been scrolled.
  // On the About page the current pill is About itself, outside the centre.
  var currentPill = current || nav.querySelector('.nav-right.is-current');

  function artBehindMarker() {
    if (!currentPill) return false;
    var m = currentPill.getBoundingClientRect();
    var art = document.querySelectorAll(ART);
    for (var i = 0; i < art.length; i++) {
      var el = art[i];
      if (nav.contains(el)) continue;
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.right <= m.left || r.left >= m.right) continue;
      if (r.bottom <= m.top || r.top >= m.bottom) continue;
      if (getComputedStyle(el).visibility === 'hidden') continue;
      return true;
    }
    return false;
  }

  /* ---------- is it dark behind a pill? ---------- */

  // The glass is clear enough to take its shade from what is behind it, so
  // over a black picture it is dark, and black labels on it would vanish.
  // Each pill turns its labels white over dark, judged on its own: the
  // wordmark can sit over a black screenshot while About is still over the
  // white page beside it. The glass itself never changes.
  //
  // A pill is dark when most of a grid of points across it lands on something
  // dark: the part of a picture actually under it, read from a small copy of
  // the image, or a black panel. Reading the image itself, rather than tagging
  // pictures by hand, keeps it right as screenshots are added or swapped.
  var pills = [].slice.call(document.querySelectorAll('.nav-logo, .nav-center, .nav-right, .lg-glass'));
  var PANELS = '.widget-demo';
  var thumbs = {};  // src -> { w, h, data } at no more than 96px wide, or false

  function thumb(img) {
    var src = img.currentSrc || img.src;
    if (!src || !img.complete || !img.naturalWidth) return null;
    if (src in thumbs) return thumbs[src];
    try {
      var w = Math.min(96, img.naturalWidth);
      var h = Math.max(1, Math.round(w * img.naturalHeight / img.naturalWidth));
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      var ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      thumbs[src] = { w: w, h: h, data: ctx.getImageData(0, 0, w, h).data };
    } catch (e) {
      thumbs[src] = false;  // a page opened from disk cannot read its pixels
    }
    return thumbs[src];
  }

  function shown(el) {
    for (var n = el; n && n !== document.body; n = n.parentElement) {
      var cs = getComputedStyle(n);
      if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.5) return false;
    }
    return true;
  }

  // Luminance 0-255 of the picture at a point on screen, or null where the
  // picture leaves that point uncovered (outside a contained image, or a
  // transparent pixel), so whatever is beneath it decides instead.
  function pixel(img, r, x, y) {
    var t = thumb(img);
    if (!t) return null;
    var fit = getComputedStyle(img).objectFit;
    var bx = r.left, by = r.top, bw = r.width, bh = r.height;
    if (fit === 'contain' || fit === 'cover') {
      var s = (fit === 'contain' ? Math.min : Math.max)(r.width / t.w, r.height / t.h);
      bw = t.w * s; bh = t.h * s;
      bx = r.left + (r.width - bw) / 2;
      by = r.top + (r.height - bh) / 2;
    }
    var u = Math.floor((x - bx) / bw * t.w), v = Math.floor((y - by) / bh * t.h);
    if (u < 0 || v < 0 || u >= t.w || v >= t.h) return null;
    var i = (v * t.w + u) * 4, d = t.data;
    if (d[i + 3] < 128) return null;
    return 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  }

  function darkBehind(pill) {
    var p = pill.getBoundingClientRect();
    var under = [];
    var els = document.querySelectorAll('img, ' + PANELS);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (nav.contains(el)) continue;
      var r = el.getBoundingClientRect();
      if (r.right <= p.left || r.left >= p.right || r.bottom <= p.top || r.top >= p.bottom) continue;
      if (!shown(el)) continue;
      under.push({ el: el, r: r, img: el.tagName === 'IMG' });
    }
    if (!under.length) return false;
    // Pictures sit on top of panels, and a later picture on top of an earlier one.
    under.sort(function (a, b) { return (b.img - a.img) || (a.el.compareDocumentPosition(b.el) & 4 ? 1 : -1); });

    var dark = 0, total = 0;
    for (var gy = 0; gy < 3; gy++) {
      for (var gx = 0; gx < 6; gx++) {
        var x = p.left + p.width * (gx + 0.5) / 6, y = p.top + p.height * (gy + 0.5) / 3;
        var lum = 255;  // the page itself is white
        for (var k = 0; k < under.length; k++) {
          var u = under[k], r = u.r;
          if (x < r.left || x >= r.right || y < r.top || y >= r.bottom) continue;
          var l = u.img ? pixel(u.el, r, x, y) : 0;
          if (l !== null) { lum = l; break; }
        }
        total++;
        if (lum < 110) dark++;
      }
    }
    return dark / total > 0.5;
  }

  function tone() {
    for (var i = 0; i < pills.length; i++) {
      var d = darkBehind(pills[i]);
      if (pills[i].classList.contains('is-dark') !== d) pills[i].classList.toggle('is-dark', d);
    }
  }

  /* ---------- wiring ---------- */

  // Pictures that finish loading under the bar change what is behind it.
  [].forEach.call(document.images, function (img) {
    if (!img.complete) img.addEventListener('load', function () { check(); }, { once: true });
  });

  function onResize() {
    check();
    place(current, false);
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', onResize);

  // The Play page turns its artwork under a bar that never moves, so it is
  // checked on a timer, but only while the room is turning: for a second and
  // a half after each wheel, swipe or arrow key, which outlasts the room's
  // easing. Left running, the timer cost half a processor core doing nothing.
  if (room) {
    var pollUntil = 0, poll = null;
    var wake = function () {
      pollUntil = Date.now() + 1500;
      if (poll) return;
      poll = window.setInterval(function () {
        check();
        if (Date.now() > pollUntil) { window.clearInterval(poll); poll = null; }
      }, 100);
    };
    ['wheel', 'touchmove', 'keydown'].forEach(function (type) {
      window.addEventListener(type, wake, { passive: true });
    });
  }

  check();
})();
