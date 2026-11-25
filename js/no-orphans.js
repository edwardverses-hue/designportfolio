/* No orphans. In every paragraph of eight words or more, the last three
   words are joined with no-break spaces, so the last line never holds one
   or two words on their own. Runs once on load; text inside links and
   other inline elements is handled the same way. */
(function () {
  var MIN_WORDS = 8, KEEP = 3, NBSP = ' ';

  function textNodes(el) {
    var out = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = w.nextNode())) out.push(n);
    return out;
  }

  function fix(el) {
    if (el.textContent.trim().split(/\s+/).length < MIN_WORDS) return;
    var nodes = textNodes(el);
    var joins = KEEP - 1;
    // Walk backward from the end, turning the last few breaking spaces
    // into no-break spaces. Trailing whitespace is skipped.
    var seenWord = false;
    for (var i = nodes.length - 1; i >= 0 && joins > 0; i--) {
      var s = nodes[i].nodeValue, chars = s.split('');
      for (var j = chars.length - 1; j >= 0 && joins > 0; j--) {
        if (/\s/.test(chars[j]) && chars[j] !== NBSP) {
          if (seenWord) {
            // collapse a run of whitespace into one no-break space
            var k = j;
            while (k > 0 && /\s/.test(chars[k - 1]) && chars[k - 1] !== NBSP) k--;
            chars.splice(k, j - k + 1, NBSP);
            j = k;
            joins--;
            seenWord = false;
          }
        } else {
          seenWord = true;
        }
      }
      nodes[i].nodeValue = chars.join('');
    }
  }

  function run() {
    var els = document.querySelectorAll('p, li, figcaption');
    for (var i = 0; i < els.length; i++) fix(els[i]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
