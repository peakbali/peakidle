// ---------- Background music and sound effects ----------
// All the music and sounds are made right here in code with the browser's Web Audio API.
// There are no sound files: nothing extra to download, nothing copyrighted, and it
// works offline too.
//
// Two tunes:
//   "forge"  - calm and slow, for mining, smithing and the menus.
//   "battle" - fast with drums, plays while the battle screen is open.
//
// Browsers don't allow sound until you touch the page, so the music starts on your
// first tap. It pauses when the app goes to the background (other app, screen off).
//
// Sound effects: game.js calls sfx("mine"), sfx("buy"), sfx("roar") and so on.
// The list of sounds is in SOUNDS further down.
//
// Your choices (music and sounds on/off and volume) are kept in their own little
// setting ("peakidle-music"). This file never reads or changes your game save.

(function () {
  const PREF_KEY = "peakidle-music";
  const AC = window.AudioContext || window.webkitAudioContext;

  // ----- Saved settings -----
  let prefs = { on: true, vol: 50, sfxOn: true, sfxVol: 70 };
  try {
    const saved = JSON.parse(localStorage.getItem(PREF_KEY) || "null");
    if (saved && typeof saved === "object") {
      if (typeof saved.on === "boolean") prefs.on = saved.on;
      if (typeof saved.vol === "number" && saved.vol >= 0 && saved.vol <= 100) prefs.vol = saved.vol;
      if (typeof saved.sfxOn === "boolean") prefs.sfxOn = saved.sfxOn;
      if (typeof saved.sfxVol === "number" && saved.sfxVol >= 0 && saved.sfxVol <= 100) prefs.sfxVol = saved.sfxVol;
    }
  } catch (e) { /* bad or blocked storage: just use the defaults */ }
  function savePrefs() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ }
  }

  // ----- Notes -----
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function freq(name) {
    const m = /^([A-G])([#b]?)(\d)$/.exec(name);
    if (!m) return 0;
    let n = SEMI[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + (Number(m[3]) + 1) * 12;
    return 440 * Math.pow(2, (n - 69) / 12);
  }
  // A bar is 16 steps written like "E5 - - - A4 - . .":
  // a note starts a sound, "-" holds it one more step, "." is silence.
  function parseBar(text) {
    const out = [];
    const t = text.trim().split(/\s+/);
    for (let i = 0; i < t.length; i++) {
      if (t[i] === "-" || t[i] === ".") continue;
      let len = 1;
      while (t[i + len] === "-") len++;
      out.push({ step: i, len, f: freq(t[i]) });
    }
    return out;
  }
  const chord = (...names) => names.map(freq);

  // ----- The two tunes -----
  const TUNES = {
    // Calm A minor, 16 bars: first 8 just harp and bass, then 8 with the melody.
    forge: {
      bpm: 84,
      chords: [
        chord("A3", "C4", "E4"), chord("F3", "A3", "C4"), chord("C4", "E4", "G4"), chord("G3", "B3", "D4"),
        chord("A3", "C4", "E4"), chord("F3", "A3", "C4"), chord("G3", "B3", "D4"), chord("E3", "G#3", "B3"),
      ],
      lead: [
        "E5 - - - A4 - B4 - C5 - - - B4 - A4 -",
        "C5 - - - - - A4 - F4 - - - A4 - C5 -",
        "E5 - - - D5 - C5 - G4 - - - - - . .",
        "D5 - - - B4 - G4 - B4 - D5 - - - . .",
        "E5 - - - A5 - - - G5 - E5 - D5 - C5 -",
        "D5 - - - C5 - A4 - C5 - - - - - . .",
        "B4 - - - D5 - G5 - F5 - E5 - D5 - B4 -",
        "G#4 - - - B4 - - - E5 - - - - - - -",
      ].map(parseBar),
      bars: 16,
      leadFrom: 8,        // melody only in the second half
      battle: false,
    },
    // Fast D minor with drums, 8 bars.
    battle: {
      bpm: 140,
      chords: [
        chord("D3", "F3", "A3"), chord("Bb2", "D3", "F3"), chord("C3", "E3", "G3"), chord("A2", "C#3", "E3"),
        chord("D3", "F3", "A3"), chord("Bb2", "D3", "F3"), chord("C3", "E3", "G3"), chord("A2", "C#3", "E3"),
      ],
      lead: [
        "D5 - . D5 F5 - A5 - G5 - F5 - E5 - D5 -",
        "F5 - - - D5 - Bb4 - D5 - F5 - Bb5 - A5 -",
        "G5 - . G5 E5 - C5 - E5 - G5 - C6 - Bb5 -",
        "A5 - - - - - E5 - C#5 - - - E5 - A4 -",
        "D6 - - - A5 - - - F5 - A5 - D6 - C6 -",
        "Bb5 - - - F5 - D5 - F5 - Bb5 - A5 - G5 -",
        "G5 - - - E5 - G5 - C6 - - - Bb5 - A5 -",
        "A5 - - - C#6 - - - E6 - - - . . . .",
      ].map(parseBar),
      bars: 8,
      leadFrom: 0,
      battle: true,
    },
  };

  // ----- Sound engine -----
  let ctx = null, master = null, bus = null, noise = null, echo = null, fxOut = null;
  let tuneName = "forge", step = 0, nextTime = 0, timer = null;

  const level = (v) => Math.pow(v / 100, 2);
  function musicOn() { return prefs.on && prefs.vol > 0; }
  function sfxOn() { return prefs.sfxOn && prefs.sfxVol > 0; }
  function musicLevel() { return musicOn() ? level(prefs.vol) * 0.55 : 0; }
  function sfxLevel() { return sfxOn() ? level(prefs.sfxVol) * 0.8 : 0; }

  function setup() {
    if (ctx || !AC) return !!ctx;
    try { ctx = new AC(); } catch (e) { ctx = null; return false; }
    // Gentle low-pass so the square waves sound warm, not harsh.
    const warm = ctx.createBiquadFilter();
    warm.type = "lowpass"; warm.frequency.value = 4200;
    warm.connect(ctx.destination);
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(warm);
    // A soft echo, like a big stone cave.
    echo = ctx.createDelay(1);
    echo.delayTime.value = 0.36;
    const fb = ctx.createGain(); fb.gain.value = 0.28;
    const wet = ctx.createGain(); wet.gain.value = 0.35;
    echo.connect(fb).connect(echo);
    echo.connect(wet).connect(master);
    // Sound effects have their own volume and skip the echo.
    fxOut = ctx.createGain();
    fxOut.gain.value = sfxLevel();
    fxOut.connect(warm);
    // One second of noise, reused for drums and effects.
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    newBus();
    return true;
  }

  // Each tune plays into its own "bus" so we can fade one out while the next fades in.
  function newBus() {
    const old = bus;
    bus = ctx.createGain();
    bus.connect(master);
    const now = ctx.currentTime;
    bus.gain.setValueAtTime(0, now);
    bus.gain.linearRampToValueAtTime(1, now + 0.6);
    if (old) {
      old.gain.cancelScheduledValues(now);
      old.gain.setValueAtTime(old.gain.value, now);
      old.gain.linearRampToValueAtTime(0, now + 0.5);
      setTimeout(() => { try { old.disconnect(); } catch (e) {} }, 1500);
    }
  }

  // One note. out = where it goes (music bus or effects). slide = end pitch, if it bends.
  function tone(out, type, f, t, dur, vol, attack, release, withEcho, slide) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, t + Math.max(attack, dur - release));
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(out);
    if (withEcho) g.connect(echo);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  // A puff of noise through a filter: drums, whooshes, scrapes. sweep = end filter frequency.
  function noiseHit(out, t, dur, vol, filterType, cutoff, sweep, q) {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(cutoff, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    if (q) f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(out);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  function kick(out, t, vol = 0.5, from = 140, to = 45, dur = 0.22) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.55);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + dur + 0.03);
  }

  // A "tink" like a hammer on an anvil. Bell-like: a few tones that don't line up.
  function anvil(out, t, vol, base = 1250, len = 0.5, withEcho = true) {
    [1, 2.76, 5.4].forEach((r, i) => tone(out, "sine", base * r, t, len - i * len * 0.24, vol / (i + 1), 0.002, len * 0.9 - i * len * 0.24, withEcho));
  }

  // Plays one 16th-note step of the current tune.
  function playStep(t) {
    const tune = TUNES[tuneName];
    const s16 = 60 / tune.bpm / 4;
    const bar = Math.floor(step / 16) % tune.bars;
    const inBar = step % 16;
    const ch = tune.chords[bar % tune.chords.length];

    if (!tune.battle) {
      // Harp: chord notes going up and down in 8th notes.
      if (inBar % 2 === 0) {
        const order = [0, 1, 2, 3, 2, 1, 2, 1];
        const k = order[inBar / 2];
        const f = k === 3 ? ch[0] * 2 : ch[k];
        tone(bus, "triangle", f, t, s16 * 3, 0.07, 0.005, s16 * 2.5, true);
      }
      // Bass: root, then the fifth.
      if (inBar === 0) tone(bus, "triangle", ch[0] / 2, t, s16 * 7.5, 0.16, 0.02, s16 * 3);
      if (inBar === 8) tone(bus, "triangle", ch[2] / 2, t, s16 * 7.5, 0.12, 0.02, s16 * 3);
      // Soft pad holding the chord.
      if (inBar === 0) ch.forEach(f => tone(bus, "sine", f, t, s16 * 16, 0.035, s16 * 4, s16 * 6));
      // Far-away hammer taps every 4th bar.
      if (bar % 4 === 3 && (inBar === 4 || inBar === 6)) anvil(bus, t, inBar === 4 ? 0.035 : 0.025);
    } else {
      // Driving bass in 8th notes with octave jumps.
      if (inBar % 2 === 0) {
        const up = inBar === 4 || inBar === 12;
        tone(bus, "square", (ch[0] / 2) * (up ? 2 : 1), t, s16 * 1.7, 0.07, 0.004, s16);
      }
      // Quick harp on the chord in 16ths, quiet.
      tone(bus, "triangle", ch[[0, 1, 2, 1][inBar % 4]] * 2, t, s16 * 0.9, 0.035, 0.003, s16 * 0.6);
      // Drums.
      if (inBar === 0 || inBar === 6 || inBar === 8 || (bar % 2 === 1 && inBar === 10)) kick(bus, t);
      if (inBar === 4 || inBar === 12) noiseHit(bus, t, 0.16, 0.22, "bandpass", 1800);
      if (inBar % 2 === 0) noiseHit(bus, t, 0.04, 0.07, "highpass", 7000);
    }

    // Melody.
    if (bar >= tune.leadFrom) {
      const phrase = tune.lead[(bar - tune.leadFrom) % tune.lead.length];
      for (const n of phrase) {
        if (n.step !== inBar) continue;
        const dur = n.len * s16;
        if (tune.battle) tone(bus, "square", n.f, t, dur * 0.95, 0.045, 0.005, Math.min(dur * 0.4, 0.15), true);
        else {
          tone(bus, "triangle", n.f, t, dur, 0.11, 0.02, Math.min(dur * 0.6, 0.5), true);
          tone(bus, "square", n.f, t, dur, 0.012, 0.02, Math.min(dur * 0.6, 0.5));
        }
      }
    }

    step = (step + 1) % (tune.bars * 16);
    return s16;
  }

  // Looks a little ahead and books the next notes, so timing stays smooth.
  function tick() {
    if (!ctx || ctx.state !== "running" || !musicOn()) return;
    if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
    while (nextTime < ctx.currentTime + 0.2) nextTime += playStep(nextTime);
  }

  function ramp(param, value) {
    const now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + 0.25);
  }
  function applyVolume() {
    if (!ctx) return;
    ramp(master.gain, musicLevel());
    ramp(fxOut.gain, sfxLevel());
  }

  // Wake the sound up (only works after a tap) and start the music if it's on.
  function start() {
    if (document.hidden || (!musicOn() && !sfxOn())) return;
    if (!setup()) return;
    const go = () => {
      applyVolume();
      if (musicOn() && !timer) timer = setInterval(tick, 40);
      if (!musicOn() && timer) { clearInterval(timer); timer = null; }
      tick();
    };
    if (ctx.state !== "running") ctx.resume().then(go, () => {});
    else go();
  }

  // Quiet everything down. pause = the app went to the background, so stop all sound.
  function stop(pause) {
    if (timer && (pause || !musicOn())) { clearInterval(timer); timer = null; }
    if (!ctx) return;
    applyVolume();
    const c = ctx;
    setTimeout(() => {
      const idle = document.hidden || (!musicOn() && !sfxOn());
      if (idle && c.state === "running") c.suspend().catch(() => {});
    }, 300);
  }

  // Switch tune when the battle screen opens or closes.
  function chooseTune() {
    const b = document.getElementById("battle");
    const want = b && !b.hidden ? "battle" : "forge";
    if (want === tuneName) return;
    tuneName = want;
    step = 0;
    if (ctx) { newBus(); nextTime = ctx.currentTime + 0.1; }
  }

  // ----- Sound effects -----
  // Each one gets: out (effects volume), t (start time), x (an optional extra, like which ore).
  const SOUNDS = {
    // Pickaxe on rock: a click, a crunch, and a little ring that's higher for better ores.
    mine(out, t, x) {
      const pitch = 700 + (x || 0) * 70 + Math.random() * 60;
      noiseHit(out, t, 0.07, 0.35, "bandpass", 2600, 900, 1.5);
      kick(out, t, 0.25, 220, 90, 0.09);
      anvil(out, t + 0.005, 0.06, pitch, 0.18, false);
    },
    // Coins out of your purse: two bright blips.
    buy(out, t) {
      tone(out, "square", 988, t, 0.07, 0.08, 0.003, 0.03);
      tone(out, "square", 1319, t + 0.07, 0.16, 0.08, 0.003, 0.12);
    },
    // Coins into your purse: a quick jingle.
    sell(out, t) {
      [1319, 1568, 2093].forEach((f, i) => tone(out, "square", f, t + i * 0.055, 0.09, 0.055, 0.002, 0.06));
    },
    // New mine opened: a little fanfare.
    unlock(out, t) {
      [523, 659, 784, 1047].forEach((f, i) => tone(out, "square", f, t + i * 0.09, i === 3 ? 0.4 : 0.1, 0.07, 0.004, i === 3 ? 0.3 : 0.06));
    },
    // Smithing: a heavy hammer on the anvil.
    forge(out, t) {
      noiseHit(out, t, 0.12, 0.4, "bandpass", 1800, 600, 2);
      kick(out, t, 0.3, 180, 70, 0.12);
      anvil(out, t, 0.12, 540 + Math.random() * 40, 0.55, false);
    },
    // Putting on gear: a metal "shink".
    equip(out, t) {
      noiseHit(out, t, 0.18, 0.18, "bandpass", 2500, 7000, 3);
      tone(out, "triangle", 330, t, 0.1, 0.12, 0.004, 0.08, false, 520);
    },
    // A monster shows up: a low growl. Bosses are deeper and longer.
    roar(out, t, boss) {
      const len = boss ? 1.3 : 0.75;
      const base = boss ? 85 : 130 + Math.random() * 40;
      const o = tone(out, "sawtooth", base, t, len, boss ? 0.2 : 0.16, 0.08, len * 0.6, false, base * 0.6);
      // Wobble the pitch so it sounds like a throat, not a buzzer.
      const lfo = ctx.createOscillator(), depth = ctx.createGain();
      lfo.frequency.value = boss ? 18 : 26; depth.gain.value = base * 0.18;
      lfo.connect(depth).connect(o.frequency);
      lfo.start(t); lfo.stop(t + len + 0.05);
      tone(out, "square", base * 1.5, t, len * 0.8, 0.05, 0.06, len * 0.5, false, base);
      noiseHit(out, t, len, boss ? 0.3 : 0.22, "lowpass", 900, 250);
    },
    // You hit the monster.
    hit(out, t) {
      noiseHit(out, t, 0.12, 0.4, "bandpass", 1400, 500, 1);
      kick(out, t, 0.35, 260, 70, 0.14);
    },
    // Critical hit: harder, with a bright ring.
    crit(out, t) {
      noiseHit(out, t, 0.16, 0.5, "bandpass", 1600, 400, 1);
      kick(out, t, 0.45, 300, 60, 0.18);
      anvil(out, t, 0.08, 1500, 0.3, false);
    },
    // The monster hits you: a low thump.
    hurt(out, t) {
      kick(out, t, 0.5, 160, 45, 0.25);
      noiseHit(out, t, 0.14, 0.3, "lowpass", 1200, 300);
    },
    // Burn or poison ticking.
    tick(out, t) {
      noiseHit(out, t, 0.12, 0.15, "bandpass", 900, 400, 2);
      tone(out, "square", 220, t, 0.1, 0.04, 0.003, 0.08, false, 160);
    },
    // A swing that misses: whoosh.
    miss(out, t) { noiseHit(out, t, 0.25, 0.25, "bandpass", 3500, 600, 2); },
    dodge(out, t) { noiseHit(out, t, 0.22, 0.3, "bandpass", 900, 4000, 2); },
    // Parry: sword meets claw.
    parry(out, t) {
      anvil(out, t, 0.1, 1800, 0.35, false);
      noiseHit(out, t, 0.06, 0.25, "highpass", 3000);
    },
    // Too early on Dodge/Parry.
    fail(out, t) { tone(out, "square", 140, t, 0.18, 0.08, 0.004, 0.1, false, 100); },
    heal(out, t) {
      [523, 659, 784, 1047].forEach((f, i) => tone(out, "triangle", f, t + i * 0.06, 0.22, 0.09, 0.01, 0.15));
    },
    // A status like Frozen or Weak lands.
    status(out, t) {
      tone(out, "triangle", 660, t, 0.25, 0.08, 0.01, 0.2, false, 440);
      tone(out, "triangle", 990, t + 0.04, 0.22, 0.05, 0.01, 0.18, false, 660);
    },
    // Casting a skill: a magic sweep up.
    magic(out, t) {
      tone(out, "triangle", 300, t, 0.3, 0.1, 0.02, 0.15, false, 1400);
      tone(out, "sine", 600, t + 0.03, 0.3, 0.06, 0.02, 0.15, false, 2400);
      noiseHit(out, t, 0.3, 0.08, "highpass", 2000, 8000);
    },
    // Net throw that the monster escapes.
    escape(out, t) { noiseHit(out, t, 0.2, 0.25, "bandpass", 600, 2200, 2); },
    win(out, t) {
      [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.3]].forEach(([f, d], i) =>
        tone(out, "square", f, t + d, i === 3 ? 0.6 : 0.12, 0.07, 0.004, i === 3 ? 0.45 : 0.06));
      tone(out, "triangle", 262, t + 0.3, 0.6, 0.12, 0.01, 0.45);
    },
    lose(out, t) {
      [392, 330, 262].forEach((f, i) => tone(out, "triangle", f, t + i * 0.18, i === 2 ? 0.6 : 0.2, 0.12, 0.01, i === 2 ? 0.5 : 0.1));
    },
    // Caught a monster: sparkles.
    catch(out, t) {
      [1047, 1319, 1568, 2093, 2637].forEach((f, i) => tone(out, "sine", f, t + i * 0.05, 0.3, 0.07, 0.003, 0.25));
      tone(out, "triangle", 523, t, 0.5, 0.08, 0.01, 0.4);
    },
    // Reincarnation: a slow rising shimmer.
    souls(out, t) {
      [262, 330, 392, 523, 659, 784].forEach((f, i) => tone(out, "sine", f, t + i * 0.12, 1.1, 0.06, 0.1, 0.8));
      noiseHit(out, t, 1.2, 0.06, "highpass", 3000, 9000);
    },
  };

  // Play a sound effect by name. The same sound can't stack up more than every 50 ms,
  // so "Sell all" or fast tapping doesn't get loud.
  const lastPlayed = {};
  function sfx(name, x) {
    if (!sfxOn() || !ctx || ctx.state !== "running" || document.hidden) return;
    const make = SOUNDS[name];
    if (!make) return;
    const now = performance.now();
    if (lastPlayed[name] && now - lastPlayed[name] < 50) return;
    lastPlayed[name] = now;
    try { make(fxOut, ctx.currentTime + 0.01, x); } catch (e) { /* never let a sound break the game */ }
  }
  window.peakSfx = sfx;

  // ----- Hooking it up -----
  // First tap or key press anywhere starts the sound.
  ["pointerdown", "keydown", "touchend"].forEach(ev => document.addEventListener(ev, () => {
    if (!ctx || ctx.state !== "running") start();
  }, { capture: true, passive: true }));

  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(true); else start(); });
  window.addEventListener("pagehide", () => stop(true));

  const battleEl = document.getElementById("battle");
  if (battleEl) new MutationObserver(chooseTune).observe(battleEl, { attributes: true, attributeFilter: ["hidden"] });
  chooseTune();

  // ----- Settings controls -----
  // Two rows in the settings menu: Music and Sounds, each with an On/Off button and a slider.
  function wireRow(onKey, volKey, prefix) {
    const toggle = document.getElementById(prefix + "-toggle");
    const slider = document.getElementById(prefix + "-vol");
    const num = document.getElementById(prefix + "-vol-num");
    function show() {
      if (toggle) {
        toggle.textContent = prefs[onKey] ? "On" : "Off";
        toggle.setAttribute("aria-pressed", String(prefs[onKey]));
        toggle.classList.toggle("primary", prefs[onKey]);
      }
      if (slider) { slider.value = String(prefs[volKey]); slider.disabled = !prefs[onKey]; slider.style.setProperty("--fill", prefs[volKey] + "%"); }
      if (num) num.textContent = String(prefs[volKey]);
    }
    if (toggle) toggle.addEventListener("click", () => {
      prefs[onKey] = !prefs[onKey];
      savePrefs(); show();
      if (musicOn() || sfxOn()) start(); else stop(false);
      if (!musicOn()) stop(false);
      if (prefix === "sfx") sfx("buy");
    });
    if (slider) {
      slider.addEventListener("input", () => {
        prefs[volKey] = Math.max(0, Math.min(100, Math.round(Number(slider.value) || 0)));
        savePrefs(); show();
        if (musicOn() || sfxOn()) start();
        if (!musicOn()) stop(false);
      });
      // Let go of the Sounds slider: play a sample so you hear how loud it is.
      if (prefix === "sfx") slider.addEventListener("change", () => sfx("mine", 3));
    }
    if (!AC && toggle) toggle.disabled = true;
    show();
  }
  wireRow("on", "vol", "music");
  wireRow("sfxOn", "sfxVol", "sfx");
  if (!AC) {
    const note = document.getElementById("sound-note");
    if (note) note.textContent = "This browser can't play sound.";
  }
})();
