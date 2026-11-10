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
  var FONT = '"Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Hiragino Sans GB", sans-serif';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // The water holds still for a reader whose system asks for reduced motion,
  // and while the page's Pause motion control is on (it sets this class).
  function still() { return reduce || document.body.classList.contains('motion-paused'); }

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
    dye: HEAD + CRF + 'uniform sampler2D uVel; uniform sampler2D uSrc; uniform sampler2D uName; uniform vec2 uVelTexel; uniform vec2 uTexel; uniform float uDt; uniform float uRelax; uniform float uSpread; uniform float uFade;\n' +
      'void main(){ vec2 c = vUv - uDt * texture(uVel, vUv).xy * uVelTexel; float d = cr(uSrc, c); float n = texture(uName, vUv).r;\n' +
      '  float nb = 0.25 * (texture(uSrc, c + vec2(uTexel.x, 0.)).r + texture(uSrc, c - vec2(uTexel.x, 0.)).r + texture(uSrc, c + vec2(0., uTexel.y)).r + texture(uSrc, c - vec2(0., uTexel.y)).r);\n' +
      '  d = mix(d, nb, uSpread);\n' +
      '  d = mix(d, n, 1. - exp(-uRelax * uDt)) * exp(-uFade * uDt); o = vec4(d, 0., 0., 1.); }',
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
    film: HEAD + 'uniform sampler2D uVel; uniform sampler2D uSrc; uniform sampler2D uInk; uniform vec2 uVelTexel; uniform vec2 uTexel; uniform float uDt; uniform float uShed; uniform float uDecay; uniform float uSpread;\n' +
      'void main(){ vec2 c = vUv - uDt * texture(uVel, vUv).xy * uVelTexel; float f = texture(uSrc, c).r;\n' +
      '  float nb = 0.25 * (texture(uSrc, c + vec2(uTexel.x, 0.)).r + texture(uSrc, c - vec2(uTexel.x, 0.)).r + texture(uSrc, c + vec2(0., uTexel.y)).r + texture(uSrc, c - vec2(0., uTexel.y)).r);\n' +
      '  f = mix(f, nb, uSpread);\n' +
      '  f = mix(f, max(f, texture(uInk, vUv).r), 1. - exp(-uShed * uDt));\n' +
      '  o = vec4(f * exp(-uDecay * uDt), 0., 0., 1.); }',
    // the picture: how dark each point is, from paper (0) to core (1), read
    // through the reference's measured colours. The ink sets it; where there
    // is only film, it stays in the reference's palest steps.
    show: HEAD + 'uniform sampler2D uDye; uniform sampler2D uFilm; uniform sampler2D uRamp; uniform sampler2D uVel; uniform vec2 uInk; uniform vec3 uFilmT; uniform float uOpacity; uniform float uReveal; uniform vec4 uCopy; uniform float uAspect; uniform float uClear;\n' +
      'void main(){ float d = texture(uDye, vUv).r, fm = texture(uFilm, vUv).r;\n' +
      '  float t = max(smoothstep(uInk.x, uInk.y, d), uFilmT.z * smoothstep(uFilmT.x, uFilmT.y, fm));\n' +
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
    this.queue = [];
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
    function sh(t, src) { var s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
    var vs = sh(gl.VERTEX_SHADER, VS);
    this.P = {};
    Object.keys(FS).forEach(function (k) {
      var p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS[k]));
      gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (var i = 0; i < n; i++) { var nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
      self.P[k] = { p: p, u: u };
    });
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
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    var fs, m, asc;
    if (this.layout === 'column') {
      // stacked like the reference, the column running the hero's height
      var avail = H - 120 - 40, step = avail / 3;
      fs = step * 0.92 * s;
      g.font = '700 ' + fs + 'px ' + FONT;
      for (var i = 0; i < 3; i++) {
        m = g.measureText(NAME[i]); asc = m.actualBoundingBoxAscent;
        var hgt = asc + m.actualBoundingBoxDescent;
        g.filter = 'blur(' + (fs * 0.022) + 'px)';
        g.fillText(NAME[i], cw / 2, (120 + step * i) * s + (step * s - hgt) / 2 + asc);
      }
    } else {
      // row: across the hero; bleed: bigger, running off both edges
      var k = this.layout === 'bleed' ? 1.16 : 0.84;
      fs = (W * k / 3.04) * s;
      g.font = '700 ' + fs + 'px ' + FONT;
      m = g.measureText(NAME.join('')); asc = m.actualBoundingBoxAscent;
      var h2 = asc + m.actualBoundingBoxDescent;
      g.filter = 'blur(' + (fs * 0.022) + 'px)';
      g.fillText(NAME.join(''), cw / 2, ch / 2 - h2 / 2 + asc + (this.layout === 'bleed' ? 0 : ch * 0.02));
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

  Ink.prototype.size = function () {
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
    this.run('dye', this.dye.w, { uVel: this.vel.r.t, uSrc: this.dye.r.t, uName: this.nameTex }, { uVelTexel: [1 / simW, 1 / simH], uDt: 0, uRelax: 1e6, uSpread: 0 }, [this.dyeW, this.dyeH]);
    this.dye.swap();
    this.run('dye', this.film.w, { uVel: this.vel.r.t, uSrc: this.film.r.t, uName: this.filmTex }, { uVelTexel: [1 / simW, 1 / simH], uDt: 0, uRelax: 1e6, uSpread: 0 }, [this.dyeW, this.dyeH]);
    this.film.swap();
    // let the current run for a moment before anyone sees it
    for (var i = 0; i < 240; i++) this.step(1 / 60, i / 60);
    return true;
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

  Ink.prototype.step = function (dt, t) {
    var S = [this.simW, this.simH], vt = [1 / this.simW, 1 / this.simH];
    // the current
    this.run('current', this.vel.w, { uVel: this.vel.r.t }, { uT: t, uAspect: this.aspect, uStrength: this.current, uDrift: [this.current * DRIFT, 0], uDt: dt, uScale: SCALE }, S); this.vel.swap();
    // what people wrote into it
    for (var i = 0; i < this.queue.length; i++) {
      var q = this.queue[i];
      this.run('splat', this.vel.w, { uT: this.vel.r.t }, { uAspect: this.aspect, uPoint: q.p, uColor: [q.v[0], q.v[1], 0], uRadius: q.r }, S); this.vel.swap();
    }
    this.queue.length = 0;
    // curls, then keep the water from compressing
    this.run('curl', this.curlF, { uVel: this.vel.r.t }, {}, S);
    this.run('vort', this.vel.w, { uVel: this.vel.r.t, uCurl: this.curlF.t }, { uCurlK: CURL, uDt: dt }, S); this.vel.swap();
    this.run('div', this.divF, { uVel: this.vel.r.t }, {}, S);
    this.run('clear', this.prs.w, { uT: this.prs.r.t }, { uV: 0.8 }, S); this.prs.swap();
    for (var j = 0; j < 20; j++) { this.run('pressure', this.prs.w, { uP: this.prs.r.t, uDiv: this.divF.t }, {}, S); this.prs.swap(); }
    this.run('grad', this.vel.w, { uP: this.prs.r.t, uVel: this.vel.r.t }, {}, S); this.vel.swap();
    // carry the water and the dye
    this.run('advect', this.vel.w, { uVel: this.vel.r.t, uSrc: this.vel.r.t }, { uVelTexel: vt, uDt: dt, uDiss: DISS, uVisc: VISC }, S); this.vel.swap();
    this.run('dye', this.dye.w, { uVel: this.vel.r.t, uSrc: this.dye.r.t, uName: this.nameTex }, { uVelTexel: vt, uDt: dt, uRelax: this.relax, uSpread: 0, uFade: FADE }, [this.dyeW, this.dyeH]); this.dye.swap();
    // the film: taken up from the ink, then left to drift and spread
    this.run('film', this.film.w, { uVel: this.vel.r.t, uSrc: this.film.r.t, uInk: this.dye.r.t }, { uVelTexel: vt, uDt: dt, uShed: SHED, uDecay: DECAY, uSpread: SPREAD }, [this.dyeW, this.dyeH]); this.film.swap();
  };

  Ink.prototype.frame = function (now) {
    this.raf = null;
    if (!this.visible || this.s.hidden || !this.vel) return;
    var dt = Math.min(1 / 30, (now - (this.last || now)) / 1000) || 1 / 60; this.last = now;
    var t = (now - this.t0) / 1000;
    // with no one there, a slow hand passes through every so often
    if (!reduce && now - this.lastMove > 3500) {
      var gx = 0.5 + 0.42 * Math.sin(t * 0.17), gy = 0.5 + 0.22 * Math.sin(t * 0.29 + 1.0);
      var vx = 0.42 * 0.17 * Math.cos(t * 0.17), vy = 0.22 * 0.29 * Math.cos(t * 0.29 + 1.0);
      if (false) this.queue.push({ p: [gx, gy], v: [vx * 420 * this.aspect, vy * 420], r: 0.004 });
    }
    var hold = still();
    if (!hold) this.step(dt, t);
    this.run('show', null, { uDye: this.dye.r.t, uFilm: this.film.r.t, uVel: this.vel.r.t, uRamp: this.rampTex }, { uInk: INK, uFilmT: FILMT, uOpacity: this.opacity, uReveal: this.reveal, uCopy: this.copyBox, uAspect: this.aspect, uClear: this.clear }, [this.canvas.width, this.canvas.height]);
    if (!hold) this.kick();
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
    // a press stirs: four pushes around the point, turning the same way
    if (still()) return;
    var p = this.uv(e), k = 0.018;
    this.queue.push({ p: [p[0] + k / this.aspect, p[1]], v: [0, 900], r: 0.0016 });
    this.queue.push({ p: [p[0] - k / this.aspect, p[1]], v: [0, -900], r: 0.0016 });
    this.queue.push({ p: [p[0], p[1] + k], v: [-900, 0], r: 0.0016 });
    this.queue.push({ p: [p[0], p[1] - k], v: [900, 0], r: 0.0016 });
    this.kick();
  };
  Ink.prototype.refresh = function () {
    if (!(this.ok && this.size())) return;
    this.visible = true; this.last = 0; this.kick();
    // the first time it has drawn, the ink fades in rather than appearing at once
    var cv = this.canvas;
    if (cv.style.opacity === '0') requestAnimationFrame(function () { requestAnimationFrame(function () { cv.style.transition = 'opacity 0.6s ease'; cv.style.opacity = '1'; }); });
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
      if (!hero || !('IntersectionObserver' in window)) { start(); return; }
      var io = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return;
        io.disconnect(); start();
      });
      io.observe(hero);
    });
  }
  function start() {
    document.querySelectorAll('.ink-hero').forEach(function (s) { var i = new Ink(s); if (!reduce && i.ok) i.canvas.style.opacity = '0'; all.push(i); });
    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { all.forEach(function (i) { if (!i.s.hidden) i.refresh(); }); }, 150); });
    var ready = document.fonts ? document.fonts.load('700 40px ' + FONT, NAME.join('')) : Promise.resolve();
    ready.then(function () { all.forEach(function (i) { if (!i.s.hidden) i.refresh(); }); });
    // Play motion again: start the loop back up where it stopped.
    new MutationObserver(function () { if (!still()) all.forEach(function (i) { i.last = 0; i.kick(); }); })
      .observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }
  window.heroInk = { refresh: function (section) { all.forEach(function (i) { if (i.s === section) i.refresh(); }); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
