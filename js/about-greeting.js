/* About: the page says hi. Arriving on About from another page of the site,
   the photo comes in, then "Hi, I’m Edward!" one word every 170ms, a pause,
   then the rest of the page fades in from top to bottom. Loaded in the head
   without defer, like page-transition.js, so pagereveal is caught before the
   first paint. Back/forward and reloads show the page as it is. Reduced
   motion skips it. */
(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)'; // the nav marker's curve
  var PHOTO = 60;                                 // the photo starts first: it sits above the text
  var START = 220, STEP = 170, WORD = 420;        // first word, then one every 170ms, each 420ms long
  var PAUSE = 350;                                // after the last word lands, before the rest

  function cameFromSite() {
    var act = window.navigation && navigation.activation;
    if (!act || !act.from) return false;
    if (act.navigationType === 'traverse' || act.navigationType === 'reload') return false;
    var from = new URL(act.from.url);
    return from.origin === location.origin && !/about\.html$/.test(from.pathname);
  }

  function fade(el, delay) {
    return el.animate([{ opacity: 0 }, { opacity: 1 }],
      { duration: 520, delay: delay, easing: 'linear', fill: 'both' });
  }

  window.addEventListener('pagereveal', function () {
    if (!cameFromSite()) return;
    var hl = document.querySelector('.about-text .hero-headline');
    if (!hl) return;
    var first = hl.firstChild, greeting = /Hi, I[’']m Edward!/;
    if (!first || first.nodeType !== 3 || !greeting.test(first.textContent)) return;
    var t0 = performance.now();

    // Split the greeting into words; the text itself stays exactly the same.
    var hello = first.textContent.match(greeting)[0];
    var restText = first.textContent.replace(hello, '');
    var frag = document.createDocumentFragment(), words = [];
    hello.split(' ').forEach(function (w, i) {
      if (i) frag.appendChild(document.createTextNode(' '));
      var s = document.createElement('span');
      s.textContent = w;
      s.style.display = 'inline-block';
      frag.appendChild(s);
      words.push(s);
    });
    var rest = document.createElement('span');
    rest.textContent = restText;
    frag.appendChild(rest);
    hl.replaceChild(frag, first);

    // The photo first. It is not used on any other page, so on a first visit
    // it may still be loading: it waits, hidden, rather than fading in as an
    // empty grey box, and gives up waiting after three seconds.
    var box = document.querySelector('.about-image');
    if (box) {
      var photo = fade(box, PHOTO), img = box.querySelector('img');
      if (img && !(img.complete && img.naturalWidth)) {
        photo.pause();
        var go = function () {
          if (photo.playState !== 'paused') return;
          photo.currentTime = Math.min(performance.now() - t0, PHOTO);
          photo.play();
        };
        img.addEventListener('load', go);
        img.addEventListener('error', go);
        window.setTimeout(go, 3000);
      }
    }

    // The hello, word by word.
    words.forEach(function (s, i) {
      s.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
        { duration: WORD, delay: START + i * STEP, easing: EASE, fill: 'both' });
    });

    // Then, after a pause, the rest, top to bottom.
    var after = START + (words.length - 1) * STEP + WORD + PAUSE;
    [rest].concat([].slice.call(document.querySelectorAll('.about-text .hero-sub, .about-buttons .pill-button')))
      .forEach(function (el, i) { fade(el, after + i * 60); });
  });
})();
