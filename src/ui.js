/**
 * @file ui.js : interface (DOM). Charge les taux, l'état (IndexedDB), puis branche les écrans.
 * Toutes les données de l'utilisateur sont échappées (esc) ou posées via textContent/value.
 */
import {
  ROLES,
  JOURS,
  n,
  r2,
  calcShift,
  mondayOf,
  byWeek,
  byMonth,
  byRole,
  byDay,
  budget,
  addDays,
  semaineJours,
  grilleMois,
  sommeJours,
  dernier,
  heuresHabituelles,
  defautsRapides,
  repeterDernier,
  ajouter,
  modifier,
  supprimer,
  annuler,
  dernierEmploi,
  expressQuart,
  progression,
  parEmploi,
} from './calc.js';
import {
  TAUX2026,
  retenuesAnnuelles,
  impotQuart,
  sommeImpot,
  revenuAnnuelEstime,
  parJour,
  insights,
  sommaireAnnuel,
  toCSV,
  tauxDepuisConfig,
  setTaux,
  getTaux,
} from './taxes.js';
import {
  SCHEMA,
  creerMagasin,
  exporterSauvegarde,
  importerSauvegarde,
  rappelSauvegarde,
  fusionner,
  nipValide,
} from './storage.js';
import { nouveauSel, hacherNip, verifierNip } from './security.js';
import { t as tr, appliquerLangue } from './i18n.js';

try {
  const r = await fetch('taux-2026.json');
  if (r.ok) setTaux(tauxDepuisConfig(await r.json()));
} catch (e) {
  setTaux(TAUX2026);
}

const $ = (id) => document.getElementById(id),
  $$ = (s) => document.querySelectorAll(s);
const money = (v) =>
  (v < 0 ? '−' : '') +
  Math.abs(v).toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
  ' $';
const kd = (v) => {
  v = Math.round(v);
  const a = Math.abs(v);
  return (
    (v < 0 ? '−' : '') +
    (a >= 1000 ? Math.floor(a / 1000) + '\u202f' + String(a % 1000).padStart(3, '0') : String(a)) +
    '\u00a0$'
  );
};
const DEF = {
  name: '',
  role: 'serveur',
  mintip: 13.3,
  mingen: 16.6,
  goal: 30,
  cush: 3,
  cush0: 0,
  rev: '',
  decl: 100,
  r8: true,
  taux: '',
  onb: false,
  objSem: 900,
  objMois: 3600,
  jobs: [],
  job: '',
  pinH: '',
  pinS: '',
  rates: { serveur: 13.3, barman: 13.3, busboy: 13.3, hotesse: 16.6, maitre: 16.6 },
};
const store = creerMagasin();
let MODE_STOCK = '';
const E_DEF = [
  { lbl: 'Loyer', amt: 1150 },
  { lbl: 'Hydro, Internet, cellulaire', amt: 190 },
  { lbl: 'Épicerie', amt: 450 },
  { lbl: 'Transport', amt: 140 },
  { lbl: 'Assurances', amt: 45 },
  { lbl: 'Dettes', amt: 150 },
  { lbl: 'Sorties, loisirs', amt: 250 },
  { lbl: 'Abonnements', amt: 35 },
];
let P,
  S,
  E,
  LOG = [],
  MIG = [];
async function charger() {
  MODE_STOCK = await store.init();
  const st = await store.lire();
  P = Object.assign({}, DEF, st.P);
  S = st.S;
  E = st.E || E_DEF;
  LOG = st.log || [];
  MIG = st.notes || [];
  P.rates = Object.assign({}, DEF.rates, P.rates);
}
await charger();
P.rates = Object.assign({}, DEF.rates, P.rates);
let _sv = Promise.resolve();
const save = () => {
  const snap = { P, S, E, log: LOG };
  _sv = _sv.then(() => store.ecrire(snap)).catch((e) => journal('save', e));
  return _sv;
};
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const TX = () => {
  let o = {};
  try {
    o = P.taux ? JSON.parse(P.taux) : {};
  } catch (e) {
    /* ignoré : valeur par défaut */
  }
  return Object.assign({}, getTaux(), o);
};
const AN = () => (n(P.rev) > 0 ? n(P.rev) : revenuAnnuelEstime(S));
const IO = () => ({ declPct: P.decl, regle8: P.r8, T: TX() });
const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
function tbl(rows, cols) {
  return `<table><tr>${cols.map((c) => `<th>${c[0]}</th>`).join('')}</tr>${rows.map((r) => `<tr>${cols.map((c) => `<td class="${c[2] ? c[2](r) : ''}">${c[1](r)}</td>`).join('')}</tr>`).join('')}</table>`;
}
const low = (r) => (r.eff < n(P.goal) ? 'low' : '');
const jl = (d) => JOURS[new Date(d + 'T12:00:00').getDay()] + ' ' + +d.slice(8) + '/' + +d.slice(5, 7);
/* ---- Saisie ---- */
let edit = null,
  F = {};
