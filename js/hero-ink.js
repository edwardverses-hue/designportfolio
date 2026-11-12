/* Ink, round 2: after nikkantypo's 漏洩 (2026.11.7).
   The reference is a real fluid: dye shaped like type, carried by a slow
   current that curls into smoke at the ends of strokes, the colour running
   from a violet-ultramarine core through azure to a pale sky edge.
   So this is a real fluid simulation (stable fluids: advection, vorticity,
   pressure projection). The dye starts as 陈家志 and is pulled back toward
   the letters all the time, so the current smears the name into tendrils but
   never washes it away. The cursor pushes the water. The whole thing is laid
   under the hero copy as a low-opacity wash, so the copy stays readable.

   Each section.ink-hero is one take, configured with data attributes:
     data-layout   row | column | bleed   how the name is set
     data-opacity  0..1                   how strong the ink is at rest (1: the reference's)
     data-reveal   0..1                   extra strength where the water moves
   WebGL2 with float render targets. Without it the section shows nothing
   extra and the copy stands alone, which is the page as it is today. */
(function () {
  var NAME = ['陈', '家', '志'];   // 陈 家 志
  // The name the ink is drawn toward, set in a Song (Ming) face, as SimSun
  // is. SimSun itself is Microsoft's, installed on Windows only and not to be
  // served from a site, so it would be a different name on a Mac or a phone.
  // Noto Serif SC is a Song face that can be, with SimSun's proportions. Its
  // letters match SimSun's most closely at 400 to 500, but strokes that thin
  // carry little ink and the hero went pale; at 900 the ink is as strong as it
  // was in the sans the hero began with (Edward chose 900). Loaded in
  // index.html for these three characters only; the rest of the list stands
  // in if it can't be.
  var FONT = '"Noto Serif SC", "Songti SC", "STSong", "SimSun", serif';
  var WEIGHT = '900 ';
  // how much wider than the font each character is outlined (a share of the
  // size); none, as the font is used as it is
  var THICK = 0;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // The water holds still for a reader whose system asks for reduced motion,
  // and while the page's Pause motion control is on (it sets this class).
  function still() { return reduce || document.body.classList.contains('motion-paused'); }

  var root = document.documentElement;
  // the thread's helpers: a CSS cubic-bezier (EASE) at x, an ease from 0 to 1
  // held at either end, and the hero copy let back in (css/hero-ink.css)
  function curve(a, b, s) { return 3 * a * (1 - s) * (1 - s) * s + 3 * b * (1 - s) * s * s + s * s * s; }
  function bez(P, x) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    var lo = 0, hi = 1;
    for (var i = 0; i < 30; i++) { var s = (lo + hi) / 2; if (curve(P[0], P[2], s) < x) lo = s; else hi = s; }
    return curve(P[1], P[3], (lo + hi) / 2);
  }
  function ease(x) { return bez(EASE, x); }
  function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  function showCopy() { root.classList.remove('thread', 'thread-copy', 'inkintro'); }

  // Colour, measured off the reference: its inked pixels sorted into twelve
  // steps from paper to core, and the mean colour of each step, palest first.
  // The reference's paper is #D9DBE5, the site's is white, so each colour is
  // divided by that paper (ink on paper multiplies), which keeps every step
  // exactly as much darker than the paper as it is in the reference.
  var PAPER = [0xD9, 0xDB, 0xE5];
  var STEPS = ['C8D4E6', 'B4CDEA', '95C2F4', '7CB8F7', '63ADF7', '4CA3F7',
               '3698F8', '228CF7', '1B7CF7', '2568F8', '3552F7', '4638EF'];

  // The water and the ink, set by measuring renders against the reference at
  // 6, 9, 15 and 30 seconds: the share of its inked area that is pale film,
  // azure edge and violet core (37 / 28 / 34%), and how far the strokes break
  // into separate pools (13 pieces of core) with wavering outlines.
  var CURL = 15;                // curls: rolls at the ends of strokes
  var DISS = 0.6, VISC = 0.35;  // the water slows, and moves in smooth sheets
  var SCALE = 1.3, DRIFT = 0.3; // size of the current's eddies; its sideways stream
  var FADE = 0.4;               // ink thinned by the water fades, leaving clean paper between pools
  var INK = [0.1, 0.35];        // ink density from paper to core
  var FILMT = [0.03, 0.4, 0.17]; // film density range, and how far up the colours it reaches
  var SHED = 2, DECAY = 0.15, SPREAD = 0.22; // the film: taken up from the ink, fading, spreading
  var ALL = 1e6;                // uGrow for the whole name: far past every point of it

  // The thread: the home page reached by the logo on another page (js/nav.js
  // notes where it was clicked, js/intro.js decides it plays). The ink starts
  // empty; a line of it runs from the click to the middle of the page in
  // FLIGHT seconds, along a curve through BEND, and where it lands the name
  // spreads out through the water. Positions are shares of the window.
  var FLIGHT = 0.6;
  var BEND = [0.21, 0.71], LAND = [0.5, 0.52];
  var EASE = [0.45, 0, 0.2, 1];          // the line's pace, a CSS cubic-bezier
  // the line: ink per unit of length (in hero heights), splat size, the most
  // space between splats (heights) and the most splats in a frame
  var LINE = { ink: 38, r: 0.00008, gap: 0.004, most: 24 };
  var WAKE = { k: 480, r: 0.0014 };      // how the line pushes the water: the cursor's own (move())
  var DROP = { k: 0.02, v: 260, r: 0.0016, amt: 0, ar: 0.0008 };   // the landing: a stir (and a drop of ink, none)
  // The writing: on arriving at the site (js/intro.js decides), the name is
  // written into the empty water stroke by stroke, in its stroke order, by a
  // brush that presses at the start of each stroke and lifts at the end;
  // then it gives way to the ink of an ordinary visit as the strand does.
  // The strokes are the centre lines of 陈家志 from Make Me a Hanzi
  // (github.com/skishore/makemeahanzi, via hanzi-writer-data 2.0.1), under the
  // Arphic Public License: per character, the box of its outlines and the
  // strokes in order, in a 1024 square with y running up.
  var HANZI = [[[137,-30,926,815],[[[213,692],[223,684],[242,683],[328,718],[347,720],[358,720],[373,707],[366,679],[326,605],[317,577],[326,547],[365,483],[372,455],[368,426],[365,421],[343,420],[264,439]],[[204,673],[234,624],[242,578],[244,370],[238,155],[230,-6]],[[440,698],[512,701],[730,738],[796,739],[800,733]],[[575,824],[569,798],[548,738],[511,624],[481,556],[452,520],[431,500]],[[477,526],[514,537],[540,542],[797,568],[836,573],[856,571]],[[641,543],[657,500],[660,467],[653,170],[641,151],[603,117],[598,117]],[[518,405],[504,333],[463,256],[439,231]],[[773,425],[811,394],[856,348],[904,316]]]],[[140,-70,989,871],[[[451,856],[534,814],[563,785]],[[217,684],[207,655],[187,622],[159,598]],[[226,666],[278,682],[425,697],[769,729],[800,726],[839,710]],[[792,707],[750,617],[726,612]],[[340,604],[370,585],[504,566],[645,557],[685,575]],[[532,545],[524,512],[460,453],[391,404],[319,368],[284,354]],[[498,480],[536,450],[545,443],[564,417],[582,363],[584,322],[574,293],[561,277],[526,262],[504,244],[466,227],[434,215]],[[579,419],[477,333],[417,285],[351,246],[246,207]],[[553,381],[529,311],[484,253],[380,169],[293,123],[173,73]],[[596,344],[625,273],[648,234],[675,191],[719,140],[777,111],[946,48]],[[773,451],[731,421],[678,368],[607,326]]]],[[133,-21,935,834],[[[251,594],[311,584],[362,587],[503,608],[708,652],[777,653]],[[462,825],[493,792],[497,768],[495,466]],[[343,472],[400,468],[575,486],[640,491],[663,484]],[[442,384],[490,358],[501,342],[513,319]],[[397,256],[389,166],[392,125],[399,98],[416,73],[441,57],[477,48],[592,43],[699,52],[743,71],[764,99],[768,112],[767,147],[766,152]],[[160,195],[150,167],[155,110]],[[597,237],[640,213],[670,203],[715,167],[839,150]]]]];
  // how it is written: seconds of writing in all; within that, the share a
  // stroke takes beyond its length, the lift between strokes and the pause
  // between characters (all in the units of the strokes' lengths, scaled to
  // fit); the brush's pace along each stroke (a CSS cubic-bezier); its half
  // width as a share of a character's height; the ink across a stroke at its
  // densest; how much it moves the water (a share of the cursor's push);
  // the wet edge it leaves: film (the hero's pale wash) this many times
  // the stroke's width, at this much across; the lift's extra time per height
  // the brush travels between strokes (none: measured, it made the writing
  // less even); and the points to each span of a stroke's smoothed centre line
  var WRITE = { time: 2.2, base: 0.06, lift: 0.04, gap: 0.14, pace: [0.3, 0, 0.25, 1], half: 0.07, ink: 0.65, wake: 0, bleed: 3, wash: 0.3, air: 0, curve: 6 };
  // The writing uncovers the hero's own ink, already running underneath, so
  // what is written is the hero itself and nothing changes shape after: the
  // brush paints a mask the ink shows through, its half width a share of a
  // character's height and REVEAL.amt across (the mask is full at 1); once
  // written, the rest of the ink fades in over REVEAL.fill seconds.
  // Each character's own remaining ink fills in around it once it is written,
  // over REVEAL.local seconds, out to REVEAL.reach of its box's half size
  // (localAmt across at its middle), so the last fade is only the wash far
  // from the letters.
  // What the brush uncovers soaks in over REVEAL.soak seconds (a time
  // constant) rather than all at once. Measured frame by frame (60 fps) over
  // the writing, against no soak, the wider brush (0.24) and straight
  // strokes: the ink arriving each frame varied 0.81 times its mean, from
  // 2.28; the change from one frame to the next fell from 0.94 to 0.21 of
  // its mean; and the narrower brush shows only what has been written, where
  // the wider one uncovered strokes before the brush reached them. The name
  // reads the same once written (0.71, 0.70 at 4.2 and 8 seconds).
  var REVEAL = { half: 0.18, amt: 2.5, fill: 2.0, lead: 0, film: 10, local: 1.6, localAmt: 3, reach: 0.9, soak: 0.1 };
  // During the writing the ink is pulled to the name harder than the hero's
  // usual pull, so the name it uncovers reads more clearly: READ.pull, the
  // point where readability stopped gaining (measured 0.25 to 2: 0.49, 0.63,
  // 0.72 up to 0.5, then 0.75, 0.77, 0.78 as the letters filled in solid).
  // Once the homepage is up the pull eases back to the hero's own over
  // READ.over seconds. The pull is a rate, so changing it never moves the
  // picture; the name loosens through the water as it always does.
  var READ = { pull: 0.5, over: 12 };
  var TWIN = 2;                        // the twin's pace (step())
  var WARM = 2;                          // steps of the water's first run per frame, built off screen (warm())
  var PULL = 2.6, SETTLE = [2.2, 1.0];   // the pull to the ink once landed; when it eases off, over how long
  var COPY = 0.9, DONE = 2.4;            // when the copy fades up; when the whole name is let in
  // the same, from the moment the drawing ends (the strand landing, or the
  // writing finished), so the writing's hand-over is timed as the strand's
  var AFTER = { copy: COPY - FLIGHT, done: DONE - FLIGHT, settle: SETTLE[0] - FLIGHT, off: SETTLE[1] };

  var VS = '#version 300 es\nprecision highp float;\nin vec2 p; out vec2 vUv; out vec2 vL; out vec2 vR; out vec2 vT; out vec2 vB; uniform vec2 uTexel;\n' +
    'void main(){ vUv = p * 0.5 + 0.5; vL = vUv - vec2(uTexel.x, 0.); vR = vUv + vec2(uTexel.x, 0.); vT = vUv + vec2(0., uTexel.y); vB = vUv - vec2(0., uTexel.y); gl_Position = vec4(p, 0., 1.); }';
  var HEAD = '#version 300 es\nprecision highp float;\nprecision highp sampler2D;\nin vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB; out vec4 o;\n';
  var NOISE =
    'float hh(vec2 p){ p = fract(p * vec2(127.1, 311.7)); p += dot(p, p + 19.19); return fract(p.x * p.y); }\n' +
    'float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }\n' +
    'float fbm(vec2 p){ return 0.6 * vn(p) + 0.3 * vn(p * 2.1 + 7.3) + 0.1 * vn(p * 4.3 + 1.7); }\n';
  // A sharp (Catmull-Rom) sample, held within its four nearest values, so a
  // thin line carried by the water stays thin instead of blurring away.
  var CRF =
    'float cr(sampler2D s, vec2 uv){ vec2 sz = vec2(textureSize(s, 0)); vec2 p = uv * sz - 0.5; vec2 i = floor(p), f = p - i;\n' +
    '  vec2 w0 = f * (-0.5 + f * (1. - 0.5 * f)), w1 = 1. + f * f * (-2.5 + 1.5 * f), w2 = f * (0.5 + f * (2. - 1.5 * f)), w3 = f * f * (-0.5 + 0.5 * f);\n' +
    '  float r = 0., lo = 1e9, hi = -1e9; ivec2 m = ivec2(sz) - 1;\n' +
    '  for (int y = 0; y < 4; y++) { float wy = y == 0 ? w0.y : y == 1 ? w1.y : y == 2 ? w2.y : w3.y;\n' +
    '    for (int x = 0; x < 4; x++) { float wx = x == 0 ? w0.x : x == 1 ? w1.x : x == 2 ? w2.x : w3.x;\n' +
    '      float v = texelFetch(s, clamp(ivec2(i) + ivec2(x - 1, y - 1), ivec2(0), m), 0).r; r += wx * wy * v;\n' +
    '      if ((x == 1 || x == 2) && (y == 1 || y == 2)) { lo = min(lo, v); hi = max(hi, v); } } }\n' +
    '  return clamp(r, lo, hi); }\n';

  // The thread's front (below): how far the name has spread from where the
  // line landed, 0 to 1 at each point. uGrow is the seconds since it landed;
  // the edge wavers with a noise so it spreads like ink, not a ring. With
  // uGrow at ALL it is 1 everywhere, and the page is as it always is.
  var FRONT = NOISE + 'uniform float uGrow; uniform vec2 uLand; uniform float uAspect;\n' +
    'float front(){ if (uGrow > 1e5) return 1.; vec2 q = vec2(vUv.x - uLand.x, (vUv.y - uLand.y) / uAspect);\n' +
    '  float dist = length(q) * (0.7 + 0.6 * fbm(vec2(vUv.x * uAspect, vUv.y) * 3.5));\n' +
    '  return smoothstep(0., 0.25, uGrow - (0.02 + dist * 1.25)); }\n';

  var FS = {
    splat: HEAD + 'uniform sampler2D uT; uniform float uAspect; uniform vec3 uColor; uniform vec2 uPoint; uniform float uRadius;\n' +
      'void main(){ vec2 d = vUv - uPoint; d.x *= uAspect; vec3 s = exp(-dot(d, d) / uRadius) * uColor; o = vec4(texture(uT, vUv).xyz + s, 1.); }',
    // the water: carried by itself, with some viscosity so it moves in smooth
    // sheets and rolls rather than fine turbulence
    advect: HEAD + 'uniform sampler2D uVel; uniform sampler2D uSrc; uniform vec2 uVelTexel; uniform float uDt; uniform float uDiss; uniform float uVisc;\n' +
      'void main(){ vec2 c = vUv - uDt * texture(uVel, vUv).xy * uVelTexel; vec4 a = texture(uSrc, c);\n' +
      '  vec4 n = 0.25 * (texture(uSrc, c + vec2(uVelTexel.x, 0.)) + texture(uSrc, c - vec2(uVelTexel.x, 0.)) + texture(uSrc, c + vec2(0., uVelTexel.y)) + texture(uSrc, c - vec2(0., uVelTexel.y)));\n' +
      '  o = mix(a, n, uVisc) / (1. + uDiss * uDt); }',
    // the dye: carried by the water, and pulled back toward the name. It is
    // read with the sharp sample: a plain one blurs it a fraction of a pixel
    // every frame, which erased the thin lines the water folds into the edges.
    // Measured against the reference's fine lines, this was the difference.
    // In the thread (below) both pulls act only inside the front, and the dye
    // is also pulled (uPullT) toward uTarget, the ink as it would be on an
    // ordinary visit; outside the thread uPullT is 0 and the front is 1.
    dye: HEAD + CRF + FRONT + 'uniform sampler2D uVel; uniform sampler2D uSrc; uniform sampler2D uName; uniform sampler2D uTarget; uniform vec2 uVelTexel; uniform vec2 uTexel; uniform float uDt; uniform float uRelax; uniform float uSpread; uniform float uFade; uniform float uPullT;\n' +
      'void main(){ vec2 c = vUv - uDt * texture(uVel, vUv).xy * uVelTexel; float d = cr(uSrc, c); float n = texture(uName, vUv).r; float m = front();\n' +
      '  float nb = 0.25 * (texture(uSrc, c + vec2(uTexel.x, 0.)).r + texture(uSrc, c - vec2(uTexel.x, 0.)).r + texture(uSrc, c + vec2(0., uTexel.y)).r + texture(uSrc, c - vec2(0., uTexel.y)).r);\n' +
      '  d = mix(d, nb, uSpread);\n' +
      '  d = mix(d, n, (1. - exp(-uRelax * uDt)) * m);\n' +
      '  d = mix(d, texture(uTarget, vUv).r, (1. - exp(-uPullT * uDt)) * m) * exp(-uFade * uDt); o = vec4(d, 0., 0., 1.); }',
    // a slow current: the curl of a drifting noise, so it never piles up,
    // plus a light drift to one side, the way the reference streams right
    current: HEAD + NOISE + 'uniform sampler2D uVel; uniform float uT; uniform float uAspect; uniform float uStrength; uniform vec2 uDrift; uniform float uDt; uniform float uScale;\n' +
      'float psi(vec2 q){ return fbm(q * uScale + vec2(uT * 0.03, -uT * 0.02)); }\n' +
      'void main(){ vec2 q = vec2(vUv.x * uAspect, vUv.y); float e = 0.01;\n' +
      '  vec2 f = vec2(psi(q + vec2(0., e)) - psi(q - vec2(0., e)), -(psi(q + vec2(e, 0.)) - psi(q - vec2(e, 0.)))) / (2. * e);\n' +
      '  vec2 v = texture(uVel, vUv).xy + (f * uStrength + uDrift) * uDt; o = vec4(v, 0., 1.); }',
    curl: HEAD + 'uniform sampler2D uVel;\nvoid main(){ float L = texture(uVel, vL).y, R = texture(uVel, vR).y, T = texture(uVel, vT).x, B = texture(uVel, vB).x; o = vec4(0.5 * (R - L - T + B), 0., 0., 1.); }',
    vort: HEAD + 'uniform sampler2D uVel; uniform sampler2D uCurl; uniform float uCurlK; uniform float uDt;\n' +
      'void main(){ float L = texture(uCurl, vL).x, R = texture(uCurl, vR).x, T = texture(uCurl, vT).x, B = texture(uCurl, vB).x, C = texture(uCurl, vUv).x;\n' +
      '  vec2 f = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L)); f /= length(f) + 1e-4; f *= uCurlK * C; f.y *= -1.;\n' +
      '  vec2 v = texture(uVel, vUv).xy + f * uDt; o = vec4(clamp(v, -1000., 1000.), 0., 1.); }',
    div: HEAD + 'uniform sampler2D uVel;\nvoid main(){ float L = texture(uVel, vL).x, R = texture(uVel, vR).x, T = texture(uVel, vT).y, B = texture(uVel, vB).y; vec2 C = texture(uVel, vUv).xy;\n' +
      '  if (vL.x < 0.) L = -C.x; if (vR.x > 1.) R = -C.x; if (vT.y > 1.) T = -C.y; if (vB.y < 0.) B = -C.y; o = vec4(0.5 * (R - L + T - B), 0., 0., 1.); }',
    clear: HEAD + 'uniform sampler2D uT; uniform float uV;\nvoid main(){ o = uV * texture(uT, vUv); }',
    pressure: HEAD + 'uniform sampler2D uP; uniform sampler2D uDiv;\nvoid main(){ float L = texture(uP, vL).x, R = texture(uP, vR).x, T = texture(uP, vT).x, B = texture(uP, vB).x, D = texture(uDiv, vUv).x; o = vec4((L + R + B + T - D) * 0.25, 0., 0., 1.); }',
    grad: HEAD + 'uniform sampler2D uP; uniform sampler2D uVel;\nvoid main(){ float L = texture(uP, vL).x, R = texture(uP, vR).x, T = texture(uP, vT).x, B = texture(uP, vB).x; vec2 v = texture(uVel, vUv).xy - vec2(R - L, T - B); o = vec4(v, 0., 1.); }',
    // the picture: dye density through the reference's ramp, laid over
    // white at the take's opacity, stronger where the water moves
    // the film: a stain the ink leaves in the water. Wherever the ink is, the
    // film takes it up; then it is carried and spreads with nothing pulling
    // it back, fading slowly, so it trails behind the ink and bridges strokes
    // (uTarget, uPullT and the front: as in the dye, for the thread)
    film: HEAD + FRONT + 'uniform sampler2D uVel; uniform sampler2D uSrc; uniform sampler2D uInk; uniform sampler2D uTarget; uniform vec2 uVelTexel; uniform vec2 uTexel; uniform float uDt; uniform float uShed; uniform float uDecay; uniform float uSpread; uniform float uPullT;\n' +
      'void main(){ vec2 c = vUv - uDt * texture(uVel, vUv).xy * uVelTexel; float f = texture(uSrc, c).r;\n' +
      '  float nb = 0.25 * (texture(uSrc, c + vec2(uTexel.x, 0.)).r + texture(uSrc, c - vec2(uTexel.x, 0.)).r + texture(uSrc, c + vec2(0., uTexel.y)).r + texture(uSrc, c - vec2(0., uTexel.y)).r);\n' +
      '  f = mix(f, nb, uSpread);\n' +
      '  f = mix(f, max(f, texture(uInk, vUv).r), 1. - exp(-uShed * uDt));\n' +
      '  f = mix(f, texture(uTarget, vUv).r, (1. - exp(-uPullT * uDt)) * front());\n' +
      '  o = vec4(f * exp(-uDecay * uDt), 0., 0., 1.); }',
    // the writing's mask as seen: carried by the water as the painted one is,
    // and soaking up to it (uK this frame), as ink takes a moment to sink in
    soak: HEAD + 'uniform sampler2D uVel; uniform sampler2D uSrc; uniform sampler2D uTo; uniform vec2 uVelTexel; uniform float uDt; uniform float uK;\n' +
      'void main(){ vec2 c = vUv - uDt * texture(uVel, vUv).xy * uVelTexel; o = vec4(mix(texture(uSrc, c).r, texture(uTo, vUv).r, uK), 0., 0., 1.); }',
    // the picture: how dark each point is, from paper (0) to core (1), read
    // through the reference's measured colours. The ink sets it; where there
    // is only film, it stays in the reference's palest steps.
    show: HEAD + 'uniform sampler2D uDye; uniform sampler2D uFilm; uniform sampler2D uRamp; uniform sampler2D uVel; uniform vec2 uInk; uniform vec3 uFilmT; uniform float uOpacity; uniform float uReveal; uniform vec4 uCopy; uniform float uAspect; uniform float uClear; uniform sampler2D uMask; uniform float uMaskOn; uniform float uMaskAll; uniform float uMaskFilm;\n' +
      'void main(){ float d = texture(uDye, vUv).r, fm = texture(uFilm, vUv).r;\n' +
      // while the name is being written, the ink shows only where the brush
      // has been (uMask), the pale film out to its fainter edge (uMaskFilm
      // times as far up), as a wet brush bleeds; all of it as uMaskAll rises
      '  float mv = max(texture(uMask, vUv).r, uMaskAll), mi = mix(1., min(mv, 1.), uMaskOn), mf = mix(1., min(max(mv * uMaskFilm, uMaskAll), 1.), uMaskOn);\n' +
      '  float t = max(smoothstep(uInk.x, uInk.y, d) * mi, uFilmT.z * smoothstep(uFilmT.x, uFilmT.y, fm) * mf);\n' +
      '  float sp = length(texture(uVel, vUv).xy);\n' +
      '  float op = clamp(uOpacity + uReveal * smoothstep(4., 45., sp), 0., 1.);\n' +
      // the ink thins behind the copy: a soft rounded box around it
      '  vec2 cc = (uCopy.xy + uCopy.zw) * 0.5, hb = (uCopy.zw - uCopy.xy) * 0.5; vec2 q = abs(vUv - cc) - hb; q.x *= uAspect;\n' +
      '  float sd = length(max(q, 0.)) + min(max(q.x, q.y), 0.);\n' +
      '  op *= mix(uClear, 1., smoothstep(-0.02, 0.07, sd));\n' +
      '  o = vec4(texture(uRamp, vec2((t * op * 255. + 0.5) / 256., 0.5)).rgb, 1.); }'
  };

  function Ink(section) {
    this.s = section;
    this.layout = section.getAttribute('data-layout') || 'row';
    this.opacity = parseFloat(section.getAttribute('data-opacity') || '1');
    this.reveal = parseFloat(section.getAttribute('data-reveal') || '0');
    this.clear = parseFloat(section.getAttribute('data-clear') || '0.3');
    // how hard the water pulls the ink back to the name, and how strong the current is
    this.relax = parseFloat(section.getAttribute('data-relax') || '0.25');
    this.current = parseFloat(section.getAttribute('data-current') || '5');
    this.copyBox = [0.5, 0.5, 0.5, 0.5];
    this.copy = section.querySelector('.hero-copy');
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'ink-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    section.insertBefore(this.canvas, section.firstChild);
    this.ok = this.init();
    var cv = this.canvas;
    // if the graphics context is lost, step aside: the page is just the copy on white
    cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); cv.style.display = 'none'; });
    this.raf = null; this.visible = true; this.last = 0; this.t0 = performance.now();
    this.pointer = null; this.prevP = null; this.lastMove = -1e9;
    this.queue = []; this.drops = []; this.wash = []; this.marks = [];
    // the thread's state (below): the pull to the twin's ink, how far the
    // front has spread and from where, and the twin while it runs (tw keeps
    // its fields for a replay)
    this.pullT = 0; this.grow = ALL; this.land = [0.5, 0.5];
    this.th = null; this.twin = this.tw = null;
    if (!this.ok) { section.classList.add('is-fallback'); return; }
    var self = this;
    window.addEventListener('pointermove', function (e) { self.move(e); }, { passive: true });
    section.addEventListener('pointerleave', function () { self.pointer = self.prevP = null; });
    section.addEventListener('pointerdown', function (e) { if (!e.target.closest('a, button')) self.press(e); });
    new IntersectionObserver(function (es) { self.visible = es[0].isIntersecting; if (self.visible) self.kick(); }).observe(section);
  }

  Ink.prototype.init = function () {
    var gl = this.gl = this.canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: false });
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) return false;
    gl.getExtension('OES_texture_float_linear');
    var self = this;
    // The programs are compiled here and checked once they are done (built,
    // below). Asking whether one has compiled makes the page wait until it
    // has, the larger part of a second for all of them, so where the browser
    // can say when they are done without waiting (KHR_parallel_shader_compile)
    // it is asked every few milliseconds instead, and the page goes on.
    var par = gl.getExtension('KHR_parallel_shader_compile');
    function sh(t, src) { var s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    var vs = sh(gl.VERTEX_SHADER, VS), made = [];
    Object.keys(FS).forEach(function (k) {
      var p = gl.createProgram(), fs = sh(gl.FRAGMENT_SHADER, FS[k]);
      gl.attachShader(p, vs); gl.attachShader(p, fs);
      gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
      made.push({ k: k, p: p, fs: fs });
    });
    this.P = null;
    function finish() {
      var P = {};
      made.forEach(function (m) {
        var p = m.p;
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(m.k + ': ' + (gl.getShaderInfoLog(m.fs) || gl.getShaderInfoLog(vs) || gl.getProgramInfoLog(p)));
        var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
        for (var i = 0; i < n; i++) { var nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
        P[m.k] = { p: p, u: u };
      });
      self.P = P;
    }
    this.built = new Promise(function (res) {
      function fail(e) { self.ok = false; self.s.classList.add('is-fallback'); self.canvas.style.display = 'none'; if (window.console) console.error(e); res(false); }
      if (!par) { try { finish(); res(true); } catch (e) { fail(e); } return; }
      (function poll() {
        for (var i = 0; i < made.length; i++) if (!gl.getProgramParameter(made[i].p, par.COMPLETION_STATUS_KHR)) { window.setTimeout(poll, 8); return; }
        try { finish(); res(true); } catch (e) { fail(e); }
      })();
    });
    this.parallel = !!par;
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    // the colours as a strip: white at 0, then each measured step at the
    // middle of its range, blended in between
    var stops = [[0, [255, 255, 255]]].concat(STEPS.map(function (h, j) {
      var c = [0, 2, 4].map(function (o, i) { return Math.min(255, parseInt(h.substr(o, 2), 16) / PAPER[i] * 255); });
      return [(j + 0.5) / STEPS.length, c];
    }));
    var px = new Uint8Array(256 * 4);
    for (var x = 0; x < 256; x++) {
      var tt = x / 255, k = 1;
      while (k < stops.length - 1 && stops[k][0] < tt) k++;
      var a = stops[k - 1], b2 = stops[k], f = Math.max(0, Math.min(1, (tt - a[0]) / (b2[0] - a[0])));
      for (var i = 0; i < 3; i++) px[x * 4 + i] = Math.round(a[1][i] + (b2[1][i] - a[1][i]) * f);
      px[x * 4 + 3] = 255;
    }
    this.rampTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.rampTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return true;
  };

  Ink.prototype.fbo = function (w, h, internal, format) {
    var gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, gl.HALF_FLOAT, null);
    var f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    return { t: t, f: f, w: w, h: h };
  };
  Ink.prototype.double = function (w, h, internal, format) {
    var a = this.fbo(w, h, internal, format), b = this.fbo(w, h, internal, format);
    return { r: a, w: b, swap: function () { var t = this.r; this.r = this.w; this.w = t; } };
  };

  // The name, set as a soft white-on-black map the dye is pulled toward.
  Ink.prototype.nameMap = function () {
    var gl = this.gl, W = this.W, H = this.H, cw = this.dyeW, ch = this.dyeH, s = cw / W;
    var c = document.createElement('canvas'); c.width = cw; c.height = ch;
    var g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, cw, ch);
    g.fillStyle = g.strokeStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
    var fs, m, asc;
    // each character filled, then outlined THICK of the size wider, which
    // gives the brush font the stroke weight of the reference Edward chose
    function put(t, x, y) { g.fillText(t, x, y); if (THICK) { g.lineWidth = fs * THICK; g.strokeText(t, x, y); } }
    // where each character is drawn, in the water's terms (0 to 1, y up),
    // for the writing (write()): x is the middle of the character's advance
    var boxes = this.glyphs = [];
    function box(t, cx, y) {
      var mm = g.measureText(t), grow = THICK ? fs * THICK / 2 : 0;
      var x0 = cx - mm.actualBoundingBoxLeft - grow, x1 = cx + mm.actualBoundingBoxRight + grow;
      var y0 = y - mm.actualBoundingBoxAscent - grow, y1 = y + mm.actualBoundingBoxDescent + grow;
      boxes.push([x0 / cw, 1 - y1 / ch, x1 / cw, 1 - y0 / ch]);
    }
    if (this.layout === 'column') {
      // stacked like the reference, the column running the hero's height
      var avail = H - 120 - 40, step = avail / 3;
      fs = step * 0.92 * s;
      g.font = WEIGHT + fs + 'px ' + FONT;
      for (var i = 0; i < 3; i++) {
        m = g.measureText(NAME[i]); asc = m.actualBoundingBoxAscent;
        var hgt = asc + m.actualBoundingBoxDescent;
        g.filter = 'blur(' + (fs * 0.022) + 'px)';
        put(NAME[i], cw / 2, (120 + step * i) * s + (step * s - hgt) / 2 + asc);
        box(NAME[i], cw / 2, (120 + step * i) * s + (step * s - hgt) / 2 + asc);
      }
    } else {
      // row: across the hero; bleed: bigger, running off both edges
      var k = this.layout === 'bleed' ? 1.16 : 0.84;
      fs = (W * k / 3.04) * s;
      g.font = WEIGHT + fs + 'px ' + FONT;
      m = g.measureText(NAME.join('')); asc = m.actualBoundingBoxAscent;
      var h2 = asc + m.actualBoundingBoxDescent;
      g.filter = 'blur(' + (fs * 0.022) + 'px)';
      var base = ch / 2 - h2 / 2 + asc + (this.layout === 'bleed' ? 0 : ch * 0.02);
      put(NAME.join(''), cw / 2, base);
      var whole = m.width, before = 0;
      for (var j = 0; j < 3; j++) {
        var adv = g.measureText(NAME[j]).width;
        box(NAME[j], cw / 2 - whole / 2 + before + adv / 2, base);
        before = g.measureText(NAME.slice(0, j + 1).join('')).width;
      }
    }
    g.filter = 'none';
    var soft = document.createElement('canvas'); soft.width = cw; soft.height = ch;
    var sg = soft.getContext('2d'); sg.fillStyle = '#000'; sg.fillRect(0, 0, cw, ch);
    sg.filter = 'blur(' + Math.round(cw * 0.012) + 'px)'; sg.drawImage(c, 0, 0); sg.filter = 'none';
    this.filmTex = this.upload(soft, this.filmTex);
    var t = this.nameTex || gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.nameTex = t;
  };

  Ink.prototype.upload = function (cv, t) {
    var gl = this.gl; t = t || gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };

  // later: leave the water's first run to warm() rather than doing it here
  Ink.prototype.size = function (later) {
    var r = this.s.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return false;
    var gl = this.gl;
    this.W = r.width; this.H = r.height;
    var dpr = Math.min(1.5, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(r.width * dpr); this.canvas.height = Math.round(r.height * dpr);
    this.canvas.style.width = r.width + 'px'; this.canvas.style.height = r.height + 'px';
    this.aspect = r.width / r.height;
    var simW = 112, simH = Math.round(simW / this.aspect);
    this.dyeW = Math.min(1280, Math.round(r.width * dpr * 0.66)); this.dyeH = Math.round(this.dyeW / this.aspect);
    this.vel = this.double(simW, simH, gl.RG16F, gl.RG);
    this.prs = this.double(simW, simH, gl.R16F, gl.RED);
    this.divF = this.fbo(simW, simH, gl.R16F, gl.RED);
    this.curlF = this.fbo(simW, simH, gl.R16F, gl.RED);
    this.dye = this.double(this.dyeW, this.dyeH, gl.R16F, gl.RED);
    this.film = this.double(this.dyeW, this.dyeH, gl.R16F, gl.RED);
    this.simW = simW; this.simH = simH;
    this.nameMap();
    var cr = this.copy.getBoundingClientRect();
    this.copyBox = [(cr.left - r.left) / r.width, 1 - (cr.bottom - r.top) / r.height, (cr.right - r.left) / r.width, 1 - (cr.top - r.top) / r.height];
    // start with the dye already in the shape of the name
    var dz = { uVelTexel: [1 / simW, 1 / simH], uDt: 0, uRelax: 1e6, uSpread: 0, uPullT: 0, uGrow: ALL };
    this.run('dye', this.dye.w, { uVel: this.vel.r.t, uSrc: this.dye.r.t, uName: this.nameTex, uTarget: this.nameTex }, dz, [this.dyeW, this.dyeH]);
    this.dye.swap();
    this.run('dye', this.film.w, { uVel: this.vel.r.t, uSrc: this.film.r.t, uName: this.filmTex, uTarget: this.filmTex }, dz, [this.dyeW, this.dyeH]);
    this.film.swap();
    // let the current run for a moment before anyone sees it; for a strand
    // about to begin, only the water, as its ink starts empty (begin()); the
    // writing shows the hero's own ink, so that runs in full
    this.pullNow = this.wait && this.wait.write ? READ.pull : null; this.pullBack = null;
    if (!later) for (var i = 0; i < 240; i++) this.step(1 / 60, i / 60, !!this.wait && !this.wait.write);
    return true;
  };
  // The water's first run a little at a time, for a hero built while it is
  // off screen (the page opened at the work): WARM steps, then wait for the
  // GPU to finish them (a fence) and a frame to pass, and so on, so the GPU
  // is never handed more than a sliver of a frame's work and the page being
  // read stays smooth. All at once it was most of a second of GPU work, and
  // the frames drawn behind it stalled.
  Ink.prototype.warm = function (done) {
    var self = this, gl = this.gl, at = 0;
    (function chunk() {
      if (!self.warming) return;   // a new size started over
      for (var n = 0; n < WARM && at < 240; n++, at++) self.step(1 / 60, at / 60);
      var f = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush();
      (function wait() {
        if (gl.getSyncParameter(f, gl.SYNC_STATUS) !== gl.SIGNALED) { window.setTimeout(wait, 4); return; }
        gl.deleteSync(f);
        if (at < 240) requestAnimationFrame(chunk); else done();
      })();
    })();
  };
  // one field into another of the same size (the clear program at 1)
  Ink.prototype.copyTo = function (from, to) { this.run('clear', to.w, { uT: from.r.t }, { uV: 1 }, [to.w.w, to.w.h]); to.swap(); };
  // no ink and no film; the water keeps moving
  Ink.prototype.zero = function () {
    var D = [this.dyeW, this.dyeH], self = this;
    [this.dye, this.film].forEach(function (b) { self.run('clear', b.w, { uT: b.r.t }, { uV: 0 }, D); b.swap(); });
  };

  Ink.prototype.run = function (name, target, tex, uni, texel) {
    var gl = this.gl, P = this.P[name], unit = 0;
    gl.useProgram(P.p);
    gl.uniform2f(P.u.uTexel, 1 / texel[0], 1 / texel[1]);
    for (var k in tex) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex[k]); gl.uniform1i(P.u[k], unit); unit++; }
    for (var u in uni) {
      if (!P.u[u]) continue;
      var v = uni[u];
      if (typeof v === 'number') gl.uniform1f(P.u[u], v);
      else if (v.length === 2) gl.uniform2f(P.u[u], v[0], v[1]);
      else if (v.length === 4) gl.uniform4f(P.u[u], v[0], v[1], v[2], v[3]);
      else gl.uniform3f(P.u[u], v[0], v[1], v[2]);
    }
    if (target) { gl.bindFramebuffer(gl.FRAMEBUFFER, target.f); gl.viewport(0, 0, target.w, target.h); }
    else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.canvas.width, this.canvas.height); }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  // water: move the water only, not the ink (a thread's start-up)
  Ink.prototype.step = function (dt, t, water) {
    var S = [this.simW, this.simH], vt = [1 / this.simW, 1 / this.simH];
    // the current
    this.run('current', this.vel.w, { uVel: this.vel.r.t }, { uT: t, uAspect: this.aspect, uStrength: this.current, uDrift: [this.current * DRIFT, 0], uDt: dt, uScale: SCALE }, S); this.vel.swap();
    // what people wrote into it
    for (var i = 0; i < this.queue.length; i++) {
      var q = this.queue[i];
      this.run('splat', this.vel.w, { uT: this.vel.r.t }, { uAspect: this.aspect, uPoint: q.p, uColor: [q.v[0], q.v[1], 0], uRadius: q.r }, S); this.vel.swap();
    }
    this.queue.length = 0;
    // ink put straight into the water (the thread's line)
    for (var d = 0; d < this.drops.length; d++) {
      var q2 = this.drops[d];
      this.run('splat', this.dye.w, { uT: this.dye.r.t }, { uAspect: this.aspect, uPoint: q2.p, uColor: [q2.a, 0, 0], uRadius: q2.r }, [this.dyeW, this.dyeH]); this.dye.swap();
    }
    this.drops.length = 0;
    // and the pale stain a wet brush leaves around its stroke (the writing)
    for (var e = 0; e < this.wash.length; e++) {
      var q3 = this.wash[e];
      this.run('splat', this.film.w, { uT: this.film.r.t }, { uAspect: this.aspect, uPoint: q3.p, uColor: [q3.a, 0, 0], uRadius: q3.r }, [this.dyeW, this.dyeH]); this.film.swap();
    }
    this.wash.length = 0;
    // curls, then keep the water from compressing
    this.run('curl', this.curlF, { uVel: this.vel.r.t }, {}, S);
    this.run('vort', this.vel.w, { uVel: this.vel.r.t, uCurl: this.curlF.t }, { uCurlK: CURL, uDt: dt }, S); this.vel.swap();
    this.run('div', this.divF, { uVel: this.vel.r.t }, {}, S);
    this.run('clear', this.prs.w, { uT: this.prs.r.t }, { uV: 0.8 }, S); this.prs.swap();
    for (var j = 0; j < 20; j++) { this.run('pressure', this.prs.w, { uP: this.prs.r.t, uDiv: this.divF.t }, {}, S); this.prs.swap(); }
    this.run('grad', this.vel.w, { uP: this.prs.r.t, uVel: this.vel.r.t }, {}, S); this.vel.swap();
    // carry the water and the dye
    this.run('advect', this.vel.w, { uVel: this.vel.r.t, uSrc: this.vel.r.t }, { uVelTexel: vt, uDt: dt, uDiss: DISS, uVisc: VISC }, S); this.vel.swap();
    if (water) return;
    // In the thread, the ink and film of an ordinary visit go on underneath,
    // unseen (the twin), as the target the seen ink is pulled toward. It
    // runs at TWIN times the pace, so it has built up as far as an ordinary
    // visit's by the time the front reaches it, without the start-up running
    // it first.
    var D = [this.dyeW, this.dyeH], tw = this.twin;
    if (tw) for (var k = 0; k < TWIN; k++) {
      this.run('dye', tw.dye.w, { uVel: this.vel.r.t, uSrc: tw.dye.r.t, uName: this.nameTex, uTarget: this.nameTex }, { uVelTexel: vt, uDt: dt, uRelax: this.relax, uSpread: 0, uFade: FADE, uPullT: 0, uGrow: ALL }, D); tw.dye.swap();
      this.run('film', tw.film.w, { uVel: this.vel.r.t, uSrc: tw.film.r.t, uInk: tw.dye.r.t, uTarget: this.filmTex }, { uVelTexel: vt, uDt: dt, uShed: SHED, uDecay: DECAY, uSpread: SPREAD, uPullT: 0, uGrow: ALL }, D); tw.film.swap();
    }
    var front = { uPullT: this.pullT, uGrow: this.grow, uLand: this.land, uAspect: this.aspect };
    this.run('dye', this.dye.w, { uVel: this.vel.r.t, uSrc: this.dye.r.t, uName: this.nameTex, uTarget: tw ? tw.dye.r.t : this.nameTex }, Object.assign({ uVelTexel: vt, uDt: dt, uRelax: this.pullNow == null ? this.relax : this.pullNow, uSpread: 0, uFade: FADE }, front), D); this.dye.swap();
    // the film: taken up from the ink, then left to drift and spread
    this.run('film', this.film.w, { uVel: this.vel.r.t, uSrc: this.film.r.t, uInk: this.dye.r.t, uTarget: tw ? tw.film.r.t : this.filmTex }, Object.assign({ uVelTexel: vt, uDt: dt, uShed: SHED, uDecay: DECAY, uSpread: SPREAD }, front), D); this.film.swap();
    // the writing's mask: painted where the brush has been, and carried by
    // the water as the ink is, so ink once shown stays shown as it drifts
    if (this.th && this.th.reveal) {
      for (var mk = 0; mk < this.marks.length; mk++) {
        var q4 = this.marks[mk];
        this.run('splat', this.mask.w, { uT: this.mask.r.t }, { uAspect: this.aspect, uPoint: q4.p, uColor: [q4.a, 0, 0], uRadius: q4.r }, D); this.mask.swap();
      }
      this.run('advect', this.mask.w, { uVel: this.vel.r.t, uSrc: this.mask.r.t }, { uVelTexel: vt, uDt: dt, uDiss: 0, uVisc: 0 }, D); this.mask.swap();
      if (REVEAL.soak) { this.run('soak', this.seen.w, { uVel: this.vel.r.t, uSrc: this.seen.r.t, uTo: this.mask.r.t }, { uVelTexel: vt, uDt: dt, uK: 1 - Math.exp(-dt / REVEAL.soak) }, D); this.seen.swap(); }
    }
    this.marks.length = 0;
  };

  Ink.prototype.frame = function (now) {
    this.raf = null;
    if (!this.visible || this.s.hidden || !this.vel || this.warming) return;
    var dt = Math.min(1 / 30, (now - (this.last || now)) / 1000) || 1 / 60; this.last = now;
    if (this.th && this.th.slow) dt /= 3;
    // the writing's pull easing back to the hero's own (READ)
    if (this.pullBack && !still()) {
      var pk = smooth((this.pullBack.t += dt) / READ.over);
      this.pullNow = READ.pull + (this.relax - READ.pull) * pk;
      if (pk >= 1) { this.pullNow = null; this.pullBack = null; }
    }
    var t = (now - this.t0) / 1000;
    // with no one there, a slow hand passes through every so often
    if (!reduce && now - this.lastMove > 3500) {
      var gx = 0.5 + 0.42 * Math.sin(t * 0.17), gy = 0.5 + 0.22 * Math.sin(t * 0.29 + 1.0);
      var vx = 0.42 * 0.17 * Math.cos(t * 0.17), vy = 0.22 * 0.29 * Math.cos(t * 0.29 + 1.0);
      if (false) this.queue.push({ p: [gx, gy], v: [vx * 420 * this.aspect, vy * 420], r: 0.004 });
    }
    var hold = still();
    // A thread waits, its canvas still hidden, until the GPU has finished the
    // start-up (the water's first run, sent all at once): the first frame to
    // show it would otherwise wait for all of it and stop the line in mid-air.
    // The fence put in after it (begin()) says when; the frames do not, as a
    // hidden canvas is not drawn and they come quickly regardless. Two
    // seconds at most, whatever happens.
    if (this.th && this.th.prime !== false && !hold) {
      var gl = this.gl, f = this.th.fence;
      var done = !f || gl.getSyncParameter(f, gl.SYNC_STATUS) === gl.SIGNALED;
      if (!done && this.th.prime < 120) { this.th.prime++; this.kick(); return; }
      if (f) gl.deleteSync(f);
      this.th.fence = null; this.th.prime = false; dt = this.th.slow ? 1 / 180 : 1 / 60;
    }
    if (!hold && this.th) this.thread(dt);
    if (!hold) this.step(dt, t);
    var rv = this.th && this.th.reveal ? this.th : null;
    this.run('show', null, { uDye: this.dye.r.t, uFilm: this.film.r.t, uVel: this.vel.r.t, uRamp: this.rampTex, uMask: rv ? (REVEAL.soak ? this.seen : this.mask).r.t : this.dye.r.t }, { uInk: INK, uFilmT: FILMT, uOpacity: this.opacity, uReveal: this.reveal, uCopy: this.copyBox, uAspect: this.aspect, uClear: this.clearNow == null ? this.clear : this.clearNow, uMaskOn: rv ? 1 : 0, uMaskAll: rv ? rv.all : 1, uMaskFilm: REVEAL.film }, [this.canvas.width, this.canvas.height]);
    // in the thread the canvas shows at once, from its first, empty frame
    if (this.th && this.canvas.style.opacity === '0') { this.canvas.style.transition = 'none'; this.canvas.style.opacity = '1'; }
    if (!hold) this.kick();
  };

  // The thread, one frame of it: dt seconds on from th.t.
  Ink.prototype.thread = function (dt) {
    var th = this.th, t0 = th.t, t1 = th.t = t0 + dt, end = th.until;
    // The writing, uncovering the hero's ink: the brush until it is written,
    // then the rest of the ink fading in, and the copy and header coming up
    // as they do after the strand. The ink itself is never touched.
    if (th.reveal) {
      if (t0 < end) this.write(t0, t1);
      // a written character's own ink, filling in around it over REVEAL.local
      // seconds: a wide soft splat of the mask, a little each frame
      for (var c = 0; c < th.chars.length; c++) {
        var ch = th.chars[c], a0 = Math.max(t0, ch.end), a1 = Math.min(t1, ch.end + REVEAL.local);
        if (a1 > a0) this.marks.push({ p: ch.p, a: REVEAL.localAmt * (smooth((a1 - ch.end) / REVEAL.local) - smooth((a0 - ch.end) / REVEAL.local)), r: ch.r });
      }
      th.all = smooth((t1 - end + REVEAL.lead) / REVEAL.fill);
      this.clearNow = 1 + (this.clear - 1) * smooth((t1 - end - AFTER.copy) / 0.5);
      if (t1 >= end + AFTER.copy && !th.copy) { th.copy = true; root.classList.add('thread-copy'); }
      if (t1 >= end + Math.max(REVEAL.fill - REVEAL.lead, AFTER.copy + 0.5)) { this.th = null; this.clearNow = null; this.pullBack = { t: 0 }; showCopy(); }
      return;
    }
    // the writing, for a thread that writes the name rather than flying a line
    if (th.plan && t0 < end) this.write(t0, t1);
    // the line, laid evenly along the stretch of curve covered this frame,
    // its ink in proportion to the frame's length, so it is the same at any
    // frame rate
    if (!th.plan && t0 < FLIGHT) {
      var k0 = ease(t0 / FLIGHT), k1 = ease(Math.min(1, t1 / FLIGHT));
      var a = this.path(k0), b = this.path(k1);
      // the stretch covered this frame, in the splat's units (heights), and
      // as many splats as keep them closer than LINE.gap apart
      var len = Math.hypot((b[0] - a[0]) * this.aspect, b[1] - a[1]);
      var n = Math.max(1, Math.min(LINE.most, Math.ceil(len / LINE.gap)));
      var prev = a;
      for (var i = 1; i <= n; i++) {
        var p = this.path(k0 + (k1 - k0) * i / n);
        // the same ink for every length of line, whatever its pace
        this.drops.push({ p: p, a: LINE.ink * len / n, r: LINE.r });
        // and it moves the water as it goes, as the cursor does (move())
        this.queue.push({ p: p, v: [(p[0] - prev[0]) * WAKE.k * this.aspect, (p[1] - prev[1]) * WAKE.k], r: WAKE.r });
        prev = p;
      }
    }
    // the landing, once (the line's; the writing just ends)
    if (!th.landed && t1 >= end) {
      th.landed = true;
      if (!th.plan) { this.stir(th.p2, DROP.k, DROP.v, DROP.r); if (DROP.amt) this.splatDye(th.p2, DROP.amt, DROP.ar); }
    }
    // the pull to the ink of an ordinary visit: none while the line is in the
    // air (or the name is being written), then inside the front as it
    // spreads, easing off once it is over the whole hero, when the two are
    // the same
    this.pullT = t1 < end ? 0 : PULL * (1 - smooth((t1 - end - AFTER.settle) / AFTER.off));
    this.grow = t1 < end ? -1 : t1 - end;
    // the classes change once each (a change to them restyles the page)
    if (t1 >= end + AFTER.copy && !th.copy) { th.copy = true; root.classList.add('thread-copy'); }
    if (t1 >= end + AFTER.done) { this.grow = ALL; if (!th.done) { th.done = true; showCopy(); } }
    // the ink thins behind the copy only once there is copy: while it is
    // hidden the ink is whole there, and it thins as the copy fades up
    this.clearNow = 1 + (this.clear - 1) * smooth((t1 - end - AFTER.copy) / 0.5);
    if (t1 >= end + AFTER.settle + AFTER.off) { this.pullT = 0; this.twin = null; this.th = null; this.clearNow = null; }
  };
  // The writing's plan: every stroke as points in the water, in order, with
  // its length (in heights, the splats' units) and when it starts and ends.
  Ink.prototype.plan = function () {
    var self = this, A = this.aspect, raw = [], t = 0, last = null;
    HANZI.forEach(function (hz, k) {
      var ob = hz[0], gb = self.glyphs[k];
      if (k) t += WRITE.gap;
      hz[1].forEach(function (med, j) {
        // the character's outline box onto the box the font draws it in
        var pts = curve(med.map(function (q) { return [gb[0] + (q[0] - ob[0]) / (ob[2] - ob[0]) * (gb[2] - gb[0]), gb[1] + (q[1] - ob[1]) / (ob[3] - ob[1]) * (gb[3] - gb[1])]; }), A);
        // the lift: a moment, and longer the further the brush has to travel
        if (j) t += WRITE.lift + WRITE.air * Math.hypot((pts[0][0] - last[0]) * A, pts[0][1] - last[1]);
        last = pts[pts.length - 1];
        var cum = [0];
        for (var i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot((pts[i][0] - pts[i - 1][0]) * A, pts[i][1] - pts[i - 1][1]));
        var len = cum[cum.length - 1], dur = WRITE.base + len;
        raw.push({ pts: pts, cum: cum, len: len, start: t, dur: dur, h: gb[3] - gb[1], k: k });
        t += dur;
      });
    });
    var k = WRITE.time / t;   // fitted to the writing's time
    raw.forEach(function (s) { s.start *= k; s.dur *= k; });
    return raw;
  };
  // A stroke's centre line through its points as a smooth curve (centripetal
  // Catmull-Rom, WRITE.curve points to each span), so the brush turns its
  // corners rather than snapping from one straight piece to the next.
  function curve(P, A) {
    var n = WRITE.curve; if (!n || P.length < 3) return P;
    var out = [P[0]];
    function d(a, b) { return Math.pow(Math.hypot((b[0] - a[0]) * A, b[1] - a[1]), 0.5) || 1e-6; }
    for (var i = 0; i < P.length - 1; i++) {
      var p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      if (i === 0) p0 = [2 * p1[0] - p2[0], 2 * p1[1] - p2[1]];
      if (i === P.length - 2) p3 = [2 * p2[0] - p1[0], 2 * p2[1] - p1[1]];
      var t1 = d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
      for (var s = 1; s <= n; s++) {
        var u = t1 + (t2 - t1) * s / n, q = [0, 0];
        for (var c = 0; c < 2; c++) {
          var a1 = ((t1 - u) * p0[c] + u * p1[c]) / t1, a2 = ((t2 - u) * p1[c] + (u - t1) * p2[c]) / (t2 - t1), a3 = ((t3 - u) * p2[c] + (u - t2) * p3[c]) / (t3 - t2);
          var b1 = ((t2 - u) * a1 + u * a2) / t2, b2 = ((t3 - u) * a2 + (u - t1) * a3) / (t3 - t1);
          q[c] = ((t2 - u) * b1 + (u - t1) * b2) / (t2 - t1);
        }
        out.push(q);
      }
    }
    return out;
  }
  // the point at length d along a stroke
  function along(s, d) {
    var c = s.cum, i = 1;
    while (i < c.length - 1 && c[i] < d) i++;
    var f = c[i] > c[i - 1] ? Math.max(0, Math.min(1, (d - c[i - 1]) / (c[i] - c[i - 1]))) : 0;
    return [s.pts[i - 1][0] + (s.pts[i][0] - s.pts[i - 1][0]) * f, s.pts[i - 1][1] + (s.pts[i][1] - s.pts[i - 1][1]) * f];
  }
  // the brush's width along a stroke (u, 0 to 1), as a share of WRITE.half:
  // pressed down at the start, lifting off over the last quarter; it only
  // ever narrows as the stroke goes on
  function press(u) { return (0.8 + 0.45 * Math.exp(-u * 10)) * (1 - 0.6 * smooth((u - 0.72) / 0.28)); }
  // The brush between t0 and t1: along each stroke under way, splats as wide
  // as the brush is there.
  Ink.prototype.write = function (t0, t1) {
    var A = this.aspect, plan = this.th.plan;
    for (var j = 0; j < plan.length; j++) {
      var s = plan[j], a = Math.max(t0, s.start), b = Math.min(t1, s.start + s.dur);
      if (b <= a) continue;
      var d0 = s.len * bez(WRITE.pace, (a - s.start) / s.dur), d1 = s.len * bez(WRITE.pace, (b - s.start) / s.dur);
      // Splats no further apart than a third of the brush's half width where
      // it is narrowest this frame (its end, as it only narrows): about three
      // quarters of a splat's own spread, so the stroke is smooth with no
      // beads. Each splat is a pass over the whole ink, so no closer either.
      var narrow = (this.th.reveal ? REVEAL.half : WRITE.half) * s.h * press(s.len ? d1 / s.len : 1);
      var n = Math.max(1, Math.min(LINE.most, Math.ceil((d1 - d0) / (narrow / 3))));
      var prev = along(s, d0);
      for (var i = 1; i <= n; i++) {
        var d = d0 + (d1 - d0) * i / n, u = s.len ? d / s.len : 1, p = along(s, d);
        var w = press(u);
        // a gaussian splat whose ink reaches the paper (0.1) at w * half the
        // character's height out, at WRITE.ink across the stroke
        if (this.th.reveal) {
          // the brush uncovers the hero's own ink: the mask reaches 0.1 at w
          // * REVEAL.half of the character's height out, REVEAL.amt across
          var hm = REVEAL.half * s.h * w, rm = hm * hm / Math.log(REVEAL.amt / 0.1);
          this.marks.push({ p: p, a: REVEAL.amt / Math.sqrt(Math.PI * rm) * (d1 - d0) / n, r: rm });
        } else {
          var half = WRITE.half * s.h * w, r = half * half / Math.log(WRITE.ink / 0.1);
          this.drops.push({ p: p, a: WRITE.ink / Math.sqrt(Math.PI * r) * (d1 - d0) / n, r: r });
          // the wet edge: film WRITE.bleed times as wide, WRITE.wash across
          var rw = r * WRITE.bleed * WRITE.bleed;
          if (WRITE.wash) this.wash.push({ p: p, a: WRITE.wash / Math.sqrt(Math.PI * rw) * (d1 - d0) / n, r: rw });
        }
        this.queue.push({ p: p, v: [(p[0] - prev[0]) * WAKE.k * WRITE.wake * A, (p[1] - prev[1]) * WAKE.k * WRITE.wake], r: WAKE.r });
        prev = p;
      }
    }
  };
  // the point k (0 to 1) along the thread's curve
  Ink.prototype.path = function (k) {
    var th = this.th, a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, c = k * k;
    return [a * th.p0[0] + b * th.p1[0] + c * th.p2[0], a * th.p0[1] + b * th.p1[1] + c * th.p2[1]];
  };
  // Start the thread from a point given as shares of the window, or from the
  // middle of the logo.
  Ink.prototype.begin = function (from) {
    var W = innerWidth, H = innerHeight, r = this.s.getBoundingClientRect(), x = from.x, y = from.y;
    if (x == null) { var lr = document.querySelector('.nav-logo').getBoundingClientRect(); x = (lr.left + lr.width / 2) / W; y = (lr.top + lr.height / 2) / H; }
    // a point in the window to the same point in the water: y runs up
    function at(px, py) { return [(px * W - r.left) / r.width, 1 - (py * H - r.top) / r.height]; }
    this.th = { t: 0, landed: false, prime: 0, fence: null, slow: !!from.slow, until: FLIGHT, p0: at(x, y), p1: at(BEND[0], BEND[1]), p2: at(LAND[0], LAND[1]) };
    // writing the name instead: it ends when the writing does, and the ink
    // of an ordinary visit spreads in from the middle of the name
    if (from.write && this.glyphs && this.glyphs.length === 3) {
      var gs = this.glyphs;
      this.th.plan = this.plan(); this.th.until = WRITE.time;
      // each character's own ink fills in once it is written: when its last
      // stroke ends, around the middle of the box it is drawn in
      var A = this.aspect, chars = [0, 1, 2].map(function (k) { return { end: 0, box: gs[k] }; });
      this.th.plan.forEach(function (st) { chars[st.k].end = Math.max(chars[st.k].end, st.start + st.dur); });
      chars.forEach(function (c) { var b = c.box, R = REVEAL.reach * Math.max((b[2] - b[0]) / 2 * A, (b[3] - b[1]) / 2); c.p = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; c.r = R * R; });
      this.th.chars = chars;
      this.th.p2 = [(gs[0][0] + gs[2][2]) / 2, (Math.min(gs[0][1], gs[1][1], gs[2][1]) + Math.max(gs[0][3], gs[1][3], gs[2][3])) / 2];
      // the hero's ink stays as it is, and is shown only where the brush has
      // been: an empty mask, the size of the ink
      var gm = this.gl;
      if (!this.mask || this.mask.r.w !== this.dyeW || this.mask.r.h !== this.dyeH) this.mask = this.double(this.dyeW, this.dyeH, gm.R16F, gm.RED);
      this.run('clear', this.mask.w, { uT: this.mask.r.t }, { uV: 0 }, [this.dyeW, this.dyeH]); this.mask.swap();
      if (REVEAL.soak) {
        if (!this.seen || this.seen.r.w !== this.dyeW || this.seen.r.h !== this.dyeH) this.seen = this.double(this.dyeW, this.dyeH, gm.R16F, gm.RED);
        this.run('clear', this.seen.w, { uT: this.seen.r.t }, { uV: 0 }, [this.dyeW, this.dyeH]); this.seen.swap();
      }
      this.th.reveal = true; this.th.all = 0; this.pullNow = READ.pull; this.pullBack = null;
      this.queue.length = 0; this.drops.length = 0; this.wash.length = 0; this.marks.length = 0;
      this.pullT = 0; this.grow = ALL; this.twin = null;
      this.th.fence = gm.fenceSync(gm.SYNC_GPU_COMMANDS_COMPLETE, 0); gm.flush();
      root.classList.remove('thread-copy'); root.classList.add('thread');
      this.last = 0; this.kick();
      return;
    }
    // the twin takes the ink as it is now (an ordinary visit's), and the seen
    // ink starts empty
    var tw = this.tw;
    if (!tw || tw.dye.r.w !== this.dyeW || tw.dye.r.h !== this.dyeH) {
      var gl = this.gl;
      tw = { dye: this.double(this.dyeW, this.dyeH, gl.R16F, gl.RED), film: this.double(this.dyeW, this.dyeH, gl.R16F, gl.RED) };
    }
    this.copyTo(this.dye, tw.dye); this.copyTo(this.film, tw.film);
    this.tw = this.twin = tw;
    this.zero();
    this.queue.length = 0; this.drops.length = 0; this.wash.length = 0;
    this.pullT = 0; this.grow = -1; this.land = this.th.p2;
    var g = this.gl; this.th.fence = g.fenceSync(g.SYNC_GPU_COMMANDS_COMPLETE, 0); g.flush();
    root.classList.remove('thread-copy'); root.classList.add('thread');
    this.last = 0; this.kick();
  };
  // Stop the thread where it is: back to the usual ink. full: for a thread
  // cut short, the ink of an ordinary visit is put in at once.
  Ink.prototype.end = function (full) {
    if (!this.th) return;
    if (this.th.fence) this.gl.deleteSync(this.th.fence);
    if (this.th.reveal && this.pullNow != null) this.pullBack = { t: 0 };
    if (full && this.twin) { this.copyTo(this.twin.dye, this.dye); this.copyTo(this.twin.film, this.film); }
    this.th = null; this.twin = null; this.pullT = 0; this.grow = ALL; this.drops.length = 0; this.wash.length = 0; this.marks.length = 0; this.clearNow = null;
    showCopy();
    if (this.canvas.style.opacity === '0') this.canvas.style.opacity = '1';
    this.last = 0; this.kick();
  };
  Ink.prototype.kick = function () { var self = this; if (!this.raf && this.visible && !this.s.hidden) this.raf = requestAnimationFrame(function (n) { self.frame(n); }); };

  Ink.prototype.uv = function (e) { var r = this.s.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height]; };
  Ink.prototype.move = function (e) {
    if (this.s.hidden || still()) return;
    var r = this.s.getBoundingClientRect();
    if (e.clientY < r.top || e.clientY > r.bottom) return;
    var p = this.uv(e);
    if (this.prevP) {
      var dx = p[0] - this.prevP[0], dy = p[1] - this.prevP[1];
      if (dx || dy) this.queue.push({ p: p, v: [dx * 480 * this.aspect, dy * 480], r: 0.0014 });
    }
    this.prevP = p; this.lastMove = performance.now(); this.kick();
  };
  Ink.prototype.press = function (e) {
    // a press stirs
    if (still()) return;
    this.stir(this.uv(e), 0.018, 900, 0.0016);
    this.kick();
  };
  // four pushes k around the point p, at speed v, turning the same way
  Ink.prototype.stir = function (p, k, v, r) {
    this.queue.push({ p: [p[0] + k / this.aspect, p[1]], v: [0, v], r: r });
    this.queue.push({ p: [p[0] - k / this.aspect, p[1]], v: [0, -v], r: r });
    this.queue.push({ p: [p[0], p[1] + k], v: [-v, 0], r: r });
    this.queue.push({ p: [p[0], p[1] - k], v: [v, 0], r: r });
  };
  // ink put straight into the water at p, taken in with the next step
  Ink.prototype.splatDye = function (p, amt, r) { this.drops.push({ p: p, a: amt, r: r }); };
  // later: the hero is off screen; build it a little at a time (warm())
  Ink.prototype.refresh = function (later) {
    // a new size sets the whole name in again, so a thread under way ends
    this.end(false);
    this.warming = false;
    if (!(this.ok && this.P && this.size(later))) return;
    var self = this, cv = this.canvas;
    function go() {
      if (!later) self.visible = true;
      self.last = 0; self.kick();
      // the first time it has drawn, the ink fades in rather than appearing
      // at once; a thread about to begin shows it from its own first frame
      if (cv.style.opacity === '0' && !self.wait) requestAnimationFrame(function () { requestAnimationFrame(function () { cv.style.transition = 'opacity 0.6s ease'; cv.style.opacity = '1'; }); });
    }
    if (!later) { go(); return; }
    // drawn once it is warm, if it is on screen by then; the canvas is the
    // page's white until it is
    this.warming = true;
    this.warm(function () {
      self.warming = false;
      var r = self.s.getBoundingClientRect();
      self.visible = r.bottom > 0 && r.top < innerHeight;
      go();
    });
  };

  var all = [];
  // Starting the ink is heavy: compiling its shaders, drawing the name and
  // running the water for a moment before it shows, about 200ms in one go.
  // Done while the page was arriving, it stalled the transition into the
  // page. So it waits until the page has arrived (js/page-transition.js),
  // then starts at once if the hero is on screen, or in the next quiet moment
  // if the page opened lower down, so it is ready before the reader scrolls
  // back up.
  // Starting the ink stalls the screen for a tenth of a second or so while the
  // GPU builds its programs. On a page opened at the work (the Work link), the
  // hero is above the screen, so the ink waits until the hero comes into view
  // rather than stalling the reader's first look at the projects.
  function boot() {
    var arrived = window.pageArrived || Promise.resolve();
    arrived.then(function () {
      var hero = document.querySelector('.ink-hero');
      if (!hero || !('IntersectionObserver' in window) || onScreen(hero)) { start(); return; }
      // Off screen (the page opened at the work): built now, in the
      // background, where the browser can compile the programs without the
      // page waiting, so it is there when the reader scrolls up. Otherwise
      // it waits for the hero, as below.
      if (parallel()) { start(true); return; }
      // A hero that comes into view while the page is scrolling (the reader
      // scrolling up, or the logo gliding back to the top, js/nav.js) waits
      // until it stops: built mid-scroll, the scroll froze for most of a
      // second partway.
      var moved = 0;
      function scrolled() { moved = performance.now(); }
      window.addEventListener('scroll', scrolled, { passive: true });
      function settle() {
        var quiet = performance.now() - moved;
        if (quiet < 150) { window.setTimeout(settle, 150 - quiet); return; }
        window.removeEventListener('scroll', scrolled);
        start();
      }
      var io = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return;
        io.disconnect(); settle();
      });
      io.observe(hero);
    });
  }
  function onScreen(el) { var r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }
  // whether this browser can compile without the page waiting (Ink.init())
  function parallel() {
    try {
      var g = document.createElement('canvas').getContext('webgl2');
      var ok = !!(g && g.getExtension('KHR_parallel_shader_compile'));
      var l = g && g.getExtension('WEBGL_lose_context'); if (l) l.loseContext();
      return ok;
    } catch (e) { return false; }
  }
  // later: the hero is off screen, and is built a little at a time
  function start(later) {
    document.querySelectorAll('.ink-hero').forEach(function (s) { var i = new Ink(s); if (!reduce && i.ok) i.canvas.style.opacity = '0'; all.push(i); });
    // The thread, if js/intro.js decided on it and has not since given up on
    // the ink and shown the copy: taken by the first hero, once.
    var th = window.inkThread, first = all[0];
    if (th && !th.taken && root.classList.contains('thread')) {
      if (first && first.ok && !first.s.hidden && !still()) { th.taken = true; first.wait = th; }
      else showCopy();
    }
    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { all.forEach(function (i) { if (!i.s.hidden) i.refresh(!onScreen(i.s) && i.parallel); }); }, 150); });
    // ready once the name's font has loaded and the programs are built
    var ready = Promise.all([document.fonts ? document.fonts.load(WEIGHT + '40px ' + FONT, NAME.join('')) : null].concat(all.map(function (i) { return i.built; })));
    ready.then(function () {
      all.forEach(function (i) { if (!i.s.hidden) i.refresh(later); });
      // the thread begins once the ink is built: emptied, then the line
      all.forEach(function (i) { if (i.wait) { var w = i.wait; i.wait = null; if (i.vel) i.begin(w); else showCopy(); } });
    });
    // A thread is not left half drawn: in a hidden tab, or with the motion
    // paused part way, the whole name is put in and the copy shown at once.
    document.addEventListener('visibilitychange', function () { if (document.hidden) all.forEach(function (i) { i.end(true); }); });
    // ?thread on the address: T plays it again, from the logo
    if (th && th.debug) window.addEventListener('keydown', function (e) {
      if ((e.key === 't' || e.key === 'T') && !e.metaKey && !e.ctrlKey && !e.altKey && first && first.vel && !still()) first.begin(th);
    });
    // Play motion again: start the loop back up
    // where it stopped.
    var go = new MutationObserver(function () {
      if (still()) all.forEach(function (i) { i.end(true); });
      else all.forEach(function (i) { i.last = 0; i.kick(); });
    });
    go.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    go.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }
  window.heroInk = { refresh: function (section) { all.forEach(function (i) { if (i.s === section) i.refresh(); }); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
