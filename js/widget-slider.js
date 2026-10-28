/* The two suggestion stacks on the Gemini page, sliding between their cards.

   Each stack is a row of cards; the one showing sits in the middle and the
   others wait a full card width to either side, beyond a soft mask, so a card
   thins out as it leaves rather than being cut. The stacks take turns, in the
   order the paragraph under the panel gives: the evening stack moves, then the
   work stack, then each slides back.

   It loops for as long as the panel is on screen and pauses while it is off
   it. Pressing a dot moves that stack and stops the automatic turns for good.
   With reduced motion asked for, nothing moves on its own.

   Each real stack holds four cards and two are shown, so each stack draws
   four dots: the two shown cards light the first two, and the other two stand
   for cards that are not on the page and cannot be pressed. */
(function () {
  var panel = document.querySelector('[data-slider]');
  if (!panel) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var STEP_MS = 2000;   // time between one stack moving and the other. Each card
                        // then rests about 3.5s, enough to read its 13 words
  var GAP = 1.12;       // a waiting card sits this many card widths away
  var DOTS = 4;         // cards in each real stack

  var stacks = [].slice.call(panel.querySelectorAll('.widget-col')).map(function (col) {
    var cards = [].slice.call(col.querySelectorAll('.widget-track img'));
    var dots = col.querySelector('.widget-dots');
    var stack = { cards: cards, index: 0, dots: [] };
    var total = Math.max(DOTS, cards.length);
    for (var i = 0; i < total; i++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'widget-dot';
      b.setAttribute('aria-label', 'Card ' + (i + 1) + ' of ' + total);
      if (i < cards.length) {
        b.addEventListener('click', (function (n) {
          return function () { manual = true; go(stack, n); };
        })(i));
      } else {
        b.setAttribute('aria-disabled', 'true');
        b.tabIndex = -1;
      }
      dots.appendChild(b);
      stack.dots.push(b);
    }
    return stack;
  });

  function go(stack, i) {
    stack.index = i;
    stack.cards.forEach(function (card, j) {
      var d = j - i;
      card.style.transform = 'translateX(' + (d * GAP * 100) + '%)';
      card.setAttribute('aria-hidden', d === 0 ? 'false' : 'true');
    });
    stack.dots.forEach(function (b, j) {
      b.classList.toggle('is-on', j === i);
      b.setAttribute('aria-current', j === i ? 'true' : 'false');
    });
  }

  stacks.forEach(function (s) { go(s, 0); });
  panel.classList.add('is-sliding');
  if (reduce) return;

  var manual = false, visible = false, turn = 0, timer = null;

  function tick() {
    timer = null;
    if (manual) return;
    // The page's Pause motion control holds the stacks where they are.
    if (visible && !document.body.classList.contains('motion-paused')) {
      // Turns run left, right, left, right: each stack moves every other step.
      var s = stacks[turn % stacks.length];
      go(s, (s.index + 1) % s.cards.length);
      turn++;
    }
    timer = setTimeout(tick, STEP_MS);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
    }, { threshold: 0.5 }).observe(panel);
  } else {
    visible = true;
  }

  timer = setTimeout(tick, STEP_MS);
})();

/* The single phone further down: the same two stacks inside the real screen.
   Each window holds a stack's two cards side by side and slides one card
   width to change; the dots under it cross-fade to match. The stacks take
   turns at the same pace as the panel above, loop while on screen, and stay
   still when reduced motion is asked for. */
(function () {
  var phone = document.querySelector('[data-stack-phone]');
  if (!phone) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var STEP_MS = 2000;
  var wins = [].slice.call(phone.querySelectorAll('.stack-win'));
  var dots = [].slice.call(phone.querySelectorAll('.stack-dots'));
  var state = wins.map(function () { return 0; });
  var turn = 0, visible = false;

  function show(k) {
    var i = state[k];
    [].slice.call(wins[k].children).forEach(function (layer, j) {
      layer.style.transform = 'translateX(' + ((j - i) * 100) + '%)';
    });
    if (dots[k]) {
      [].slice.call(dots[k].children).forEach(function (layer, j) {
        layer.style.opacity = j === i ? '1' : '0';
      });
    }
  }

  function tick() {
    if (visible && !document.body.classList.contains('motion-paused')) {
      var k = turn % wins.length;
      state[k] = (state[k] + 1) % wins[k].children.length;
      show(k);
      turn++;
    }
    setTimeout(tick, STEP_MS);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
    }, { threshold: 0.4 }).observe(phone);
  } else {
    visible = true;
  }

  setTimeout(tick, STEP_MS);
})();
