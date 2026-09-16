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

  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- frosted pills ---------- */

  var ART = 'img, .project-card, .case-hero-image, .about-image, .panel';
  var lit = null;

  function overlapsBar(height) {
    var art = document.querySelectorAll(ART);
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
  function artBehindMarker() {
    if (!current) return false;
    var m = current.getBoundingClientRect();
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

  /* ---------- wiring ---------- */

  function onResize() {
    check();
    place(current, false);
  }

  window.addEventListener('scroll', check, { passive: true });
  window.addEventListener('resize', onResize);

  // The Play page turns its artwork under a bar that never moves, so polling is
  // the only way to notice; every other page settles on scroll alone.
  if (document.querySelector('.gallery-ring')) {
    window.setInterval(check, 140);
  }

  check();
})();
