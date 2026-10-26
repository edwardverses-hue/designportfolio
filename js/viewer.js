/* A picture opened over the page, the way the Play page opens a piece: the
   ground frosts and fades in, the picture rises into place and is fitted to
   the window whatever its shape, and it sinks and fades on the way out. The
   overlay, its markup and its CSS are the Play page's own (.viewer in
   style.css); this is the same open and close for any other page.

   Any link with data-viewer opens its href here instead of leaving the page,
   with the link's image as the alt text and the figure's caption as the
   caption. Without the script the link still opens the picture. */
(function () {
  var viewer = document.getElementById('viewer');
  if (!viewer) return;
  var vImg = document.getElementById('viewer-img');
  var vCap = document.getElementById('viewer-cap');
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var open = false;
  var lastFocus = null;
  var closingIn = null;

  function openViewer(link) {
    var img = link.querySelector('img');
    var cap = link.closest('figure') && link.closest('figure').querySelector('figcaption');
    window.clearTimeout(closingIn);
    viewer.classList.remove('is-closing');
    vImg.setAttribute('src', link.getAttribute('href'));
    vImg.setAttribute('alt', img ? img.getAttribute('alt') || '' : '');
    vCap.textContent = cap ? cap.textContent.trim() : '';
    viewer.hidden = false;
    open = true;
    lastFocus = document.activeElement;
    viewer.focus();
  }

  // Held on screen for the length of its closing animation, then hidden, so
  // it fades out rather than blinking off.
  function closeViewer() {
    if (!open) return;
    open = false;
    if (still) { endClose(); return; }
    viewer.classList.add('is-closing');
    closingIn = window.setTimeout(endClose, 270);
  }

  function endClose() {
    window.clearTimeout(closingIn);
    viewer.classList.remove('is-closing');
    viewer.hidden = true;
    vImg.removeAttribute('src');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener('click', function (e) {
    var link = e.target && e.target.closest ? e.target.closest('a[data-viewer]') : null;
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    openViewer(link);
  });

  // Anywhere but the picture closes it, the close button included.
  viewer.addEventListener('click', function (e) {
    if (e.target !== vImg) closeViewer();
  });

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeViewer();
  });
})();