function chips(el, items, cur, cb) {
  $(el).innerHTML = items
    .map(
      ([v, l]) =>
        `<button type="button" class="chip ${String(v) === String(cur) ? 'on' : ''}" data-v="${esc(v)}">${esc(l)}</button>`,
    )
    .join('');
  $(el)
    .querySelectorAll('button')
    .forEach((b) => (b.onclick = () => cb(b.dataset.v)));
}
function remplir(q) {
  F = Object.assign({}, q);
  $('f-date').value = q.date;
  $('f-rate').value = q.rate;
  $('f-hours').value = q.hours;
  $('f-card').value = q.card;
  $('f-cash').value = q.cash;
  $('f-sales').value = q.sales;
  $('f-todir').value = q.toDir || 'donne';
  $('f-tomode').value = q.toMode || 'pctVentes';
  $('f-toval').value = q.toVal ?? '';
  $('f-notes').value = q.notes || '';
  dessiner();
}
function lire() {
  return Object.assign({}, F, {
    job: F.job || '',
    date: $('f-date').value,
    rate: $('f-rate').value,
    hours: $('f-hours').value,
    card: $('f-card').value,
    cash: $('f-cash').value,
    sales: $('f-sales').value,
    toDir: $('f-todir').value,
    toMode: $('f-tomode').value,
    toVal: $('f-toval').value,
    notes: $('f-notes').value,
  });
}
function dessiner() {
  F = lire();
  const J = P.jobs || [];
  $('f-jobs').style.display = J.length ? 'flex' : 'none';
  if (J.length) {
    if (!F.job) F.job = J.includes(P.job) ? P.job : J[0];
    chips(
      'f-jobs',
      J.map((j) => [j, '🏠 ' + j]),
      F.job,
      (v) => {
        F = lire();
        F.job = v;
        const d = dernierEmploi(S, v);
        if (d && !edit) {
          F.role = d.role;
          F.rate = String(d.rate);
          $('f-rate').value = F.rate;
        }
        dessiner();
      },
    );
  }
  chips('f-roles', Object.entries(ROLES), F.role, (v) => {
    F = lire();
    F.role = v;
    if (!edit) {
      F.rate = String(P.rates[v]);
      $('f-rate').value = F.rate;
    }
    dessiner();
  });
  const usu = heuresHabituelles(S, F.role);
  const hs = [...new Set([usu, '4', '5', '6', '7', '8'].filter(Boolean))].slice(0, 6);
  chips(
    'h-chips',
    hs.map((h) => [h, h + ' h']),
    F.hours,
    (v) => {
      $('f-hours').value = v;
      dessiner();
    },
  );
  const cur = F.toMode === 'pctVentes' ? F.toVal || '0' : 'x';
  chips(
    'to-chips',
    [
      ['0', 'Aucun'],
      ['2', '2 %'],
      ['3', '3 %'],
      ['5', '5 %'],
    ],
    cur,
    (v) => {
      $('f-tomode').value = 'pctVentes';
      $('f-toval').value = v === '0' ? '' : v;
      $('f-todir').value = 'donne';
      dessiner();
    },
  );
  $('sales-wrap').style.display = (F.toMode === 'pctVentes' && n(F.toVal) > 0) || n(F.sales) > 0 ? 'block' : 'none';
  apercu();
}
function apercu() {
  const q = lire(),
    c = calcShift(q);
  if (!c.hours) {
    $('pv-b').textContent = '–';
    $('pv-n').textContent = '–';
    $('pv-d').textContent = 'Entre tes heures pour voir ton vrai taux.';
    return;
  }
  const i = impotQuart(q, AN(), IO());
  $('pv-b').textContent = money(c.eff) + '/h';
  $('pv-n').textContent = money(i.effNet) + '/h';
  $('pv-d').textContent =
    `Base ${money(c.base)} + pourboires nets ${money(c.netTips)} = ${money(c.total)} · net ${money(i.net)}${i.aMettreDeCote ? ` · cash à garder ${money(i.aMettreDeCote)}` : ''}`;
}
function ouvrir(id) {
  retour = document.activeElement;
  edit = id || null;
  const s = id && S.find((x) => x.id === id);
  $('sh-t').textContent = s ? 'Modifier le quart' : 'Nouveau quart';
  $('sh-del').style.display = s ? 'block' : 'none';
  $('sh-rep').style.display = s || !S.length ? 'none' : 'block';
  $('more').open = false;
  remplir(s ? Object.assign({}, s) : defautsRapides(S, P, today()));
  $('sheet').classList.add('on');
  $('sheet').removeAttribute('aria-hidden');
  setTimeout(() => {
    const f = $('sheet').querySelector('.chip.on') || $('f-hours');
    f && f.focus();
  }, 60);
}
let retour = null;
const fermer = () => {
  $('sheet').classList.remove('on');
  $('sheet').setAttribute('aria-hidden', 'true');
  if (retour && retour.focus) retour.focus();
};
['f-date', 'f-rate', 'f-hours', 'f-card', 'f-cash', 'f-sales', 'f-todir', 'f-tomode', 'f-toval'].forEach((i) =>
  $(i).addEventListener('input', dessiner),
);
$('h-m').onclick = () => {
  $('f-hours').value = Math.max(0, n($('f-hours').value) - 0.25);
  dessiner();
};
$('h-p').onclick = () => {
  $('f-hours').value = n($('f-hours').value) + 0.25;
  dessiner();
};
$('save').onclick = () => {
  const q = lire();
  if (!q.date || n(q.hours) <= 0) {
    alert('Entre la date et les heures.');
    return;
  }
  delete q._t;
  if (edit) {
    S = modifier(S, edit, q);
    toast(tr('Quart modifié'));
  } else {
    S = ajouter(S, q);
    P.role = q.role;
    P.job = q.job || '';
    buzz();
    toast('Quart ajouté : ' + money(calcShift(q).total));
  }
  save();
  fermer();
  render();
};
$('sh-rep').onclick = () => {
  const r = repeterDernier(S, $('f-date').value || today());
  if (r) remplir(r);
};
$('sh-del').onclick = () => {
  fermer();
  del(edit);
};
$('sh-x').onclick = fermer;
$('sheet').onclick = (e) => {
  if (e.target.id === 'sheet') fermer();
};
$('nav-plus').onclick = () => {
  buzz();
  ouvrir();
};
$('rep').onclick = () => {
  if (!S.length) {
    ouvrir();
    return;
  }
  ouvrir();
  remplir(repeterDernier(S, today()));
};
/* ---- Supprimer + annuler ---- */
let U = null,
  tt;
