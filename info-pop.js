// Info popups: a small pixel window with everything about a skill or a monster.
//
// Anything with a data-info attribute opens one:
//   data-info="skill:firebolt"     a skill (data-info-level="3" shows it at a fixed level, used in battle)
//   data-info="mon:12"             a waiting monster (its uid)
//   data-info="boss:4"             the boss of a danger level
//   data-info="foe"                the monster you are fighting right now
//
// How you open it:
//   Phone: tap the picture (tap outside or the X to close). Battle skill buttons: tap the little "i",
//          or press and hold the skill button. A normal tap still casts the skill.
//   Computer: hover the picture for a moment, or click it to keep the window open.
// Loaded after game.js and uses its rules, so the numbers always match the real fight.

const infoPop = { el: null, key: null, anchor: null, pinned: false, html: "", hoverTimer: null, leaveTimer: null, press: null, eatClick: false };

// ---------- What goes in the window ----------

function ipRow(label, value, cls = "") {
  return `<div class="ip-row ${cls}"><span class="ip-k">${label}</span><span class="ip-v">${value}</span></div>`;
}
function ipPct(x) { return `${Math.round(x * 100)}%`; }

// The fight the window is about: only while the battle screen is open.
function ipBattle() {
  const b = state.battle;
  return b && !b.result && document.body.classList.contains("in-battle") ? b : null;
}

function skillInfoHTML(sk, levelOverride) {
  const b = ipBattle();
  const e = elementById[sk.element];
  const g = skillGrade(sk);
  const owned = skillLevel(sk.id);
  const level = levelOverride || owned;
  const lvl = skillLevelMult(Math.max(1, level));
  const hero = b ? b.hero : heroStats();
  const mastery = b ? battleMastery(sk.element) : masteryLevel(sk.element);
  const mDmg = 1 + MASTERY.damage * mastery;
  const boost = skillBoost(sk);
  const foe = b && b.monster;

  const rows = [];
  rows.push(ipRow("Mana", `💧 ${g.mana}${b ? ` <span class="ip-dim">(you have ${b.mana})</span>` : ""}`));
  rows.push(ipRow("Grade", `${g.name}${boost > 1 ? ` <span class="ip-dim">(×${boost} power)</span>` : ""}`));
  rows.push(ipRow("Level", level > 0 ? `Lv ${level} <span class="ip-dim">(+${Math.round((lvl - 1) * 100)}%)</span>` : `<span class="ip-dim">Not learned yet</span>`));

  if (sk.power) {
    const power = Math.round(hero.attack * sk.power * lvl * boost * mDmg);
    const hits = sk.hits ? `${sk.hits} × ` : "";
    rows.push(ipRow("Damage", `${hits}<b>${fmt(power)}</b> power`, "ip-big"));
    if (foe) {
      const mult = elementMultiplier(sk.element, foe.element);
      const per = Math.max(1, Math.round(baseDamage(hero.attack * sk.power * lvl, foe.stats.defense) * mult * damageMult("hero") * mDmg * boost));
      const note = mult > 1 ? ` <span class="ip-good">weak spot ×${WEAK_HIT}</span>` : mult < 1 ? ` <span class="ip-bad">resisted ×${RESISTED_HIT}</span>` : "";
      rows.push(ipRow(`On ${foe.name}`, `about <b>${hits}${fmt(per)}</b>${note}`));
    }
    const crit = Math.min(1, hero.luck / 100 + (sk.critBonus || 0));
    rows.push(ipRow("Crit chance", `${ipPct(crit)}${sk.critBonus ? ` <span class="ip-dim">(+${ipPct(sk.critBonus)} from skill)</span>` : ""} · ×${BATTLE.critMultiplier}`));
    rows.push(ipRow("Accuracy", "Never misses"));
  }
  if (sk.heal) rows.push(ipRow("Heals", `<b>${fmt(Math.round(hero.hp * sk.heal * lvl * boost))}</b> HP <span class="ip-dim">(${ipPct(sk.heal * lvl * boost)} of max)</span>`, "ip-big"));
  if (sk.status) {
    const st = STATUS[sk.status];
    const chance = Math.min(1, sk.chance * (1 + MASTERY.statusChance * mastery));
    rows.push(ipRow("Status", `${st.icon} ${st.name} · <b>${ipPct(chance)}</b>${sk.hits ? " per hit" : ""}`));
    rows.push(`<div class="ip-note">${st.icon} ${st.desc} Lasts ${st.turns} turn${st.turns > 1 ? "s" : ""}.</div>`);
  }
  const extras = [];
  if (sk.guard) extras.push("🛡️ You also guard this turn");
  if (sk.interrupt) extras.push("✋ Breaks a heavy attack wind-up");
  if (sk.cleanse) extras.push("✨ Cures your status effects");
  if (extras.length) rows.push(`<div class="ip-note">${extras.join("<br>")}</div>`);
  rows.push(ipRow(`${e.icon} Mastery`, mastery > 0 ? `Lv ${mastery} <span class="ip-dim">(+${Math.round(MASTERY.damage * mastery * 100)}% dmg)</span>` : `<span class="ip-dim">Lv 0</span>`));

  // Buying and levelling, only outside a fight.
  if (!b) {
    if (owned > 0) {
      const next = skillLevelMult(owned + 1);
      const nextTxt = sk.power ? `${fmt(Math.round(hero.attack * sk.power * next * boost * mDmg))} power`
        : sk.heal ? `heals ${fmt(Math.round(hero.hp * sk.heal * next * boost))}` : "";
      rows.push(ipRow("Next level", `${nextTxt ? nextTxt + " · " : ""}${fmt(skillLevelCost(sk))} ${e.icon}`));
    } else {
      rows.push(ipRow("Price", `${fmt(skillBuyCost(sk))} ${e.icon} ${e.drop}`));
    }
  }

  return `
    <div class="ip-head mon-bg-${e.id}">
      <div class="ip-pic">${skillArtSVG(sk.id)}</div>
      <div class="ip-title">
        <div class="ip-name">${sk.name}</div>
        <div class="ip-tags">${elementTag(sk.element, true)}<span class="tag">${g.name}</span></div>
      </div>
    </div>
    <div class="ip-desc">${sk.desc}</div>
    <div class="ip-rows">${rows.join("")}</div>
    ${sk.power ? `<div class="ip-foot">Power = your attack × the skill. The monster's defense takes some off.</div>` : ""}`;
}

