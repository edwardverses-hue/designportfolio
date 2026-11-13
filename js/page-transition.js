/* The project card on the home page becomes its case study's hero, and back.
   The names are on the elements and the motion is in style.css under VIEW
   TRANSITIONS.

   A named element is lifted out of the page onto its own layer, above the
   page and so above the header. So just before each transition, on both
   pages, only the one element that has a partner on the other side keeps
   its name: a card when going to (or coming from) its own case study, the
   hero when going to (or coming from) the home page. Every other card stays
   in the page, under the header, and fades with it.

   The partner also has to be on screen. The browser pairs the two wherever
   they are, so a hero scrolled far up the page, or a card below the fold,
   would streak across the screen to meet it.

   Names come back once the transition is over, ready for the next one.

   Loaded in the head without defer: pagereveal fires before deferred
   scripts run. */
(function () {
  // A page opened at an anchor (the Work link opens the home page at the
  // cards) opens there. The page scrolls smoothly, and left smooth the browser
  // would draw the top of the page first and then glide down, a second
  // movement after the transition. So the jump is instant while the page
  // loads, and smooth scrolling comes back once it has.
  if (location.hash) {
    var root = document.documentElement;
    root.style.scrollBehavior = 'auto';
    window.addEventListener('load', function () {
      window.setTimeout(function () { root.style.scrollBehavior = ''; }, 0);
    });
  }

  // window.pageArrived settles once the page has finished arriving: when the
  // transition into it has played, or at once if there is none. Heavy start-up
  // work waits for it, so it does not run during the transition and make it
  // stutter. A browser without page transitions settles it when the page has
  // been read.
  var arrived;
  window.pageArrived = new Promise(function (res) { arrived = res; });
  if (!('onpagereveal' in window)) document.addEventListener('DOMContentLoaded', function () { arrived(); });

  // Whatever carries a name: the card and hero boxes for the films, and the
  // phones picture itself for Sessions, whose card and hero differ in shape.
  var SEL = '[style*="view-transition-name"]';

  function each(fn) { [].forEach.call(document.querySelectorAll(SEL), fn); }

  // The page at a URL, without its hash, with /index.html and / the same.
  function page(url) {
    var u = new URL(url, location.href);
    return u.origin + u.pathname.replace(/index\.html$/, '');
  }

  // A card leads to its case study; the hero leads home.
  function partner(el) {
    var link = el.closest('a[href]') || document.querySelector('.nav-logo');
    return link ? page(link.href) : null;
  }

  function onScreen(el) {
    var r = el.getBoundingClientRect(), h = window.innerHeight;
    var shown = Math.min(r.bottom, h) - Math.max(r.top, 0);
    return shown >= Math.min(r.height, h) / 3;
  }

  // other: the page on the far side of this transition, if the browser says.
  function pair(other) {
    var there = other ? page(other) : null;
    each(function (el) {
      var keep = onScreen(el) && (!there || partner(el) === there);
      el.classList.toggle('vt-off', !keep);
    });
  }
  function nameAll() { each(function (el) { el.classList.remove('vt-off'); }); }

  // The ground under the moving picture: the card's grey on the home page,
  // the hero's own (none) on a case study. Only where the box itself is what
  // moves (the films' cards and heroes); Sessions moves its phones picture
  // alone, and its ground goes with the page as it always has.
  //
  // The picture moves in 640ms, but its two snapshots swap in a 160ms fade
  // (style.css, VIEW TRANSITIONS), so on its own the grey would blink out
  // (or in) partway through the move. So the page being left notes its
  // ground, the page arriving starts from it, and once the move has begun
  // the ground eases to its own over GROUND ms. The arriving box is drawn
  // live into the transition, so the ease shows as it moves.
  var GROUND = 800, KEY = 'vt-ground';
  function kept() {
    var el = null;
    each(function (n) { if (!el && !n.classList.contains('vt-off')) el = n; });
    return el;
  }
  function ground(el) { return el.matches('.project-card, .case-hero-image') ? el : null; }

  // The film inside the moving box. The card and the hero play the same film,
  // but each page starts its own copy, so the hero would open on its poster
  // and then start again from its first frame, a different picture from the
  // card's mid-move. So the page being left notes the frame on screen and its
  // time, and the page arriving shows that frame as its poster and carries on
  // from that time; a film that plays once and had finished (Gemini's) holds
  // its last frame instead of building again. js/hero-video.js reads
  // data-carried. FILM is the frame's width, enough for the 160ms it shows.
  var FILM = 640, FILM_KEY = 'vt-film';
  function film(el) { return el && (el.matches('video') ? el : el.querySelector('video[data-film]')); }
  function path(url) { try { return new URL(url, location.href).pathname; } catch (err) { return ''; } }
  function noteFilm(el) {
    var v = film(el);
    try {
      sessionStorage.removeItem(FILM_KEY);
      if (!v || v.readyState < 2 || !v.videoWidth) return;
      var w = Math.min(FILM, v.videoWidth), h = Math.round(w * v.videoHeight / v.videoWidth);
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(v, 0, 0, w, h);
      var done = !v.loop && (v.ended || v.currentTime >= v.duration - 0.05);
      sessionStorage.setItem(FILM_KEY, JSON.stringify({ src: path(v.currentSrc || v.src), t: v.currentTime, done: done, img: c.toDataURL('image/webp', 0.85) }));
    } catch (err) {}
  }
  function carryFilm(el) {
    var saved = null, v = film(el);
    try { saved = JSON.parse(sessionStorage.getItem(FILM_KEY)); sessionStorage.removeItem(FILM_KEY); } catch (err) {}
    if (!saved || !v || path(v.getAttribute('src')) !== saved.src) return;
    var poster = v.getAttribute('poster');
    v.setAttribute('poster', saved.img);
    v.dataset.carried = saved.done ? 'held' : 'play';
    var seek = function () {
      var d = v.duration || 0;
      try { v.currentTime = saved.done ? Math.max(0, d - 0.001) : Math.min(saved.t, d || saved.t); } catch (err) {}
    };
    if (v.readyState >= 1) seek(); else v.addEventListener('loadedmetadata', seek, { once: true });
    // its own poster back once the film is showing that frame itself
    v.addEventListener('seeked', function () { if (poster !== null) v.setAttribute('poster', poster); }, { once: true });
  }

  // Leaving: measured where the reader left the page.
  window.addEventListener('pageswap', function (e) {
    if (!e.viewTransition) return;
    var entry = e.activation && e.activation.entry;
    pair(entry && entry.url);
    var el = kept(), box = el && ground(el);
    try {
      if (box) sessionStorage.setItem(KEY, getComputedStyle(box).backgroundColor);
      else sessionStorage.removeItem(KEY);
    } catch (err) {}
    noteFilm(el);
  });

  // Arriving, or coming back from the back/forward cache with names a
  // previous swap took away.
  window.addEventListener('pagereveal', function (e) {
    var act = window.navigation && navigation.activation;
    // Opened at an anchor by a link: be there before the first frame, so the
    // transition lands on it and the card under it can take the hero's place.
    // The browser's own jump comes after the first frame. Back, forward and
    // reload keep the place the browser restores.
    if (location.hash && act && (act.navigationType === 'push' || act.navigationType === 'replace')) {
      var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) target.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
    nameAll();
    if (!e.viewTransition) { arrived(); return; }
    pair(act && act.from && act.from.url);
    var from = null;
    try { from = sessionStorage.getItem(KEY); sessionStorage.removeItem(KEY); } catch (err) {}
    var el = kept(), box = el && ground(el);
    carryFilm(el);
    if (from && box && getComputedStyle(box).backgroundColor !== from) {
      box.style.transition = 'none';
      box.style.backgroundColor = from;
      // The ease's own transition is taken off only once the ease has ended:
      // a card has its own (the lift on hover), and swapping back to it
      // mid-ease would cut the ease short.
      var done = function (ev) {
        if (ev && ev.propertyName !== 'background-color') return;
        box.removeEventListener('transitionend', done);
        box.removeEventListener('transitioncancel', done);
        box.style.transition = '';
      };
      var settle = function () {
        box.addEventListener('transitionend', done);
        box.addEventListener('transitioncancel', done);
        box.style.transition = 'background-color ' + GROUND + 'ms cubic-bezier(0.4, 0, 0.2, 1)';
        box.style.backgroundColor = '';
      };
      e.viewTransition.ready.then(settle, settle);
    }
    e.viewTransition.finished.then(nameAll, nameAll).then(arrived, arrived);
  });
})();
