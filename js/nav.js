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

  function check() {
    var height = nav.getBoundingClientRect().height;
    var next = window.scrollY > 4 || overlapsBar(height);
    if (next === lit) return;
    lit = next;
    nav.classList.toggle('nav-lit', next);
  }

  /* ---------- sliding thumb ---------- */

  var centre = nav.querySelector('.nav-center');
  var links  = centre ? centre.querySelectorAll('a') : [];
  var thumb  = null;
  var here   = null;

  function currentLink() {
    var path = location.pathname.replace(/\/+$/, '');
    var file = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href') || '';
      var leaf = href.split('#')[0].split('/').pop();
      if (file === 'play.html' && leaf === 'play.html') return links[i];
      // Anything under work/ is still the Work section of the site.
      if (file !== 'play.html' && file !== 'about.html' &&
          (leaf === 'index.html' || leaf === '')) return links[i];
    }
    return null;
  }

  function place(link, animate) {
    if (!thumb) return;
    if (!link) { thumb.classList.remove('is-set'); return; }
    var cs = getComputedStyle(centre);
    var c  = centre.getBoundingClientRect();
    var r  = link.getBoundingClientRect();
    var inset = parseFloat(cs.borderLeftWidth) || 0;
    if (!animate) thumb.classList.add('no-anim');
    thumb.style.width = r.width + 'px';
    thumb.style.transform = 'translateX(' + (r.left - c.left - inset) + 'px)';
    thumb.classList.add('is-set');
    if (!animate) {
      void thumb.offsetWidth;          // flush, so the next move does animate
      thumb.classList.remove('no-anim');
    }
  }

  if (centre && links.length) {
    thumb = document.createElement('span');
    thumb.className = 'nav-thumb';
    centre.insertBefore(thumb, centre.firstChild);

    here = currentLink();
    place(here, false);

    centre.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a') : null;
      if (!a || !centre.contains(a)) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      var href = a.getAttribute('href') || '';
      // A fragment scrolls this same page; leave it alone.
      if (href.charAt(0) === '#') return;
      if (a === here) return;

      e.preventDefault();
      place(a, true);
      if (still) { window.location.href = href; return; }
      window.setTimeout(function () { window.location.href = href; }, 300);
    });
  }

  /* ---------- wiring ---------- */

  function onResize() {
    check();
    place(here, false);
  }

  window.addEventListener('scroll', check, { passive: true });
  window.addEventListener('resize', onResize);

  // The Play page turns its artwork under a bar that never moves, so polling is
  // the only way to notice; every other page settles on scroll alone.
  if (document.querySelector('.gallery-ring')) {
    window.setInterval(check, 140);
  }

  check();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { place(here, false); });
  }
})();