function monsterInfoHTML(m, live) {
  const b = ipBattle();
  const hero = b ? b.hero : heroStats();
  const e = elementById[m.element];
  const weak = elementById[weaknessOf(m.element)], strong = elementById[strengthOf(m.element)];
  const zone = TIERS[m.tier - 1];
  const info = m.boss ? (BOSS_ART[monsterArtKey(m)] || {}) : {};
  const move = MONSTER_MOVES[m.element];
  const moveSt = STATUS[move.status];
  const own = STATUS[ELEMENT_STATUS[m.element]];

  const hp = live ? `${fmt(b.monsterHp)} / ${fmt(m.stats.hp)}` : fmt(m.stats.hp);
  const stats = `
    <div class="ip-stats">
      <div><span>❤️ HP</span><b>${hp}</b></div>
      <div><span>⚔️ Attack</span><b>${fmt(m.stats.attack)}</b></div>
      <div><span>🛡️ Defense</span><b>${fmt(m.stats.defense)}</b></div>
      <div><span>💨 Agility</span><b>${fmt(m.stats.agility)}</b></div>
    </div>`;

  const yourHit = Math.max(1, Math.round(baseDamage(hero.attack, m.stats.defense)));
  const itsHit = Math.max(1, Math.round(baseDamage(m.stats.attack, hero.defense)));
  const rows = [
    ipRow("Weak to", `${weak.icon} ${weak.name} <span class="ip-good">×${WEAK_HIT} damage</span>`),
    ipRow("Resists", `${strong.icon} ${strong.name} <span class="ip-bad">×${RESISTED_HIT} damage</span>`),
    ipRow("Immune to", `${own.icon} ${own.name} <span class="ip-dim">(its own element)</span>`),
  ];
  const moves = [
    `⚔️ <b>Attack</b>: a normal hit`,
    `${e.icon} <b>${move.name}</b>: ${ipPct(move.power)} power, ${ipPct(move.chance)} chance to ${moveSt.icon} ${moveSt.name.toLowerCase()}`,
    `💥 <b>Heavy attack</b> every ${BATTLE.heavyEvery}rd turn: ×${BATTLE.heavyMultiplier} damage, can stun. Dodge it!`,
  ];
  if (m.boss) moves.push(`📯 <b>War cry</b>: sometimes roars to 🥀 weaken you`);
  if (m.tier >= BLEED.fromTier) moves.push(m.boss
    ? `🩸 <b>Bleed</b>: every attack adds a stack (heavy: ${BLEED.bossHeavyStacks}), even if you dodge or parry. Each stack costs ${ipPct(BLEED.perStack)} of your max HP per turn, up to ${BLEED.maxStacks} stacks`
    : `🩸 <b>Bleed</b>: ${ipPct(BLEED.normalChance)} chance per attack to add a stack, even if you dodge or parry. Each stack costs ${ipPct(BLEED.perStack)} of your max HP per turn, up to ${BLEED.maxStacks} stacks`);

  const fight = [
    ipRow("Your sword", `about <b>${fmt(yourHit)}</b> per hit <span class="ip-dim">(${Math.max(1, Math.ceil((live ? b.monsterHp : m.stats.hp) / yourHit))} hits)</span>`),
    ipRow("It hits you", `about <b>${fmt(itsHit)}</b> <span class="ip-dim">(you have ${fmt(live ? b.heroHp : hero.hp)} HP)</span>`),
    ipRow("Dodge chance", `you ${ipPct(dodgeChance(hero.agility, m.stats.agility))} · it ${ipPct(dodgeChance(m.stats.agility, hero.agility))}`),
  ];
  if (!m.boss) fight.push(ipRow("Catch chance", live
    ? `<b>${ipPct(catchChance(b))}</b> <span class="ip-dim">(higher as its HP drops)</span>`
    : `${ipPct(CATCH.base)} at full HP, up to ${ipPct(CATCH.base + CATCH.fromHpLost)}`));

  const next = m.boss ? TIERS[m.tier] : null;
  const reward = `${m.reward.drops} ${e.icon} ${e.drop}<br>${fmt(m.reward.coins)} 🪙 coins${next ? `<br>Opens ${next.icon} ${next.name}` : ""}`;

  return `
    <div class="ip-head mon-bg-${m.element}">
      <div class="ip-pic ip-mon">${monsterArtHTML(m)}</div>
      <div class="ip-title">
        <div class="ip-name">${m.name}</div>
        <div class="ip-tags">${m.boss ? `<span class="tag boss-tag">Boss</span>` : ""}<span class="tag">Lv ${m.tier}</span>${elementTag(m.element, true)}</div>
        <div class="ip-dim">${zone.icon} ${zone.name}</div>
      </div>
    </div>
    ${info.title ? `<div class="ip-desc"><b>${info.title}.</b> ${info.desc || ""}</div>` : ""}
    ${stats}
    <div class="ip-rows">${rows.join("")}</div>
    <div class="ip-sub">Moves</div>
    <div class="ip-note ip-list">${moves.join("<br>")}</div>
    <div class="ip-sub">Against you</div>
    <div class="ip-rows">${fight.join("")}</div>
    <div class="ip-sub">🎁 If you win</div>
    <div class="ip-note">${reward}</div>`;
}