function toast(t, undo) {
  $('toast-t').textContent = t;
  $('toast-u').style.display = undo ? 'block' : 'none';
  $('toast').classList.add('on');
  clearTimeout(tt);
  tt = setTimeout(
    () => {
      $('toast').classList.remove('on');
      U = null;
    },
    undo ? 6000 : 2200,
  );
}
function del(id) {
  const r = supprimer(S, id);
  if (!r.undo) return;
  S = r.shifts;
  U = r.undo;
  save();
  render();
  toast('Quart supprimé', true);
}
$('toast-u').onclick = () => {
  if (U) {
    S = annuler(S, U);
    U = null;
    save();
    render();
    toast(tr('Suppression annulée'));
  }
};
function itemsHTML(list) {
  const R = retenuesAnnuelles(AN(), TX()),
    o = Object.assign({ ret: R }, IO());
  return (
    list
      .map((s) => {
        const q = impotQuart(s, AN(), o);
        return `<div class="it"><span class="del">Supprimer</span><div class="fg" data-id="${s.id}" role="button" tabindex="0"><span class="sr">Modifier : </span><div class="d">${jl(s.date)}</div><div class="m">${ROLES[s.role]}<br>${q.hours} h · ${money(q.effNet)}/h net</div><div class="t">${money(q.total)}<small class="vert">${money(q.net)} net</small></div></div></div>`;
      })
      .join('') ||
    '<div class="empty"><span class="e">🍽️</span><b>Aucun quart pour l\'instant</b><br>Touche ＋ en bas pour noter ton premier quart.</div>'
  );
}
function brancher(root) {
  root.querySelectorAll('.fg').forEach((el) => {
    let x0 = null,
      dx = 0,
      lp;
    el.addEventListener(
      'touchstart',
      (e) => {
        x0 = e.touches[0].clientX;
        dx = 0;
        lp = setTimeout(() => {
          x0 = null;
          if (confirm('Supprimer ce quart ?')) del(el.dataset.id);
        }, 650);
      },
      { passive: true },
    );
    el.addEventListener(
      'touchmove',
      (e) => {
        if (x0 == null) return;
        dx = e.touches[0].clientX - x0;
        if (Math.abs(dx) > 8) clearTimeout(lp);
        if (dx < 0) el.style.transform = `translateX(${dx}px)`;
      },
      { passive: true },
    );
    el.addEventListener('touchend', () => {
      clearTimeout(lp);
      if (x0 == null) return;
      if (dx < -90) {
        el.style.transform = 'translateX(-100%)';
        setTimeout(() => del(el.dataset.id), 150);
      } else {
        el.style.transform = '';
        if (Math.abs(dx) < 8) ouvrir(el.dataset.id);
      }
      x0 = null;
    });
    el.addEventListener('click', (e) => {
      if (!('ontouchstart' in window)) ouvrir(el.dataset.id);
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (confirm('Supprimer ce quart ?')) del(el.dataset.id);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') ouvrir(el.dataset.id);
      if (e.key === 'Delete') del(el.dataset.id);
    });
  });
}
/* ---- Accueil ---- */
const buzz = () => {
  try {
    navigator.vibrate && navigator.vibrate(12);
  } catch (e) {
    /* ignoré : valeur par défaut */
  }
};
function compte(el, val) {
  const t0 = performance.now(),
    from = el._v || 0;
  el._v = val;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / 500),
      e = 1 - Math.pow(1 - k, 3);
    el.textContent = kd(from + (val - from) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function anneau(id, frac, lbl) {
  $(id).style.strokeDashoffset = 194.8 * (1 - frac);
  $(lbl).textContent = Math.round(frac * 100) + ' %';
}
function renderInsights() {
  const A = AN(),
    o = IO(),
    I = insights(S, A, o, today());
  compte($('h-net'), I.semaine || 0);
  $('h-sub').innerHTML = !I.n
    ? 'Ajoute ton premier quart avec le bouton ＋'
    : I.tendance == null
      ? `Ce mois-ci : ${kd(I.mois)} net`
      : `${I.tendance >= 0 ? '▲' : '▼'} ${Math.abs(I.tendance).toFixed(0)} % vs même moment la semaine passée · mois ${kd(I.mois)}`;
  anneau('rg-s', progression(I.semaine, P.objSem), 'rg-st');
  anneau('rg-m', progression(I.mois, P.objMois), 'rg-mt');
  $('ins').innerHTML = !I.n
    ? '<div class="empty"><span class="e">📈</span>Tes meilleurs jours et quarts apparaîtront ici après quelques quarts.</div>'
    : `<div class="ins"><div><div class="e">🏆</div><div class="l">Meilleur jour</div><div class="v">${I.meilleurJour ? I.meilleurJour.jour + ' · ' + money(I.meilleurJour.eff) + '/h' : '–'}</div></div>
 <div><div class="e">⭐</div><div class="l">Meilleur quart</div><div class="v">${I.meilleurQuart ? money(I.meilleurQuart.eff) + '/h' : '–'}</div><div class="l">${I.meilleurQuart ? jl(I.meilleurQuart.date) + ' · ' + kd(I.meilleurQuart.total) : ''}</div></div>
 <div><div class="e">${I.tendance == null ? '➖' : I.tendance >= 0 ? '📈' : '📉'}</div><div class="l">Tendance semaine</div><div class="v ${I.tendance < 0 ? 'low' : 'vert'}">${I.tendance == null ? '–' : (I.tendance >= 0 ? '+' : '') + I.tendance.toFixed(0) + ' %'}</div><div class="l">vs semaine passée à ce jour</div></div>
 <div><div class="e">🎯</div><div class="l">Reste pour l'objectif semaine</div><div class="v">${kd(Math.max(0, n(P.objSem) - I.semaine))}</div></div></div>`;
  const J = P.jobs || [];
  $('x-jobs').style.display = J.length ? 'flex' : 'none';
  if (J.length) {
    if (!J.includes(P.job)) P.job = J[0];
    chips(
      'x-jobs',
      J.map((j) => [j, '🏠 ' + j]),
      P.job,
      (v) => {
        P.job = v;
        save();
        renderInsights();
      },
    );
  }
  const d = dernierEmploi(S, J.length ? P.job : '') || dernier(S);
  $('x-h').placeholder = heuresHabituelles(S, d && d.role) || '7';
  $('x-info').textContent = d
    ? `Repris : ${ROLES[d.role]} · ${n(d.rate).toFixed(2).replace('.', ',')} $/h · ${d.toMode === 'pctPourboires' && n(d.toVal) ? 'tip-out ' + d.toVal + ' % des pourboires' : 'tip-out comme la dernière fois'}`
    : 'Ton poste et ton taux viennent de tes réglages.';
}
$('x-save').onclick = () => {
  const t = n($('x-tot').value),
    h = n($('x-h').value) || n($('x-h').placeholder);
  if (h <= 0) {
    toast(tr('Entre tes heures'));
    return;
  }
  const q = expressQuart(S, P, today(), t, h, (P.jobs || []).length ? P.job : '');
  delete q._t;
  S = ajouter(S, q);
  save();
  buzz();
  $('x-tot').value = '';
  $('x-h').value = '';
  render();
  $('hero').classList.remove('pop');
  void $('hero').offsetWidth;
  $('hero').classList.add('pop');
  const c = impotQuart(q, AN(), IO());
  toast(`⚡ ${money(c.total)} · ${money(c.effNet)}/h net`);
};
function renderAccueil() {
  renderInsights();
  const wk = S.filter((s) => mondayOf(s.date) === mondayOf(today()));
  const t = sommeImpot(wk, AN(), IO());
  $('k-net').textContent = t.n ? kd(t.net) : '0 $';
  $('k-h').textContent = t.n ? money(t.effNet) : '–';
  $('k-brut').textContent = t.n ? kd(t.total) : '0 $';
  $('k-cash').textContent = kd(t.aMettreDeCote);
  $('recent').innerHTML = itemsHTML(S.slice().reverse().slice(0, 5));
  brancher($('recent'));
  $('rep').style.display = S.length ? 'block' : 'none';
}
/* ---- Grille ---- */
const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];
let G = { mode: 'sem', ref: null, sel: null };
function cellJ(d, PJ, cls) {
  const x = PJ[d],
    det = $('g-det').checked,
    day = +d.slice(8);
  return `<button class="gc ${x ? '' : 'vide'} ${cls || ''} ${d === today() ? 'auj' : ''} ${d === G.sel ? 'sel' : ''}" data-j="${d}"><b>${day}</b>${x ? `<span class="br">${kd(x.total)}</span><br><span class="nt">${kd(x.net)}</span>${det ? `<br>${x.hours}h<br>${kd(x.effNet)}/h` : ''}` : '–'}</button>`;
}
function renderGrille() {
  if (!G.ref) G.ref = today();
  const PJ = parJour(S, AN(), IO()),
    hd = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  let h = '',
    days;
  $('g-sem').classList.toggle('on', G.mode === 'sem');
  $('g-mois').classList.toggle('on', G.mode === 'mois');
  if (G.mode === 'sem') {
    days = semaineJours(G.ref);
    $('g-titre').textContent = 'Semaine du ' + +days[0].slice(8) + ' ' + MOIS[+days[0].slice(5, 7) - 1];
    h =
      '<div class="gw">' +
      hd.map((x) => `<div class="gh">${x}</div>`).join('') +
      days.map((d) => cellJ(d, PJ)).join('') +
      '</div>';
  } else {
    const ym = G.ref.slice(0, 7),
      W = grilleMois(ym);
    days = W.flat().filter((d) => d.slice(0, 7) === ym);
    $('g-titre').textContent = MOIS[+ym.slice(5) - 1] + ' ' + ym.slice(0, 4);
    h =
      '<div class="gm">' +
      hd.map((x) => `<div class="gh">${x}</div>`).join('') +
      '<div class="gh">Sem.</div>' +
      W.map((w) => {
        const t = sommeJours(
          w.filter((d) => d.slice(0, 7) === ym),
          PJ,
        );
        return (
          w.map((d) => cellJ(d, PJ, d.slice(0, 7) !== ym ? 'hors' : '')).join('') +
          `<div class="gc st"><b>Σ</b>${t.n ? `<span class="br">${kd(t.total)}</span><br><span class="nt">${kd(t.net)}</span>` : '–'}</div>`
        );
      }).join('') +
      '</div>';
  }
  $('grille').innerHTML = h;
  const t = sommeJours(days, PJ);
  $('g-tot').innerHTML =
    `<p style="margin:10px 0 0"><b>Total ${G.mode === 'sem' ? 'semaine' : 'mois'} :</b> brut <b>${money(t.total)}</b> · net estimé <b class="vert">${money(t.net)}</b><br><span class="note">${t.n} quart(s) · ${t.hours} h · ${money(t.effNet)}/h net · haut = brut, <span class="vert">bas = net</span></span></p>`;
  $('grille')
    .querySelectorAll('[data-j]')
    .forEach(
      (c) =>
        (c.onclick = () => {
          G.sel = c.dataset.j;
          renderGrille();
        }),
    );
  const x = G.sel && PJ[G.sel];
  $('g-jour').innerHTML = G.sel
    ? `<h2 style="margin-top:12px">${jl(G.sel)}</h2>` +
      (x
        ? `<div class="liste">${itemsHTML(x.shifts)}</div>`
        : `<p class="note">Aucun quart ce jour-là.</p><button class="mini" id="g-add">＋ Ajouter un quart ce jour-là</button>`)
    : '';
  if (x) brancher($('g-jour'));
  const ga = $('g-add');
  if (ga)
    ga.onclick = () => {
      ouvrir();
      $('f-date').value = G.sel;
      dessiner();
    };
}
function navG(k) {
  if (G.mode === 'sem') G.ref = addDays(G.ref, 7 * k);
  else {
    const d = new Date(G.ref.slice(0, 7) + '-15T12:00:00');
    d.setMonth(d.getMonth() + k);
    G.ref = d.toISOString().slice(0, 10);
  }
  G.sel = null;
  renderGrille();
}
$('g-sem').onclick = () => {
  G.mode = 'sem';
  renderGrille();
};
$('g-mois').onclick = () => {
  G.mode = 'mois';
  renderGrille();
};
$('g-prev').onclick = () => navG(-1);
$('g-next').onclick = () => navG(1);
$('g-auj').onclick = () => {
  G.ref = today();
  G.sel = today();
  renderGrille();
};
$('g-det').onchange = renderGrille;
/* ---- Quarts + stats ---- */
function chart(W) {
  const c = $('chart'),
    x = c.getContext('2d');
  x.clearRect(0, 0, c.width, c.height);
  if (!W.length) return;
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const max = Math.max(...W.map((w) => w.eff), n(P.goal)) * 1.15,
    bw = c.width / W.length,
    ink = dark ? '#E8EDF5' : '#0F1F3D';
  W.forEach((w, i) => {
    const h = (w.eff / max) * 140;
    x.fillStyle = dark ? '#34D399' : '#047857';
    x.fillRect(i * bw + 8, 150 - h, bw - 16, h);
    x.fillStyle = ink;
    x.font = '12px sans-serif';
    x.textAlign = 'center';
    x.fillText(w.key.slice(5), i * bw + bw / 2, 166);
    x.fillText(Math.round(w.eff) + '$', i * bw + bw / 2, 145 - h);
  });
  const gy = 150 - (n(P.goal) / max) * 140;
  x.strokeStyle = dark ? '#FBBF24' : '#B88A00';
  x.lineWidth = 3;
  x.setLineDash([8, 6]);
  x.beginPath();
  x.moveTo(0, gy);
  x.lineTo(c.width, gy);
  x.stroke();
  x.setLineDash([]);
  x.fillStyle = x.strokeStyle;
  x.textAlign = 'left';
  x.fillText('Objectif ' + P.goal + ' $/h', 4, gy - 4);
}
let LIM = 30;
function renderQuarts() {
  const PJb = parEmploi(S);
  $('byjob').innerHTML =
    (P.jobs || []).length || PJb.some((x) => x.key)
      ? tbl(PJb, [
          ['Emploi', (r) => esc(r.key) || tr('(sans emploi)')],
          ['Quarts', (r) => r.n],
          ['Total', (r) => kd(r.total)],
          ['$/h', (r) => money(r.eff), low],
        ])
      : '<div class="empty"><span class="e">🏠</span>Ajoute tes emplois dans Plus → Réglages pour comparer tes restos.</div>';
  const all = S.slice().reverse();
  $('list').innerHTML =
    itemsHTML(all.slice(0, LIM)) +
    (all.length > LIM
      ? `<button class="btn sec" id="more-l">${tr('Afficher plus')} (${all.length - LIM})</button>`
      : '');
  brancher($('list'));
  const ml = $('more-l');
  if (ml) {
    ml.onclick = () => {
      LIM += 30;
      renderQuarts();
    };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => {
        if (es[0].isIntersecting) {
          io.disconnect();
          LIM += 30;
          renderQuarts();
        }
      });
      io.observe(ml);
    }
  }
  const W = byWeek(S);
  const wc = [
    ['Période', (r) => r.key],
    ['Quarts', (r) => r.n],
    ['Heures', (r) => r.hours],
    ['Total', (r) => kd(r.total)],
    ['$/h', (r) => money(r.eff), low],
  ];
  $('wktable').innerHTML = tbl(W.slice(-8).reverse(), wc);
  $('mo').innerHTML = tbl(byMonth(S).reverse(), wc);
  chart(W.slice(-8));
  $('byrole').innerHTML = tbl(byRole(S), [
    ['Poste', (r) => ROLES[r.key]],
    ['Quarts', (r) => r.n],
    ['Moy./quart', (r) => kd(r.avgShift)],
    ['$/h', (r) => money(r.eff), low],
  ]);
  const D = byDay(S).sort((a, b) => ((+a.key + 6) % 7) - ((+b.key + 6) % 7));
  $('byday').innerHTML = tbl(D, [
    ['Jour', (r) => JOURS[+r.key]],
    ['Quarts', (r) => r.n],
    ['Moy./quart', (r) => kd(r.avgShift)],
    ['$/h', (r) => money(r.eff), low],
  ]);
}
/* ---- Impôts ---- */
function blocImp(t) {
  if (!t.n) return '<div class="empty"><span class="e">🧾</span>Rien à calculer pour l\'instant.</div>';
  return `<div class="kpi"><div><div class="l">Brut</div><div class="v">${money(t.effBrut)}<small>/h</small></div></div><div><div class="l">Net estimé</div><div class="v vert">${money(t.effNet)}<small>/h</small></div></div></div>
<table><tr><td>Revenu brut reçu</td><td>${money(t.total)}</td></tr><tr><td>Revenu imposable${t.attrib ? ` (dont ${money(t.attrib)} attribués, règle 8 %)` : ''}</td><td>${money(t.imposable)}</td></tr>
<tr><td>Impôt fédéral (après abattement 16,5 %)</td><td>${money(t.det.fed)}</td></tr><tr><td>Impôt du Québec</td><td>${money(t.det.qc)}</td></tr><tr><td>RRQ</td><td>${money(t.det.rrq)}</td></tr><tr><td>Assurance-emploi</td><td>${money(t.det.ae)}</td></tr><tr><td>RQAP</td><td>${money(t.det.rqap)}</td></tr>
<tr><th>Retenues estimées</th><th>${money(t.ded)}</th></tr><tr><th>Net estimé</th><th class="vert">${money(t.net)}</th></tr></table>
<p>💳 Salaire + pourboires carte : <b>${money(t.retenuSource)}</b> retenus à la source sur ta paie.<br>💵 Cash : <b class="or">${money(t.aMettreDeCote)}</b> à mettre de côté (l'impôt sur le cash déclaré sort de ta paie, mais l'argent est dans tes poches).</p>`;
}
let AN_SEL = null;
function renderAnnuel() {
  const ans = [...new Set(S.map((s) => s.date.slice(0, 4)).concat([today().slice(0, 4)]))].sort().reverse();
  if (!AN_SEL) AN_SEL = ans[0];
  chips(
    'an-chips',
    ans.map((a) => [a, a]),
    AN_SEL,
    (v) => {
      AN_SEL = v;
      renderAnnuel();
    },
  );
  const t = sommaireAnnuel(S, AN_SEL, AN(), IO());
  $('annuel').innerHTML = !t.n
    ? '<div class="empty"><span class="e">📄</span>Aucun quart en ' + AN_SEL + '.</div>'
    : tbl(
        [
          ["Revenus d'emploi imposables (case 14 T4 / case A RL-1, est.)", t.imposable],
          ['• Salaire de base', t.salaire],
          ['• Pourboires carte', t.pourbCarte],
          ['• Pourboires cash déclarés', t.pourbCashDecl],
          ['• Pourboires attribués (règle 8 %)', t.attrib],
          ['Pourboires déclarés (case L RL-1, est.)', t.pourboiresDeclares],
          ['Impôt fédéral retenu (est.)', t.fed],
          ['Impôt du Québec retenu (est.)', t.qc],
          ['RRQ', t.rrq],
          ['Assurance-emploi', t.ae],
          ['RQAP', t.rqap],
          ['Total des retenues', t.retenues],
          ['💵 Cash à avoir mis de côté', t.aMettre],
        ]
          .concat(t.cashNonDecl ? [['⚠️ Cash non déclaré (à déclarer)', t.cashNonDecl]] : [])
          .map(([a, b]) => ({ a, b })),
        [
          ['Case / élément', (r) => r.a],
          ['Montant', (r) => money(r.b)],
        ],
      ) +
      `<p class="note">${t.n} quarts · ${t.heures} h. Estimation pour te préparer : tes vrais montants sont sur le T4 et le relevé 1 de ton employeur. Pas un conseil fiscal.</p>`;
}
function renderImpot() {
  renderAnnuel();
  const A = AN(),
    R = retenuesAnnuelles(A, TX()),
    o = IO();
  $('imp-hyp').innerHTML =
    `Revenu annuel utilisé : <b>${money(A)}</b> ${n(P.rev) > 0 ? '(réglage)' : '(projeté à partir de tes quarts)'} · taux moyen de retenues ${(R.taux.total * 100).toFixed(1).replace('.', ',')} % · cash déclaré ${P.decl} %${P.r8 ? ' · règle 8 % active' : ''}`;
  const wk = S.filter((s) => mondayOf(s.date) === mondayOf(today())),
    mo = S.filter((s) => s.date.slice(0, 7) === today().slice(0, 7));
  $('imp-wk').innerHTML = blocImp(sommeImpot(wk, A, o));
  $('imp-mo').innerHTML = blocImp(sommeImpot(mo, A, o));
  $('imp-list').innerHTML = S.length
    ? tbl(
        S.slice(-10)
          .reverse()
          .map((s) => ({ s, q: impotQuart(s, A, Object.assign({ ret: R }, o)) })),
        [
          ['Date', (r) => r.s.date.slice(5)],
          ['Brut', (r) => kd(r.q.total)],
          ['Retenues', (r) => kd(r.q.ded)],
          ['Net', (r) => kd(r.q.net)],
          ['Cash à garder', (r) => kd(r.q.aMettreDeCote)],
        ],
      )
    : '<div class="empty"><span class="e">🧾</span>Rien à calculer pour l\'instant.</div>';
}
/* ---- Budget ---- */
function renderBudget() {
  $('exp').innerHTML = E.map(
    (e, i) =>
      `<div class="row" style="grid-template-columns:2fr 1fr auto;margin-bottom:6px"><input aria-label="Dépense" data-el="${i}" value="${esc(e.lbl)}"><input aria-label="Montant" type="number" inputmode="decimal" data-ea="${i}" value="${e.amt}"><button class="mini" aria-label="Retirer" data-ed="${i}">✕</button></div>`,
  ).join('');
  $$('[data-el]').forEach(
    (i) =>
      (i.onchange = () => {
        E[+i.dataset.el].lbl = i.value;
        save();
      }),
  );
  $$('[data-ea]').forEach(
    (i) =>
      (i.onchange = () => {
        E[+i.dataset.ea].amt = n(i.value);
        save();
        renderBudget();
      }),
  );
  $$('[data-ed]').forEach(
    (b) =>
      (b.onclick = () => {
        E.splice(+b.dataset.ed, 1);
        save();
        renderBudget();
      }),
  );
  const B = budget(byMonth(S), E, P.cush0, P.cush);
  $('exptot').textContent = money(B.dep);
  const pr = B.cible > 0 ? Math.min(1, B.cush / B.cible) : 0;
  $('bud').innerHTML =
    tbl(B.rows, [
      ['Mois', (r) => r.key],
      ['Revenu brut', (r) => money(r.total)],
      ['Coussin estimé', (r) => money(r.cush)],
    ]) +
    `<p>Moyenne 3 derniers mois : <b>${money(B.ref)}</b><br>Salaire fixe suggéré : <b>${money(B.fixe)}</b> / mois<br>Marge (salaire fixe − dépenses) : <b class="${B.marge < 0 ? 'low' : 'vert'}">${money(B.marge)}</b><br>Coussin visé : ${money(B.cible)} · progression ${Math.round(pr * 100)} %</p>
 <p class="note">${B.marge < 0 ? 'Tes dépenses dépassent ton salaire fixe : revois tes dépenses ou tes heures.' : pr >= 1 ? 'Coussin atteint : le surplus peut aller vers tes autres objectifs.' : 'Continue : chaque mois au-dessus de ta moyenne nourrit ton coussin.'} Revenu brut avant impôts et retenues.</p>`;
}
$('addexp').onclick = () => {
  E.push({ lbl: 'Nouvelle dépense', amt: 0 });
  save();
  renderBudget();
};
/* ---- Réglages ---- */
function loadParam() {
  $('p-name').value = P.name;
  $('p-mintip').value = P.mintip;
  $('p-mingen').value = P.mingen;
  $('p-goal').value = P.goal;
  $('p-cush').value = P.cush;
  $('p-cush0').value = P.cush0;
  $('p-rev').value = P.rev;
  $('p-decl').value = P.decl;
  $('p-r8').checked = P.r8;
  $('p-taux').value = P.taux;
  $('p-os').value = P.objSem;
  $('p-om').value = P.objMois;
  $('p-jobs').value = (P.jobs || []).join('\n');
  $('p-roles').innerHTML = Object.entries(ROLES)
    .map(
      ([k, v]) =>
        `<div class="row" style="align-items:center;margin-bottom:6px"><span>${v}</span><input aria-label="Taux ${v}" type="number" step="0.01" inputmode="decimal" data-rr="${k}" value="${P.rates[k]}"></div>`,
    )
    .join('');
}
$('psave').onclick = () => {
  const ot = P.mintip,
    og = P.mingen;
  P.name = $('p-name').value;
  P.mintip = n($('p-mintip').value);
  P.mingen = n($('p-mingen').value);
  P.goal = n($('p-goal').value);
  P.cush = n($('p-cush').value);
  P.cush0 = n($('p-cush0').value);
  P.rev = $('p-rev').value;
  P.decl = n($('p-decl').value);
  P.r8 = $('p-r8').checked;
  P.taux = $('p-taux').value.trim();
  P.objSem = n($('p-os').value);
  P.objMois = n($('p-om').value);
  P.jobs = [
    ...new Set(
      $('p-jobs')
        .value.split('\n')
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  ];
  if (P.taux) {
    try {
      JSON.parse(P.taux);
    } catch (e) {
      alert('JSON des taux invalide : ignoré.');
      P.taux = '';
    }
  }
  $$('[data-rr]').forEach((i) => {
    let v = n(i.value);
    if (v === ot) v = P.mintip;
    else if (v === og) v = P.mingen;
    P.rates[i.dataset.rr] = v;
  });
  save();
  loadParam();
  render();
  toast(tr('Réglages enregistrés'));
};
$('csv').onclick = () => {
  const b = new Blob(['\ufeff' + toCSV(S, AN(), IO())], { type: 'text/csv' }),
    a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = 'mes-quarts-' + today() + '.csv';
  a.click();
};
$('wipe').onclick = () => {
  if (confirm('Tout effacer ? Exporte en CSV avant.')) {
    S = [];
    save();
    render();
  }
};
$('demo').onclick = () => {
  const t = new Date();
  let ex = S;
  for (let i = 34; i >= 0; i--) {
    const d = new Date(t);
    d.setDate(d.getDate() - i);
    const w = d.getDay();
    if ([0, 1, 2].includes(w) && i % 3) continue;
    const role = w === 4 ? 'barman' : 'serveur';
    const sales = 900 + ((i * 137) % 700);
    ex = ajouter(
      ex,
      {
        date: d.toISOString().slice(0, 10),
        role,
        hours: String(w === 0 ? 6 : 7),
        rate: '13.3',
        card: String(r2(sales * 0.13)),
        cash: String(20 + ((i * 7) % 30)),
        sales: String(sales),
        toDir: 'donne',
        toMode: 'pctVentes',
        toVal: '3',
        notes: 'EXEMPLE',
      },
      Date.now() - i * 1000,
    );
  }
  S = ex;
  save();
  render();
  toast(tr('Exemples chargés'));
};
/* ---- Sauvegarde, NIP ---- */
$('bk').onclick = () => {
  setTimeout(verifierRappel, 50);
  const t = exporterSauvegarde({ P: Object.assign({}, P, { pinH: '', pinS: '' }), S, E });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([t], { type: 'application/json' }));
  a.download = 'vrai-taux-sauvegarde-' + today() + '.json';
  a.click();
  P.lastBk = today();
  save();
  $('bk-info').textContent = 'Dernière sauvegarde : ' + P.lastBk;
  buzz();
  toast(tr('Sauvegarde créée'));
};
$('rs').onclick = () => $('rs-f').click();
$('rs-f').onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const r = importerSauvegarde(await f.text());
    const remp = confirm(`${r.S.length} quarts trouvés. OK = remplacer mes données ; Annuler = fusionner.`);
    S = remp ? r.S : fusionner(S, r.S);
    if (remp && r.E) E = r.E;
    if (remp) {
      const keep = { pinH: P.pinH, pinS: P.pinS };
      P = Object.assign({}, DEF, r.P, keep);
      P.rates = Object.assign({}, DEF.rates, P.rates);
    }
    save();
    loadParam();
    render();
    toast('Restauration réussie : ' + S.length + ' quarts');
  } catch (err) {
    alert(err.message);
  }
  e.target.value = '';
};
$('p-pinb').onclick = async () => {
  const v = $('p-pin').value;
  if (!nipValide(v)) {
    alert(tr('NIP : 4 à 6 chiffres.'));
    return;
  }
  P.pinS = nouveauSel();
  P.pinH = await hacherNip(v, P.pinS);
  P.pinAlgo = 'pbkdf2-sha256-150k';
  $('p-pin').value = '';
  await save();
  toast(tr('🔒 NIP activé'));
};
$('p-pinoff').onclick = () => {
  P.pinH = '';
  P.pinS = '';
  P.pinAlgo = '';
  save();
  toast(tr('NIP retiré'));
};
let essais = 0,
  bloqueJusqua = 0;
