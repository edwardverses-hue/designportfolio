/* The CVS case study's moving figures.

   Phones. Each .proto-demo holds the prototype in an iframe running one scene
   (the scenes are at the end of work/cvs-prototype.html). A scene loops the
   way the Capsule case study's videos do: it plays while it is on screen,
   holds while it is off, and starts over from its first frame each time it
   comes back, so a reader arriving at it always sees the step from the start.

   The handoff. The phone in .handoff tells the page when the register should
   move, and the register panel beside it follows, so the two keep one clock.

   The register. .pos-demo fades through the customer-screen stills, one path
   after another, and any path or step can be picked to jump to it.

   Everything stops for the one Pause motion control, which is what WCAG 2.2.2
   asks of motion that starts by itself and runs past five seconds, and nothing
   moves at all for a reader whose system asks for reduced motion. */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;
  var paused = false;
  var onPause = [];

  var toggle = document.querySelector('.motion-toggle');
  if (toggle) {
    if (reduce) toggle.hidden = true;
    toggle.addEventListener('click', function () {
      paused = !paused;
      toggle.textContent = paused ? 'Play motion' : 'Pause motion';
      toggle.setAttribute('aria-pressed', paused ? 'true' : 'false');
      document.body.classList.toggle('motion-paused', paused);
      onPause.forEach(function (f) { f(); });
    });
  }

  function find(list, el) {
    for (var i = 0; i < list.length; i++) if (list[i].fig === el) return list[i];
    return null;
  }

  function showStep(imgs, key) {
    Object.keys(imgs).forEach(function (k) {
      var on = k === key;
      imgs[k].classList.toggle('is-on', on);
      imgs[k].setAttribute('aria-hidden', on ? 'false' : 'true');
    });
  }

  /* ---------- the handoff ---------- */
  function handoff(fig) {
    var imgs = {};
    [].slice.call(fig.querySelectorAll('.handoff__pos img')).forEach(function (img) {
      imgs[img.getAttribute('data-step')] = img;
    });
    var link = fig.querySelector('.handoff__link');
    return function (name) {
      if (name === 'loop') showStep(imgs, '1');
      else if (name === 'pos:scan') {
        link.classList.remove('is-sending');
        void link.offsetWidth;
        link.classList.add('is-sending');
      } else if (name.indexOf('pos:') === 0) showStep(imgs, name.slice(4));
    };
  }

  /* ---------- phones ---------- */
  var demos = [].slice.call(document.querySelectorAll('.proto-demo')).map(function (fig) {
    var frame = fig.querySelector('iframe');
    var box = fig.closest('.handoff');
    return {
      fig: fig,
      frame: frame,
      screen: fig.querySelector('.proto-screen'),
      base: frame.getAttribute('data-src'),
      onEvent: box ? handoff(box) : null,
      ready: false,
      inView: false,
      played: false,
      away: false
    };
  });

  function send(d, msg) {
    if (d.frame.contentWindow) d.frame.contentWindow.postMessage({ cvs: msg }, '*');
  }

  function sync(d) {
    if (!d.ready || reduce) return;
    if (d.inView && !paused) {
      send(d, d.away ? 'restart' : 'play');
      d.away = false;
      d.played = true;
    } else {
      send(d, 'pause');
    }
  }

  onPause.push(function () { demos.forEach(sync); });

  window.addEventListener('message', function (e) {
    var m = e.data;
    if (!m || (m.cvs !== 'state' && m.cvs !== 'event')) return;
    for (var i = 0; i < demos.length; i++) {
      var d = demos[i];
      if (d.frame.contentWindow !== e.source) continue;
      if (m.cvs === 'event') { if (d.onEvent) d.onEvent(m.name); return; }
      d.ready = true;
      d.screen.classList.add('is-ready');
      if (m.state === 'ready') sync(d);
      return;
    }
  });

  if (hasIO) {
    /* Load a little before the phone arrives, so the still never has to wait
       on the network once the reader is looking at it. */
    var near = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var d = find(demos, en.target);
        if (d && !d.frame.getAttribute('src')) d.frame.src = d.base;
        near.unobserve(en.target);
      });
    }, { rootMargin: '700px 0px' });

    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var d = find(demos, en.target);
        if (!d) return;
        d.inView = en.isIntersecting;
        if (!d.inView && d.played) d.away = true;
        sync(d);
      });
    }, { threshold: 0.5 });

    demos.forEach(function (d) { near.observe(d.fig); seen.observe(d.fig); });
  } else {
    demos.forEach(function (d) { d.inView = true; d.frame.src = d.base; });
  }

  /* ---------- the register ---------- */
  var STEP_MS = 2600, PATH_END_MS = 1400;
  [].slice.call(document.querySelectorAll('.pos-demo')).forEach(function (fig) {
    var paths = [].slice.call(fig.querySelectorAll('.pos-path'));
    var imgs = {};
    [].slice.call(fig.querySelectorAll('.pos-stage img')).forEach(function (img) {
      imgs[img.getAttribute('data-step')] = img;
    });
    var list = fig.querySelector('.pos-steps');
    var note = fig.querySelector('.pos-note');
    var pi = 0, steps = [], at = 0, clock = 0, inView = false, last = null;

    function show(i) {
      at = i;
      clock = 0;
      showStep(imgs, steps[i]);
      [].slice.call(list.querySelectorAll('button')).forEach(function (b, j) {
        if (j === i) b.setAttribute('aria-current', 'step');
        else b.removeAttribute('aria-current');
      });
    }

    function choose(i) {
      pi = i;
      var p = paths[i];
      paths.forEach(function (x) { x.setAttribute('aria-pressed', x === p ? 'true' : 'false'); });
      steps = p.getAttribute('data-steps').split(' ');
      note.textContent = p.getAttribute('data-note');
      list.innerHTML = '';
      steps.forEach(function (key, j) {
        var li = document.createElement('li');
        var b = document.createElement('button');
        b.type = 'button';
        b.innerHTML = '<span class="pos-num">' + (j + 1) + '</span>' + imgs[key].getAttribute('data-label');
        b.addEventListener('click', function () { show(j); });
        li.appendChild(b);
        list.appendChild(li);
      });
      show(0);
    }

    paths.forEach(function (p, i) {
      p.addEventListener('click', function () { choose(i); });
    });
    choose(0);

    if (reduce) return;

    function tick(now) {
      if (last === null) last = now;
      var dt = Math.min(now - last, 100);
      last = now;
      if (inView && !paused) {
        clock += dt;
        var isLast = at === steps.length - 1;
        if (clock >= STEP_MS + (isLast ? PATH_END_MS : 0)) {
          if (isLast) choose((pi + 1) % paths.length);
          else show(at + 1);
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    if (hasIO) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { inView = en.isIntersecting; });
      }, { threshold: 0.4 }).observe(fig);
    } else {
      inView = true;
    }
  });
})();