// Works out the window's content from its key. Returns "" if the thing is gone.
function infoHTML(key, level) {
  const [kind, id] = key.split(":");
  if (kind === "skill") return skillById[id] ? skillInfoHTML(skillById[id], Number(level) || 0) : "";
  if (kind === "mon") {
    const sp = state.spawns.find(s => String(s.uid) === id);
    return sp ? monsterInfoHTML(spawnMonster(sp), false) : "";
  }
  if (kind === "boss") return TIERS[Number(id) - 1] ? monsterInfoHTML(bossMonster(Number(id)), false) : "";
  if (kind === "best") return bestiaryInfoHTML(id);
  if (kind === "foe") return state.battle ? monsterInfoHTML(state.battle.monster, !!ipBattle()) : "";
  return "";
}

// ---------- Showing and hiding ----------

function infoPopEl() {
  if (!infoPop.el) {
    infoPop.el = document.createElement("div");
    infoPop.el.id = "info-pop";
    infoPop.el.className = "info-pop";
    infoPop.el.setAttribute("role", "dialog");
    infoPop.el.hidden = true;
    infoPop.el.addEventListener("pointerenter", () => clearTimeout(infoPop.leaveTimer));
    infoPop.el.addEventListener("pointerleave", ev => { if (ev.pointerType === "mouse" && !infoPop.pinned) scheduleInfoClose(); });
    // Remember when a finger is on the window and when it last scrolled (see refreshInfoPop).
    infoPop.el.addEventListener("touchstart", () => { infoPop.touching = true; }, { passive: true });
    const lift = () => { infoPop.touching = false; infoPop.scrolledAt = performance.now(); };
    infoPop.el.addEventListener("touchend", lift, { passive: true });
    infoPop.el.addEventListener("touchcancel", lift, { passive: true });
    infoPop.el.addEventListener("scroll", () => { infoPop.scrolledAt = performance.now(); }, { passive: true });
    document.body.appendChild(infoPop.el);
  }
  return infoPop.el;
}

