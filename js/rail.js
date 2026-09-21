/* The section rail.

   A fixed list of the page's sections down the left margin, with the one you
   are currently reading marked by a pill. It builds itself from the jump links
   the page already carries under the title, so the two lists cannot drift
   apart and adding a section to a case study is enough to add it here.

   It also gets out of the way. The design kit section on the Gemini page runs
   wider than the text column, and rather than sit on top of it the rail fades
   out for as long as that section is passing. The check is geometric rather
   than a hard-coded breakpoint, so on a screen wide enough to hold both the
   rail simply stays. */
(function () {
  var toc = document.querySelector('.case-toc');
  if (!toc) return;

  var links = [].slice.call(toc.querySelectorAll('a[href^="#"]'));
  if (links.length < 2) return;

  var rail = document.createElement('nav');
  rail.className = 'case-rail';
  rail.setAttribute('aria-label', 'Sections');

  var items = [];
  links.forEach(function (link) {
    var id = link.getAttribute('href').slice(1);
    var target = document.getElementById(id);
    if (!target) return;
    var a = document.createElement('a');
    a.href = '#' + id;
    a.textContent = link.textContent.trim();
    rail.appendChild(a);
    items.push({ a: a, target: target });
  });

  if (items.length < 2) return;
  document.body.appendChild(rail);

  /* Anything still running wide enough to pass under the rail. The hero is not
     on this list: it is the first thing on the page, and hiding the rail there
     meant it was missing exactly where a reader arrives. It reads fine over the
     hero's pale ground. */
  var blockers = [].slice.call(
    document.querySelectorAll('.case-section.is-wide')
  );
  var here = null;

  function mark(item) {
    if (item === here) return;
    if (here) {
      here.a.classList.remove('is-here');
      here.a.removeAttribute('aria-current');
    }
    here = item;
    if (here) {
      here.a.classList.add('is-here');
      here.a.setAttribute('aria-current', 'true');
    }
  }

  /* Nine rectangles per scroll event is cheap enough to read straight off the
     layout rather than defer to an animation frame, and deferring turned out
     to drop updates. */
  function update() {
    /* The section being read is the last one whose top has crossed a line near
       the top of the window. Set lower down the window it reads ahead of you,
       handing over to the next section while you are still in the short one
       above it, which the Capsule-style sections are short enough to notice. */
    var line = window.scrollY + window.innerHeight * 0.2;
    var found = items[0];
    for (var i = 0; i < items.length; i++) {
      var top = items[i].target.getBoundingClientRect().top + window.scrollY;
      if (top <= line) found = items[i];
    }

    /* At the foot of the page nothing further can cross that line, so a short
       last section would never light up on its own. */
    var atEnd = window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - 2;
    if (atEnd) found = items[items.length - 1];

    mark(found);

    var r = rail.getBoundingClientRect();
    var blocked = false;
    for (var j = 0; j < blockers.length; j++) {
      var b = blockers[j].getBoundingClientRect();
      if (b.bottom > 0 && b.top < window.innerHeight && b.left < r.right + 16) {
        blocked = true;
        break;
      }
    }
    rail.classList.toggle('is-hidden', blocked);
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}());
