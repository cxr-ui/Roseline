/* ------------------------------------------------------------------
   Roseline avatar — original procedural Canvas2D character.
   Not derived from any uploaded photo or third-party asset. Built
   from primitive shapes (arcs, beziers, gradients) so it renders
   cheaply on low-end Android GPUs — no WebGL, no textures, no
   external assets.
------------------------------------------------------------------- */

const RoselineAvatar = (function () {

  const EXPRESSIONS = {
    neutral:   { browAngle: 0,   browRaise: 0,   eyeOpen: 1,   mouthCurve: 0.15, mouthOpenBase: 0,   glow: '#4fd1ff' },
    caring:    { browAngle: -4,  browRaise: 1,   eyeOpen: 0.92,mouthCurve: 0.35, mouthOpenBase: 0,   glow: '#7fe0ff' },
    happy:     { browAngle: 2,   browRaise: 2,   eyeOpen: 0.85,mouthCurve: 0.62, mouthOpenBase: 0.05,glow: '#8be8c9' },
    thinking:  { browAngle: 8,   browRaise: -1,  eyeOpen: 0.8, mouthCurve: -0.05,mouthOpenBase: 0,   glow: '#a58bff' },
    focused:   { browAngle: 6,   browRaise: -2,  eyeOpen: 0.88,mouthCurve: 0.05, mouthOpenBase: 0,   glow: '#4fd1ff' },
    excited:   { browAngle: 3,   browRaise: 3,   eyeOpen: 1.05,mouthCurve: 0.7,  mouthOpenBase: 0.15,glow: '#ffd166' },
    tired:     { browAngle: -2,  browRaise: -3,  eyeOpen: 0.5, mouthCurve: -0.1, mouthOpenBase: 0,   glow: '#5f7fa8' },
    ambitious: { browAngle: 5,   browRaise: 0,   eyeOpen: 0.95,mouthCurve: 0.3,  mouthOpenBase: 0,   glow: '#4fd1ff' },
  };

  function create(canvas, opts) {
    opts = opts || {};
    const ctx = canvas.getContext('2d', { alpha: true });
    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let W = 0, H = 0;

    let state = {
      expression: 'focused',
      targetExpr: 'focused',
      mix: 1,               // 0..1 morph progress between expr and targetExpr
      blink: 0,             // 0 = open, 1 = closed
      blinkTimer: randBlinkGap(),
      mouthOpen: 0,          // driven by lip-sync
      talking: false,
      breathe: 0,
      lastT: 0,
      glowPulse: 0,
      running: false,
    };

    function randBlinkGap(){ return 2200 + Math.random() * 3200; }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      W = rect.width; H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener('resize', resize);
    resize();

    function setExpression(name) {
      if (!EXPRESSIONS[name]) name = 'neutral';
      if (name !== state.targetExpr) {
        state.targetExpr = name;
        state.mix = 0;
      }
    }

    function setTalking(on) { state.talking = on; if (!on) state.mouthOpen = 0; }

    // amplitude 0..1, called repeatedly while speech audio plays to fake lip-sync
    function setMouthAmplitude(a) { state._amp = Math.max(0, Math.min(1, a)); }

    function lerp(a, b, t) { return a + (b - a) * t; }

    function currentExprValues() {
      const a = EXPRESSIONS[state.expression];
      const b = EXPRESSIONS[state.targetExpr];
      const t = state.mix;
      return {
        browAngle: lerp(a.browAngle, b.browAngle, t),
        browRaise: lerp(a.browRaise, b.browRaise, t),
        eyeOpen: lerp(a.eyeOpen, b.eyeOpen, t),
        mouthCurve: lerp(a.mouthCurve, b.mouthCurve, t),
        mouthOpenBase: lerp(a.mouthOpenBase, b.mouthOpenBase, t),
        glow: b.glow,
      };
    }

    /* ---------------- drawing ---------------- */

    function draw(ex) {
      ctx.clearRect(0, 0, W, H);

      const cx = W / 2;
      const cy = H * 0.56;
      const scale = Math.min(W, H) * 0.0046;
      const breatheY = Math.sin(state.breathe) * 2 * scale;
      const breatheS = 1 + Math.sin(state.breathe) * 0.006;

      ctx.save();
      ctx.translate(cx, cy + breatheY);
      ctx.scale(scale * breatheS, scale * breatheS);

      drawHoloGlow(ex);
      drawShoulders();
      drawNeck();
      drawHairBack();
      drawFace(ex);
      drawHairFront();
      drawNecklace();
      drawHoodieFront();
      drawRim(ex);

      ctx.restore();

      drawScanline();
    }

    function drawHoloGlow(ex) {
      const pulse = 0.85 + Math.sin(state.glowPulse) * 0.15;
      const g = ctx.createRadialGradient(0, -20, 20, 0, -10, 190 * pulse);
      g.addColorStop(0, hexAlpha(ex.glow, 0.30));
      g.addColorStop(0.6, hexAlpha(ex.glow, 0.10));
      g.addColorStop(1, hexAlpha(ex.glow, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, -10, 190 * pulse, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawShoulders() {
      // hoodie body — dark slate gradient
      const g = ctx.createLinearGradient(0, 60, 0, 190);
      g.addColorStop(0, '#232c3d');
      g.addColorStop(1, '#141a26');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-95, 190);
      ctx.quadraticCurveTo(-100, 90, -46, 62);
      ctx.quadraticCurveTo(0, 48, 46, 62);
      ctx.quadraticCurveTo(100, 90, 95, 190);
      ctx.closePath();
      ctx.fill();

      // hood collar behind neck
      ctx.fillStyle = '#1b2230';
      ctx.beginPath();
      ctx.ellipse(0, 58, 50, 22, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawNeck() {
      const g = ctx.createLinearGradient(0, 20, 0, 66);
      g.addColorStop(0, '#e2b092');
      g.addColorStop(1, '#c98f70');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-20, 66);
      ctx.quadraticCurveTo(-22, 30, -14, 18);
      ctx.lineTo(14, 18);
      ctx.quadraticCurveTo(22, 30, 20, 66);
      ctx.closePath();
      ctx.fill();
    }

    function drawHairBack() {
      // loose strands + bun mass sitting behind head/shoulders
      ctx.fillStyle = '#1a1620';
      ctx.beginPath();
      ctx.ellipse(0, -18, 78, 92, 0, 0, Math.PI * 2);
      ctx.fill();

      // bun
      ctx.beginPath();
      ctx.ellipse(4, -96, 30, 24, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-16, -92, 20, 17, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // loose strands framing face
      ctx.strokeStyle = '#1a1620';
      ctx.lineCap = 'round';
      [[-58, -40, -78, 30], [-66, -10, -80, 60], [60, -36, 82, 28], [68, -6, 84, 58]].forEach(p => {
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        ctx.quadraticCurveTo(p[0] * 1.3, (p[1] + p[3]) / 2, p[2], p[3]);
        ctx.stroke();
      });
    }

    function drawFace(ex) {
      // face base — warm skin tone, soft oval, gentle jaw taper
      const skin = ctx.createLinearGradient(-60, -70, 60, 40);
      skin.addColorStop(0, '#f0c1a0');
      skin.addColorStop(1, '#dba17d');
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.moveTo(0, -78);
      ctx.bezierCurveTo(46, -78, 60, -30, 54, 8);
      ctx.bezierCurveTo(50, 34, 26, 52, 0, 54);
      ctx.bezierCurveTo(-26, 52, -50, 34, -54, 8);
      ctx.bezierCurveTo(-60, -30, -46, -78, 0, -78);
      ctx.closePath();
      ctx.fill();

      // soft cheek shading
      ctx.fillStyle = 'rgba(200,110,90,0.14)';
      ctx.beginPath(); ctx.ellipse(-32, 12, 13, 9, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(32, 12, 13, 9, 0, 0, Math.PI*2); ctx.fill();

      // bindi (small dot, culturally consistent detail — original, not traced)
      ctx.fillStyle = '#7a1f2b';
      ctx.beginPath(); ctx.arc(0, -46, 2.6, 0, Math.PI*2); ctx.fill();

      drawEyebrows(ex);
      drawEyes(ex);
      drawNose();
      drawMouth(ex);
    }

    function drawEyebrows(ex) {
      ctx.strokeStyle = '#241a1a';
      ctx.lineWidth = 4.2;
      ctx.lineCap = 'round';
      const raise = ex.browRaise;
      const ang = (ex.browAngle * Math.PI) / 180;
      [-1, 1].forEach(side => {
        ctx.save();
        ctx.translate(side * 24, -32 - raise);
        ctx.rotate(side * ang * 0.14);
        ctx.beginPath();
        ctx.moveTo(-11, 2);
        ctx.quadraticCurveTo(0, -6 - raise * 0.3, 11, 1);
        ctx.stroke();
        ctx.restore();
      });
    }

    function drawEyes(ex) {
      const open = Math.max(0.04, ex.eyeOpen * (1 - state.blink));
      [-1, 1].forEach(side => {
        const x = side * 22, y = -18;
        ctx.save();
        ctx.translate(x, y);

        // eyelid / white
        ctx.fillStyle = '#fbf5ef';
        ctx.beginPath();
        ctx.ellipse(0, 0, 11.5, 7.2 * open, 0, 0, Math.PI * 2);
        ctx.fill();

        if (open > 0.12) {
          // iris
          ctx.fillStyle = '#3c2a1e';
          ctx.beginPath();
          ctx.ellipse(0, 0.5, 5.2, 5.2 * Math.min(1, open + 0.2), 0, 0, Math.PI * 2);
          ctx.fill();
          // pupil
          ctx.fillStyle = '#150d09';
          ctx.beginPath();
          ctx.arc(0, 0.5, 2.4, 0, Math.PI * 2);
          ctx.fill();
          // catchlight — the bit of life in the eye
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.beginPath();
          ctx.arc(-1.6, -1.6, 1.1, 0, Math.PI * 2);
          ctx.fill();
        }

        // lash line
        ctx.strokeStyle = '#241a1a';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(0, 0, 11.5, 7.2 * open, 0, Math.PI * 0.05, Math.PI * 0.95);
        ctx.stroke();

        ctx.restore();
      });
    }

    function drawNose() {
      ctx.strokeStyle = 'rgba(150,90,70,0.5)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-2, -8);
      ctx.quadraticCurveTo(-4, 4, -3, 8);
      ctx.quadraticCurveTo(0, 10, 3, 8);
      ctx.stroke();
    }

    function drawMouth(ex) {
      const amp = state._amp || 0;
      const openness = Math.max(ex.mouthOpenBase, state.talking ? amp : 0);
      const curve = ex.mouthCurve;
      const w = 15;
      ctx.save();
      ctx.translate(0, 28);

      ctx.fillStyle = '#7a3b3b';
      ctx.beginPath();
      ctx.moveTo(-w, 0);
      ctx.quadraticCurveTo(0, curve * 26 + openness * 14, w, 0);
      ctx.quadraticCurveTo(0, curve * 26 - openness * 20, -w, 0);
      ctx.closePath();
      ctx.fill();

      // upper lip line for subtlety
      ctx.strokeStyle = 'rgba(120,60,55,0.5)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-w, 0);
      ctx.quadraticCurveTo(0, curve * 26, w, 0);
      ctx.stroke();

      ctx.restore();
    }

    function drawHairFront() {
      ctx.fillStyle = '#1a1620';
      // side-swept bang
      ctx.beginPath();
      ctx.moveTo(-52, -58);
      ctx.quadraticCurveTo(-10, -84, 30, -66);
      ctx.quadraticCurveTo(4, -70, -18, -48);
      ctx.quadraticCurveTo(-40, -40, -52, -58);
      ctx.closePath();
      ctx.fill();

      // flyaway strands near bun for softness
      ctx.strokeStyle = '#1a1620';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      [[10, -104, 26, -118], [-8, -108, -20, -122]].forEach(p => {
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        ctx.quadraticCurveTo(p[0] + 4, (p[1] + p[3]) / 2, p[2], p[3]);
        ctx.stroke();
      });
    }

    function drawNecklace() {
      ctx.strokeStyle = 'rgba(220,225,235,0.85)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-16, 60);
      ctx.quadraticCurveTo(0, 76, 16, 60);
      ctx.stroke();

      // small cross pendant
      ctx.save();
      ctx.translate(0, 74);
      ctx.strokeStyle = '#d8dde6';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -6); ctx.lineTo(0, 7);
      ctx.moveTo(-4.5, -1); ctx.lineTo(4.5, -1);
      ctx.stroke();
      ctx.restore();
    }

    function drawHoodieFront() {
      // zipper + drawstrings for texture
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 70);
      ctx.lineTo(0, 178);
      ctx.stroke();

      ctx.strokeStyle = '#3a4356';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-10, 76); ctx.quadraticCurveTo(-16, 100, -12, 122); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(10, 76); ctx.quadraticCurveTo(16, 100, 12, 122); ctx.stroke();

      // collar highlight
      ctx.strokeStyle = 'rgba(120,200,255,0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 58, 50, 22, 0, Math.PI * 0.05, Math.PI * 0.95);
      ctx.stroke();
    }

    function drawRim(ex) {
      // thin holographic rim-light along the silhouette — the "Joi" cue,
      // kept subtle so she reads as a person, not a glitch effect
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = hexAlpha(ex.glow, 0.55);
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-95, 188);
      ctx.quadraticCurveTo(-100, 88, -46, 60);
      ctx.bezierCurveTo(-60, -30, -46, -78, 0, -78);
      ctx.bezierCurveTo(46, -78, 60, -30, 54, 8);
      ctx.quadraticCurveTo(100, 88, 95, 188);
      ctx.stroke();
      ctx.restore();
    }

    function drawScanline() {
      // one faint horizontal sweep — cheap (no per-pixel filter), evokes hologram
      const t = (performance.now() % 4000) / 4000;
      const y = t * H;
      const g = ctx.createLinearGradient(0, y - 30, 0, y + 30);
      g.addColorStop(0, 'rgba(79,209,255,0)');
      g.addColorStop(0.5, 'rgba(79,209,255,0.05)');
      g.addColorStop(1, 'rgba(79,209,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y - 30, W, 60);
    }

    function hexAlpha(hex, a) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${a})`;
    }

    /* ---------------- animation loop (throttled to ~20fps to save CPU) ---------------- */

    const FRAME_MS = 1000 / 20;
    let acc = 0;

    function tick(t) {
      if (!state.running) return;
      if (!state.lastT) state.lastT = t;
      const dt = t - state.lastT;
      state.lastT = t;
      acc += dt;

      if (acc >= FRAME_MS) {
        step(acc);
        acc = 0;
        const ex = currentExprValues();
        draw(ex);
      }
      requestAnimationFrame(tick);
    }

    function step(dt) {
      // blink cycle
      state.blinkTimer -= dt;
      if (state.blinkTimer <= 0 && state.blink === 0) {
        state.blink = 0.001; // start closing
      }
      if (state.blink > 0) {
        state.blink += dt / 90;
        if (state.blink >= 1.4) {
          state.blink = 0;
          state.blinkTimer = randBlinkGap();
        } else if (state.blink > 1) {
          state.blink = 2 - state.blink; // reopening half of triangle wave
        }
      }
      state.blink = Math.max(0, Math.min(1, state.blink));

      // breathing
      state.breathe += dt * 0.0011;
      state.glowPulse += dt * 0.0018;

      // expression morph
      if (state.mix < 1) {
        state.mix = Math.min(1, state.mix + dt / 260);
        if (state.mix >= 1) state.expression = state.targetExpr;
      }

      // fake amplitude decay for lip sync when no live amplitude is pushed
      if (state.talking && state._ampAuto) {
        state._amp = 0.15 + Math.abs(Math.sin(performance.now() * 0.012)) * 0.5;
      }
    }

    function start() {
      if (state.running) return;
      state.running = true;
      requestAnimationFrame(tick);
    }
    function stop() { state.running = false; }

    // auto-amplitude mode: call this when speaking without real audio analysis
    function talkAuto(on) {
      state.talking = on;
      state._ampAuto = on;
      if (!on) state._amp = 0;
    }

    return {
      start, stop, resize,
      setExpression, setTalking, setMouthAmplitude, talkAuto,
      EXPRESSIONS,
    };
  }

  return { create };
})();