function verrou() {
  if (!P.pinH) return;
  $('lock').classList.add('on');
  document.body.setAttribute('aria-hidden', 'false');
  setTimeout(() => $('lk').focus(), 100);
}
$('lk').addEventListener('input', async () => {
  const v = $('lk').value;
  if (Date.now() < bloqueJusqua) {
    $('lk').value = '';
    $('lk-e').textContent = tr('Trop d’essais : attends 30 secondes.');
    return;
  }
  if (v.length < 4) return;
  if (await verifierNip(v, P)) {
    $('lock').classList.remove('on');
    $('lk').value = '';
    $('lk-e').textContent = '';
    essais = 0;
  } else if (v.length >= 6) {
    essais++;
    if (essais >= 5) {
      bloqueJusqua = Date.now() + 30000;
      essais = 0;
    }
    $('lk-e').textContent = tr('NIP incorrect');
    $('lk').value = '';
    try {
      navigator.vibrate && navigator.vibrate([30, 40, 30]);
    } catch (e) {
      /* */
    }
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) verrou();
});
/* ---- Journal d'erreurs, hors ligne, rappel de sauvegarde, langue ---- */
function journal(src, e) {
  LOG.push({
    t: new Date().toISOString(),
    src,
    msg: String((e && e.message) || e).slice(0, 300),
    stack: String((e && e.stack) || '').slice(0, 800),
  });
  LOG = LOG.slice(-100);
  try {
    store.ecrire({ P, S, E, log: LOG });
  } catch (x) {
    /* */
  }
  renderLog();
}
window.addEventListener('error', (ev) => journal('error', ev.error || ev.message));
window.addEventListener('unhandledrejection', (ev) => journal('promise', ev.reason));
function renderLog() {
  const el = $('log');
  if (!el) return;
  el.textContent = LOG.length
    ? LOG.slice()
        .reverse()
        .map((l) => `${l.t} [${l.src}] ${l.msg}`)
        .join('\n')
    : tr('Aucune erreur enregistrée.');
}
$('log-x').onclick = () => {
  const txt = JSON.stringify(
    { app: 'vrai-taux-horaire', schema: SCHEMA, ua: navigator.userAgent, stock: MODE_STOCK, log: LOG },
    null,
    1,
  );
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
  a.download = 'journal-erreurs-' + today() + '.json';
  a.click();
};
$('log-c').onclick = () => {
  LOG = [];
  save();
  renderLog();
};
const enLigne = () => {
  $('off').classList.toggle('on', !navigator.onLine);
};
window.addEventListener('online', enLigne);
window.addEventListener('offline', enLigne);
enLigne();
function verifierRappel() {
  $('rappel').classList.toggle('on', rappelSauvegarde(P.lastBk, S.length, today()));
}
$('rappel-b').onclick = () => {
  $('bk').click();
  verifierRappel();
};
$('lang').onclick = () => {
  P.lang = P.lang === 'en' ? 'fr' : 'en';
  save();
  appliquerLangue(P.lang);
  render();
  loadParam();
};
document.addEventListener('keydown', (e) => {
  const sh = [...document.querySelectorAll('.sheet.on')].pop();
  if (!sh) return;
  if (e.key === 'Escape') {
    if (sh.id === 'sheet') fermer();
    else {
      $('onb-s').click();
    }
    return;
  }
  if (e.key === 'Tab') {
    const f = [...sh.querySelectorAll("button,input,select,textarea,summary,[tabindex='0']")].filter(
      (x) => x.offsetParent,
    );
    if (!f.length) return;
    const a = f[0],
      z = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) {
      e.preventDefault();
      z.focus();
    } else if (!e.shiftKey && document.activeElement === z) {
      e.preventDefault();
      a.focus();
    }
  }
});
/* ---- Accueil 3 étapes ---- */
let O = 0;
function onb() {
  const st = [
    [
      'Ton poste principal',
      () => `<p class="note">On s'en sert pour pré-remplir tes quarts.</p><div class="chips" id="o-r"></div>`,
    ],
    [
      'Ton taux horaire de base',
      () =>
        `<p class="note">Celui de ta paie, avant pourboires. Minimum 2026 : 13,30 $ au pourboire, 16,60 $ général.</p><input type="number" step="0.01" inputmode="decimal" id="o-t" value="${P.rates[P.role]}" aria-label="Taux de base">`,
    ],
    [
      'Ton objectif en $/heure',
      () =>
        `<p class="note">Salaire + pourboires nets. Les quarts sous l'objectif ressortent en rouge.</p><div class="chips" id="o-g"></div><input type="number" inputmode="decimal" id="o-gv" value="${P.goal}" aria-label="Objectif" style="margin-top:8px">`,
    ],
  ];
  $('onb')
    .querySelectorAll('.dots i')
    .forEach((d, i) => d.classList.toggle('on', i === O));
  $('onb-t').textContent = O + 1 + '/3 · ' + st[O][0];
  $('onb-b').innerHTML = st[O][1]();
  $('onb-n').textContent = O < 2 ? 'Suivant' : "C'est parti !";
  if (O === 0)
    chips('o-r', Object.entries(ROLES), P.role, (v) => {
      P.role = v;
      onb();
    });
  if (O === 2)
    chips(
      'o-g',
      [
        ['25', '25 $'],
        ['30', '30 $'],
        ['35', '35 $'],
        ['40', '40 $'],
      ],
      P.goal,
      (v) => {
        $('o-gv').value = v;
        P.goal = n(v);
        onb();
      },
    );
  $('onb').classList.add('on');
}
$('onb-n').onclick = () => {
  if (O === 1) P.rates[P.role] = n($('o-t').value) || P.rates[P.role];
  if (O === 2) P.goal = n($('o-gv').value) || P.goal;
  if (O < 2) {
    O++;
    onb();
  } else {
    P.onb = true;
    $('onb').classList.remove('on');
    save();
    loadParam();
    render();
  }
};
$('onb-s').onclick = () => {
  P.onb = true;
  save();
  $('onb').classList.remove('on');
};
$('reonb').onclick = () => {
  O = 0;
  onb();
};
/* ---- Nav ---- */
$$('nav button[data-s]').forEach(
  (b) =>
    (b.onclick = () => {
      $$('nav button[data-s]').forEach((x) => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-current', x === b ? 'page' : 'false');
      });
      $$('section').forEach((s) => s.classList.toggle('on', b.dataset.s.split(',').includes(s.id)));
      window.scrollTo(0, 0);
    }),
);
function render() {
  renderLog();
  renderAccueil();
  renderGrille();
  renderQuarts();
  renderImpot();
  renderBudget();
}
appliquerLangue(P.lang);
loadParam();
render();
verrou();
if (MIG.includes('pin-legacy'))
  toast(tr('Ton ancien NIP a été retiré : crée un nouveau NIP (plus sûr) dans Réglages.'));
verifierRappel();
if (P.lastBk) $('bk-info').textContent = 'Dernière sauvegarde : ' + P.lastBk;
if (!P.onb && !S.length && !P.pinH) onb();
window.__app = {
  get S() {
    return S;
  },
  ouvrir,
  del,
  get P() {
    return P;
  },
  get stock() {
    return MODE_STOCK;
  },
  get log() {
    return LOG;
  },
  flush: () => _sv,
};
/* ---- Mise à jour du service worker ---- */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker
    .register('sw.js')
    .then((reg) => {
      const prop = (w) => {
        if (!w) return;
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) banniereMAJ(w);
        });
      };
      if (reg.waiting && navigator.serviceWorker.controller) banniereMAJ(reg.waiting);
      reg.addEventListener('updatefound', () => prop(reg.installing));
    })
    .catch((e) => journal('sw', e));
  let premiere = !navigator.serviceWorker.controller,
    recharge = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (premiere) {
      premiere = false; // première installation : pas de rechargement
      return;
    }
    if (recharge) return;
    recharge = true;
    location.reload();
  });
}
function banniereMAJ(w) {
  $('maj').classList.add('on');
  $('maj-b').onclick = () => w.postMessage({ type: 'SKIP_WAITING' });
}
