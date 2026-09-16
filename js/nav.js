/* Header pills.

   The bar itself is transparent. Each link is a pill that stays invisible
   until there is something behind it to frost, at which point it fades in as
   glass. "Something behind it" means either the page has been scrolled at all,
   which puts body copy under the bar, or a picture actually overlaps the bar,
   which is how the Play page behaves since that page never scrolls and instead
   turns artwork through the top of the frame. */
(function () {
  var nav = document.querySelector('.nav');
  if (!nav) return;

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

  window.addEventListener('scroll', check, { passive: true });
  window.addEventListener('resize', check);

  // The Play page turns its artwork under a bar that never moves, so polling is
  // the only way to notice; every other page settles on scroll alone.
  if (document.querySelector('.gallery-ring')) {
    window.setInterval(check, 140);
  }

  check();
})();