function openInfoPop(anchor, pinned) {
  const key = anchor.dataset.info;
  const html = infoHTML(key, anchor.dataset.infoLevel);
  if (!html) return;
  const pop = infoPopEl();
  infoPop.key = key;
  infoPop.level = anchor.dataset.infoLevel;
  infoPop.anchor = anchor;
  infoPop.pinned = pinned;
  infoPop.html = html;
  pop.innerHTML = emo(`<button class="ip-close" type="button" aria-label="Close">✕</button><div class="ip-body">${html}</div>`);
  pop.querySelector(".ip-close").onclick = closeInfoPop;
  pop.hidden = false;
  pop.scrollTop = 0;
  infoPop.touching = false;
  placeInfoPop();
}

function closeInfoPop() {
  clearTimeout(infoPop.hoverTimer);
  clearTimeout(infoPop.leaveTimer);
  if (!infoPop.el || infoPop.el.hidden) return;
  infoPop.el.hidden = true;
  infoPop.key = null;
  infoPop.anchor = null;
}

function scheduleInfoClose() {
  clearTimeout(infoPop.leaveTimer);
  infoPop.leaveTimer = setTimeout(closeInfoPop, 180);
}

// Next to the picture: below it if there's room, otherwise above, always inside the screen.
// The game redraws about 10 times a second and calls this each time, so it must not
// disturb the window: it measures without changing anything, and only writes a size or
// position when it really changed (rewriting them used to snap a scrolled window back to the top).
function placeInfoPop() {
  const pop = infoPop.el;
  const a = infoPop.anchor;
  if (!pop || pop.hidden || !a) return;
  const vw = document.documentElement.clientWidth, vh = window.innerHeight;
  const r = a.getBoundingClientRect();
  const w = pop.offsetWidth;
  const gap = 8, edge = 8;
  const below = vh - r.bottom - gap - edge, above = r.top - gap - edge;
  const full = pop.scrollHeight + (pop.offsetHeight - pop.clientHeight); // height with nothing cut off
  let h = full, top, maxH = "";
  if (h <= below) top = r.bottom + gap;
  else if (h <= above) top = r.top - gap - h;
  else {
    // Not enough room either side: use the bigger side, or the whole screen height.
    const room = Math.max(below, above);
    if (room >= 220) {
      h = Math.min(full, room);
      maxH = `${Math.floor(room)}px`;
      top = below >= above ? r.bottom + gap : r.top - gap - h;
    } else {
      h = Math.min(full, vh - 2 * edge);
      maxH = `${Math.floor(vh - 2 * edge)}px`;
      top = Math.max(edge, (vh - h) / 2);
    }
  }
  let left = r.left + r.width / 2 - w / 2;
  left = Math.max(edge, Math.min(vw - w - edge, left));
  const L = `${Math.round(left)}px`, T = `${Math.round(top)}px`;
  if (pop.style.maxHeight !== maxH) pop.style.maxHeight = maxH;
  if (pop.style.left !== L) pop.style.left = L;
  if (pop.style.top !== T) pop.style.top = T;
}

// The game redraws parts of the screen often. Keep the window's numbers fresh and
// follow its picture if that was redrawn.
function refreshInfoPop() {
  if (!infoPop.el || infoPop.el.hidden || !infoPop.key) return;
  if (!infoPop.anchor || !infoPop.anchor.isConnected) {
    const sel = `[data-info="${infoPop.key}"]`;
    const again = [...document.querySelectorAll(sel)].find(n => n.offsetParent !== null);
    if (!again) { closeInfoPop(); return; }
    infoPop.anchor = again;
  }
  const html = infoHTML(infoPop.key, infoPop.level);
  if (!html) { closeInfoPop(); return; }
  // New numbers wait while a finger is on the window or it is still gliding, so scrolling stays smooth.
  const busy = infoPop.touching || performance.now() - (infoPop.scrolledAt || 0) < 400;
  if (html !== infoPop.html && !busy) {
    infoPop.html = html;
    const body = infoPop.el.querySelector(".ip-body");
    const scroll = infoPop.el.scrollTop;
    body.innerHTML = emo(html);
    if (infoPop.el.scrollTop !== scroll) infoPop.el.scrollTop = scroll;
  }
  placeInfoPop();
}

