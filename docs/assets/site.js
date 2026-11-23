// Temps De Jeu — animations du site
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = window.matchMedia('(max-width: 760px)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const exercisesP = fetch('assets/exercices.json').then((r) => r.json());
let terrainModule = null;
const loadTerrain = () => (terrainModule ||= import('./terrain3d.js?v=17'));

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

const CATEGORIES = {
  conservation: ['Conservation', '#34c759'],
  construction: ['Construction', '#4c8dff'],
  attaque: ['Attaque', '#ff8c1a'],
  finition: ['Finition', '#ff5a5a'],
  pressing: ['Pressing', '#b57bff'],
  defense: ['Défense', '#4ec3f7'],
  transition: ['Transition', '#ffd91a'],
  cpa: ['Coup de pied arrêté', '#ff6fb8'],
};

// ------------------------------------------------------------------ Navigation
const nav = $('#nav');
const onScrollNav = () => nav.classList.toggle('is-scrolled', window.scrollY > 30);
onScrollNav();
window.addEventListener('scroll', onScrollNav, { passive: true });

// ------------------------------------------------------------------ Apparitions + compteurs
function countUp(el) {
  const to = Number(el.dataset.count);
  if (reduced || !Number.isFinite(to)) return;
  const t0 = performance.now();
  const dur = 900 + Math.min(900, to * 25);
  const tick = (now) => {
    const u = Math.min(1, (now - t0) / dur);
    el.textContent = Math.round(to * (1 - Math.pow(1 - u, 3)));
    if (u < 1) requestAnimationFrame(tick);
  };
  el.textContent = '0';
  requestAnimationFrame(tick);
}

const revealIO = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add('is-in');
    $$('[data-count]', e.target).forEach(countUp);
    if (e.target.matches('[data-count]')) countUp(e.target);
    revealIO.unobserve(e.target);
  }
}, { threshold: 0.18, rootMargin: '0px 0px -40px 0px' });
$$('.reveal').forEach((el) => revealIO.observe(el));

// Démarre/arrête un moteur 3D selon sa visibilité
function runWhenVisible(el, engine, margin = '0px') {
  let onScreen = false;
  const sync = () => (onScreen && !document.hidden ? engine.start() : engine.stop());
  new IntersectionObserver((entries) => { onScreen = entries[0].isIntersecting; sync(); }, { rootMargin: margin }).observe(el);
  document.addEventListener('visibilitychange', sync);
}

// ------------------------------------------------------------------ Accueil 3D
async function initHero() {
  const hero = $('#accueil');
  if (!hasWebGL()) { hero.classList.add('no-webgl'); return; }
  let engine;
  try {
    const { Terrain3D } = await loadTerrain();
    engine = new Terrain3D($('#hero-canvas'), { small, maxDpr: small ? 1.6 : 2 });
  } catch (err) {
    console.warn('3D indisponible', err);
    hero.classList.add('no-webgl');
    return;
  }
  const data = await exercisesP;
  const ex = data.tactiques.find((t) => t.id === 'biblio-contre-attaque-3c2') || data.tactiques[0];
  const box = $('#hero-cinema');
  const progress = $('#hero-progress');
  progress.innerHTML = ex.etapes.map(() => '<i></i>').join('');
  $('#hero-ex').textContent = ex.titre;

  engine.on('step', (i) => {
    box.classList.add('is-changing');
    setTimeout(() => {
      $('#hero-step').textContent = `${i + 1}/${ex.etapes.length}`;
      $('#hero-step-title').textContent = ex.etapes[i].titre;
      $('#hero-step-text').textContent = ex.etapes[i].texte;
      $$('i', progress).forEach((d, k) => { d.className = k < i ? 'done' : k === i ? 'on' : ''; });
      box.classList.remove('is-changing');
    }, 250);
  });
  engine.on('goal', () => {
    const f = $('#goal-flash');
    f.classList.remove('is-on');
    void f.offsetWidth;
    f.classList.add('is-on');
  });

  engine.setCamera('cinema');
  engine.holdFactor = 0.9;
  engine.load(ex);
  hero.classList.add('is-3d');

  if (reduced) {
    engine.goTo(3);
    engine.renderOnce();
    return;
  }

  const onScroll = () => { engine.scroll = Math.min(1, Math.max(0, window.scrollY / hero.offsetHeight)); };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pointermove', (e) => { engine.pointer = (e.clientX / window.innerWidth - 0.5) * 2; }, { passive: true });
  runWhenVisible(hero, engine);
}