// ---------- Taps, clicks, hover and long-press ----------

function infoTarget(node) { return node && node.closest ? node.closest("[data-info]") : null; }

// A tap or click on a picture. Buttons inside a card (Buy, Fight...) keep doing their own thing.
document.addEventListener("click", ev => {
  if (infoPop.eatClick) {
    // The click that ends a long-press only opens the window; it must not cast the skill too.
    infoPop.eatClick = false;
    ev.preventDefault();
    ev.stopPropagation();
    return;
  }
  const t = infoTarget(ev.target);
  if (!t) return;
  const btn = ev.target.closest("button");
  if (btn && btn !== t && t.contains(btn)) return;
  if (t.dataset.infoPress !== undefined && btn === t) return; // battle skill button: a tap casts
  ev.preventDefault();
  ev.stopPropagation();
  // Same picture again: a pinned window closes, a hover window stays open (pinned).
  if (infoPop.key === t.dataset.info && infoPop.el && !infoPop.el.hidden) {
    if (infoPop.pinned) closeInfoPop(); else infoPop.pinned = true;
  } else {
    openInfoPop(t, true);
  }
}, true);

// Tap or click anywhere else closes it.
document.addEventListener("pointerdown", ev => {
  if (!infoPop.el || infoPop.el.hidden) return;
  if (infoPop.el.contains(ev.target)) return;
  const t = infoTarget(ev.target);
  if (t && t.dataset.info === infoPop.key) return;
  closeInfoPop();
}, true);

// Computer: hover a picture for a moment to see its window.
document.addEventListener("pointerover", ev => {
  if (ev.pointerType !== "mouse") return;
  const t = infoTarget(ev.target);
  if (!t) return;
  clearTimeout(infoPop.leaveTimer);
  if (infoPop.key === t.dataset.info && !infoPop.el.hidden) return;
  if (infoPop.pinned && infoPop.el && !infoPop.el.hidden) return;
  clearTimeout(infoPop.hoverTimer);
  infoPop.hoverTimer = setTimeout(() => { if (t.isConnected) openInfoPop(t, false); }, 350);
});
document.addEventListener("pointerout", ev => {
  if (ev.pointerType !== "mouse") return;
  const t = infoTarget(ev.target);
  if (!t || (ev.relatedTarget && t.contains(ev.relatedTarget))) return;
  clearTimeout(infoPop.hoverTimer);
  if (infoPop.el && !infoPop.el.hidden && !infoPop.pinned && !(ev.relatedTarget && infoPop.el.contains(ev.relatedTarget))) scheduleInfoClose();
});

// Phone: press and hold a battle skill button to see its window instead of casting it.
document.addEventListener("pointerdown", ev => {
  if (ev.pointerType === "mouse") return;
  const t = ev.target.closest && ev.target.closest("[data-info-press]");
  if (!t) return;
  const anchor = infoTarget(t);
  infoPop.press = { x: ev.clientX, y: ev.clientY, timer: setTimeout(() => {
    infoPop.press = null;
    infoPop.eatClick = true;
    setTimeout(() => { infoPop.eatClick = false; }, 800);
    if (anchor && anchor.isConnected) openInfoPop(anchor, true);
  }, 450) };
});
function cancelPress() { if (infoPop.press) { clearTimeout(infoPop.press.timer); infoPop.press = null; } }
document.addEventListener("pointerup", cancelPress);
document.addEventListener("pointercancel", cancelPress);
document.addEventListener("pointermove", ev => {
  if (infoPop.press && Math.hypot(ev.clientX - infoPop.press.x, ev.clientY - infoPop.press.y) > 10) cancelPress();
});
// No phone copy/share menu on a long press over a skill button.
document.addEventListener("contextmenu", ev => { if (ev.target.closest && ev.target.closest("[data-info-press]")) ev.preventDefault(); });

document.addEventListener("keydown", ev => { if (ev.key === "Escape") closeInfoPop(); });
window.addEventListener("resize", () => placeInfoPop());
// Scrolling the page moves the picture away: close the window (but not when scrolling inside it).
document.addEventListener("scroll", ev => {
  if (infoPop.el && !infoPop.el.hidden && !infoPop.el.contains(ev.target)) {
    if (infoPop.pinned) placeInfoPop(); else closeInfoPop();
  }
}, true);