// ------------------------------------------------------------------ Bibliothèque 3D
function initLibrary() {
  const section = $('#exercices');
  const viewer = $('#viewer');
  let started = false;
  const io = new IntersectionObserver(async (entries) => {
    if (!entries[0].isIntersecting || started) return;
    started = true;
    io.disconnect();
    const data = await exercisesP;
    buildList(data.tactiques);
    if (!hasWebGL()) { viewer.classList.add('no-webgl'); showInfo(data.tactiques[0]); return; }
    let engine;
    try {
      const { Terrain3D } = await loadTerrain();
      engine = new Terrain3D($('#lib-canvas'), { interactive: true, small, crowd: !small, maxDpr: small ? 1.6 : 2, barShift: 0.08 });
    } catch (err) {
      console.warn('3D indisponible', err);
      viewer.classList.add('no-webgl');
      showInfo(data.tactiques[0]);
      return;
    }
    wire(engine, data.tactiques);
    runWhenVisible($('.viewer-canvas'), engine, '100px');
  }, { rootMargin: '400px 0px' });
  io.observe(section);

  let current = null;
  function showInfo(ex) {
    current = ex;
    const [label, color] = CATEGORIES[ex.categorie] || [ex.categorie, '#34c759'];
    $('#lib-info').style.setProperty('--cat', color);
    $('#lib-cat').textContent = label;
    $('#lib-title').textContent = ex.titre;
    $('#lib-level').textContent = ex.niveau || '—';
    $('#lib-duration').textContent = ex.duree || '—';
    $('#lib-size').textContent = ex.effectif || '—';
    $('#lib-goal').textContent = ex.objectif || '';
    $('#lib-rules').innerHTML = '';
    for (const c of ex.consignes || []) {
      const li = document.createElement('li');
      li.textContent = c;
      $('#lib-rules').appendChild(li);
    }
    $('#lib-dots').innerHTML = ex.etapes.map(() => '<i></i>').join('');
    $$('.ex-chip').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === ex.id)));
  }

  function buildList(list) {
    const host = $('#lib-list');
    for (const ex of list) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ex-chip';
      b.role = 'tab';
      b.dataset.id = ex.id;
      b.textContent = ex.titre;
      b.style.setProperty('--cat', (CATEGORIES[ex.categorie] || [])[1] || '#34c759');
      b.setAttribute('aria-selected', 'false');
      host.appendChild(b);
    }
    showInfo(list[0]);
  }

  function wire(engine, list) {
    const play = $('#lib-play');
    const setPlaying = (on) => {
      if (on) engine.play(); else engine.pause();
      play.classList.toggle('is-paused', !on);
      play.setAttribute('aria-label', on ? 'Pause' : 'Lecture');
    };
    engine.on('step', (i) => {
      const st = current.etapes[i];
      $('#lib-step').textContent = `Étape ${i + 1}/${current.etapes.length}`;
      $('#lib-step-title').textContent = st.titre;
      $('#lib-step-text').textContent = st.texte;
      $$('#lib-dots i').forEach((d, k) => { d.className = k < i ? 'done' : k === i ? 'on' : ''; });
    });
    const select = (id) => {
      const ex = list.find((t) => t.id === id);
      if (!ex) return;
      showInfo(ex);
      engine.load(ex);
    };
    $('#lib-list').addEventListener('click', (e) => {
      const b = e.target.closest('.ex-chip');
      if (b) select(b.dataset.id);
    });
    $$('.cams button').forEach((b) => b.addEventListener('click', () => {
      engine.setCamera(b.dataset.cam);
      $$('.cams button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    }));
    play.addEventListener('click', () => setPlaying(!engine.playing));
    $('#lib-next').addEventListener('click', () => engine.next());
    $('#lib-prev').addEventListener('click', () => engine.prev());
    engine.holdFactor = 1.1;
    select(list[0].id);
    if (reduced) setPlaying(false);
  }
}

// ------------------------------------------------------------------ Atelier (démo SVG)
function initAtelier() {
  const root = $('#atelier-demo');
  let started = false;
  const io = new IntersectionObserver(async (entries) => {
    if (!entries[0].isIntersecting || started) return;
    started = true;
    io.disconnect();
    const { initAtelierDemo } = await import('./atelier-demo.js?v=17');
    initAtelierDemo(root, { reduced });
  }, { rootMargin: '300px 0px' });
  io.observe(root);
}

// ------------------------------------------------------------------ Équipes avec les présents
function initTeams() {
  const names = ['Adam', 'Lucas', 'Nolan', 'Inès', 'Hugo', 'Léo', 'Rayan', 'Jade', 'Tom', 'Sacha', 'Lina', 'Noé'];
  const pool = $('#teams-pool');
  const cols = { bleu: $('#team-bleu'), orange: $('#team-orange') };
  const chips = names.map((n) => {
    const c = document.createElement('span');
    c.className = 'pchip';
    c.innerHTML = `<i>${n[0]}</i>${n}`;
    pool.appendChild(c);
    return c;
  });

  function flip(mutate) {
    const first = new Map(chips.map((c) => [c, c.getBoundingClientRect()]));
    mutate();
    if (reduced) return;
    chips.forEach((c, k) => {
      const a = first.get(c);
      const b = c.getBoundingClientRect();
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (!dx && !dy) return;
      c.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
        duration: 700, delay: k * 35, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards',
      });
    });
  }

  function distribute() {
    const order = [...chips].sort(() => Math.random() - 0.5);
    flip(() => order.forEach((c, k) => cols[k % 2 ? 'orange' : 'bleu'].appendChild(c)));
  }

  let done = false;
  new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting || done) return;
    done = true;
    setTimeout(distribute, reduced ? 0 : 1100);
  }, { threshold: 0.5 }).observe($('#teams'));
  $('#teams-shuffle').addEventListener('click', distribute);
}

// ------------------------------------------------------------------ Match en direct
function initMatch() {
  const live = $('#live');
  const clockEl = $('#live-clock');
  const addedEl = $('#live-added');
  const effEl = $('#live-eff');
  const ring = $('#live-ring');
  const stopNow = $('#stop-now');
  const events = $('#live-events');
  const eqList = $('#equity');
  const eqDot = $('#eq-dot');

  const players = [
    { n: 9, name: 'Martin', min: 27.4 },
    { n: 10, name: 'Durand', min: 27.4 },
    { n: 7, name: 'Petit', min: 27.4 },
    { n: 5, name: 'Garnier', min: 27.4 },
    { n: 14, name: 'Roux', min: 0, bench: true },
  ];
  eqList.innerHTML = players.map((p) => `<li><span>n°${p.n} ${p.name}</span><div class="eq-bar"><i></i></div><b></b></li>`).join('');

  let state;
  const reset = () => {
    state = { t: 27 * 60 + 22, eff: 0.64 * (27 * 60 + 22), added: 90, stop: null, stopLeft: 0, home: 2, away: 1, script: 0, wait: 4 };
    players.forEach((p) => { p.min = p.bench ? 0 : 27.4; p.on = !p.bench; });
    players[2].on = true;
  };
  reset();

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const fmtAdd = (s) => `+${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  function render() {
    clockEl.textContent = fmt(state.t);
    clockEl.classList.toggle('is-stopped', !!state.stop);
    addedEl.textContent = fmtAdd(state.added);
    const pct = state.eff / state.t;
    effEl.textContent = `${Math.round(pct * 100)} %`;
    ring.style.strokeDashoffset = String(314.16 * (1 - pct));
    stopNow.textContent = state.stop ? `● ${state.stop} ${fmt(state.stopLeft).slice(1)}` : '';
    const max = Math.max(...players.map((p) => p.min));
    const min = Math.min(...players.map((p) => p.min));
    const gap = max - min;
    const color = gap > 20 ? '#ff3838' : gap > 10 ? '#ff8c1a' : '#34c759';
    eqDot.style.background = color;
    eqDot.style.color = color;
    $$('li', eqList).forEach((li, k) => {
      const p = players[k];
      const bar = $('i', li);
      bar.style.width = `${Math.min(100, (p.min / 45) * 100)}%`;
      bar.style.background = p.min < max - 20 ? '#ff3838' : p.min < max - 10 ? '#ff8c1a' : '#34c759';
      $('b', li).textContent = `${Math.floor(p.min)}′`;
    });
  }

  function hit(key, label, seconds) {
    const li = $(`#stop-list li[data-k="${key}"]`);
    const b = $('b', li);
    b.textContent = String(Number(b.textContent) + 1);
    li.classList.add('is-hit');
    setTimeout(() => li.classList.remove('is-hit'), seconds * 1000 + 400);
    state.stop = label;
    state.stopLeft = seconds;
  }
  function addEvent(html) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="ev-min">${Math.floor(state.t / 60) + 1}′</span>${html}`;
    events.prepend(li);
    while (events.children.length > 4) events.lastElementChild.remove();
  }
  function bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

  const script = [
    () => hit('touche', 'Touche', 3),
    () => hit('corner', 'Corner', 4),
    () => {
      state.home += 1;
      $('#score-home').textContent = state.home;
      bump($('#score-home'));
      addEvent('<span class="ev ev-goal"></span>But · n°10 Durand <em>passe du n°9</em>');
      hit('but', 'But / célébration', 3);
    },
    () => {
      hit('remplacement', 'Remplacement', 3);
      state.added += 30;
      players[2].on = false;
      players[4].on = true;
      addEvent('<span class="ev ev-sub"></span>n°14 Roux remplace n°7 Petit <em>+30 s</em>');
    },
    () => hit('coupfranc', 'Coup franc', 4),
    () => {
      addEvent('<span class="ev ev-yellow"></span>Carton jaune · n°4 adverse');
      hit('coupfranc', 'Coup franc', 3);
    },
    () => { hit('blessure', 'Blessure / soins', 6); state.added += 6; },
    () => hit('sixmetres', '6 mètres', 3),
  ];

  let visible = false;
  new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }, { threshold: 0.2 }).observe(live);
  render();
  if (reduced) return;

  setInterval(() => {
    if (!visible || document.hidden) return;
    state.t += 1;
    for (const p of players) if (p.on) p.min += 1 / 60;
    if (state.stop) {
      state.stopLeft -= 1;
      if (state.stopLeft <= 0) state.stop = null;
    } else {
      state.eff += 1;
      state.wait -= 1;
      if (state.wait <= 0) {
        if (state.script >= script.length) {
          reset();
          $('#score-home').textContent = state.home;
          $('#score-away').textContent = state.away;
          $$('#stop-list b').forEach((b, k) => { b.textContent = [9, 4, 3, 5, 2, 1, 3, 2, 0][k]; });
        } else {
          script[state.script]();
          state.script += 1;
          state.wait = 3 + Math.floor(Math.random() * 3);
        }
      }
    }
    render();
  }, 1000);
}

// ------------------------------------------------------------------ Cascade
function initCascade() {
  const stage = $('#cascade-stage');
  const cols = $$('.cas-col', stage);
  const links = $$('.cas-link', stage);
  const boxes = cols.map((c) => $('.cas-box', c));
  const keep = [11, 8, 6, 5];
  const total = 30;
  const dots = Array.from({ length: total }, () => {
    const d = document.createElement('i');
    d.className = 'dot';
    return d;
  });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function move(list, box) {
    const first = new Map(list.map((d) => [d, d.getBoundingClientRect()]));
    list.forEach((d) => box.appendChild(d));
    if (reduced) return;
    list.forEach((d, k) => {
      const a = first.get(d);
      const b = d.getBoundingClientRect();
      d.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: 'none' }], {
        duration: 800, delay: k * 25, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards',
      });
    });
  }

  function setActive(k) {
    cols.forEach((c, i) => {
      c.classList.toggle('is-active', i === k);
      $('.cas-state', c).textContent = i < k ? 'a choisi' : i === k ? (k === cols.length - 1 ? 'reçoit le reste' : 'sélectionne') : 'attend';
    });
  }

  let visible = false;
  let waiters = [];
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) { waiters.forEach((r) => r()); waiters = []; }
  }, { threshold: 0.3 }).observe(stage);
  const gate = () => (visible ? Promise.resolve() : new Promise((r) => waiters.push(r)));

  function finalState() {
    let rest = [...dots];
    boxes.forEach((box, k) => {
      const kept = rest.slice(0, keep[k]);
      rest = rest.slice(keep[k]);
      kept.forEach((d) => { d.classList.add('kept'); box.appendChild(d); });
    });
    setActive(-1);
    cols.forEach((c) => { $('.cas-state', c).textContent = 'a choisi'; });
  }

  if (reduced) { finalState(); return; }

  (async () => {
    for (;;) {
      dots.forEach((d) => { d.classList.remove('kept'); boxes[0].appendChild(d); });
      setActive(0);
      let available = [...dots];
      await gate();
      await sleep(1200);
      for (let k = 0; k < cols.length; k++) {
        await gate();
        setActive(k);
        const chosen = available.slice(0, keep[k]);
        for (const d of chosen) {
          d.classList.add('kept');
          await sleep(70);
        }
        available = available.slice(keep[k]);
        await sleep(700);
        if (k < cols.length - 1 && available.length) {
          const link = links[k];
          link.classList.remove('is-sending');
          void link.offsetWidth;
          link.classList.add('is-sending');
          await sleep(500);
          move(available, boxes[k + 1]);
          await sleep(1100);
        }
      }
      setActive(-1);
      cols.forEach((c) => { $('.cas-state', c).textContent = 'a choisi'; });
      await sleep(3200);
    }
  })();
}

// ------------------------------------------------------------------ Téléphones en éventail
function initPhones() {
  const phones = $('#phones');
  if (reduced) { phones.style.setProperty('--p', 1); return; }
  const update = () => {
    const r = phones.getBoundingClientRect();
    const vh = window.innerHeight;
    const p = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.9)));
    phones.style.setProperty('--p', p.toFixed(3));
  };
  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
}

// ------------------------------------------------------------------ Captures iPhone / iPad
function initShots() {
  const shots = $('#shots');
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => {
    const dev = b.dataset.dev;
    $$('.tabs button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    shots.dataset.dev = dev;
    $$('img', shots).forEach((img) => { img.src = img.dataset[dev]; });
  }));
}

initHero();
initLibrary();
initAtelier();
initTeams();
initMatch();
initCascade();
initPhones();
initShots();
