/**
 * @typedef {Object} Shift
 * @property {string} id
 * @property {string} date AAAA-MM-JJ
 * @property {string} role
 * @property {string|number} hours
 * @property {string|number} rate
 * @property {string|number} [card]
 * @property {string|number} [cash]
 * @property {string|number} [sales]
 * @property {"donne"|"recu"} [toDir]
 * @property {"pctVentes"|"pctPourboires"|"montant"} [toMode]
 * @property {string|number} [toVal]
 * @property {string} [job]
 * @property {string} [notes]
 */
/**
 * @typedef {Object} ShiftCalc
 */

/**
 * @file calc.js : calculs purs des quarts, agrégats, grille et saisie.
 */

/**
 * Postes de salle offerts dans l'appli (clé → libellé).
 */
export const ROLES = {
  serveur: 'Serveur',
  barman: 'Barman',
  busboy: 'Busboy / commis',
  hotesse: 'Hôtesse',
  maitre: "Maître d'hôtel",
};

/**
 * Abréviations des jours, index 0 = dimanche (comme Date#getDay).
 */
export const JOURS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

/**
 * Convertit une valeur en nombre fini (0 si invalide).
 * @param {*} v
 * @returns {number}
 */
export const n = (v) => {
  v = parseFloat(v);
  return isFinite(v) ? v : 0;
};

/**
 * Arrondit au cent.
 * @param {number} v
 * @returns {number}
 */
export const r2 = (v) => Math.round(v * 100) / 100;

/**
 * Montant du tip-out d'un quart (négatif si remis, positif si reçu).
 * @param {Shift} s
 * @returns {number}
 */
export function tipOut(s) {
  const tips = n(s.card) + n(s.cash);
  let a = 0;
  if (s.toMode === 'pctVentes') a = (n(s.sales) * n(s.toVal)) / 100;
  else if (s.toMode === 'pctPourboires') a = (tips * n(s.toVal)) / 100;
  else a = n(s.toVal);
  return r2(s.toDir === 'recu' ? a : -a);
}

/**
 * Calculs de base d'un quart : salaire, pourboires bruts et nets, total, taux effectif.
 * @param {Shift} s
 * @returns {ShiftCalc}
 */
export function calcShift(s) {
  const h = n(s.hours),
    base = r2(h * n(s.rate)),
    gross = r2(n(s.card) + n(s.cash)),
    to = tipOut(s),
    net = r2(gross + to),
    total = r2(base + net);
  return {
    hours: h,
    base,
    gross,
    tipout: to,
    netTips: net,
    total,
    eff: h > 0 ? r2(total / h) : 0,
    tipPerHour: h > 0 ? r2(net / h) : 0,
    tipPct: n(s.sales) > 0 ? r2((gross / n(s.sales)) * 100) : null,
  };
}

/**
 * Lundi de la semaine d'une date ISO (AAAA-MM-JJ).
 * @param {string} d
 * @returns {string}
 */
export function mondayOf(d) {
  const x = new Date(d + 'T12:00:00');
  const k = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - k);
  return x.toISOString().slice(0, 10);
}

/**
 * Agrège des quarts par clé (semaine, mois, poste…).
 * @param {Shift[]} shifts
 * @param {(s:Shift)=>string} keyFn
 * @returns {Array<Object>}
 */
export function agg(shifts, keyFn) {
  const m = {};
  for (const s of shifts) {
    const k = keyFn(s),
      c = calcShift(s);
    const a = m[k] || (m[k] = { key: k, n: 0, hours: 0, base: 0, gross: 0, tipout: 0, netTips: 0, total: 0, sales: 0 });
    a.n++;
    a.hours += c.hours;
    a.base += c.base;
    a.gross += c.gross;
    a.tipout += c.tipout;
    a.netTips += c.netTips;
    a.total += c.total;
    a.sales += n(s.sales);
  }
  for (const a of Object.values(m)) {
    for (const f of ['hours', 'base', 'gross', 'tipout', 'netTips', 'total', 'sales']) a[f] = r2(a[f]);
    a.eff = a.hours > 0 ? r2(a.total / a.hours) : 0;
    a.avgShift = r2(a.total / a.n);
  }
  return Object.values(m).sort((a, b) => (a.key < b.key ? -1 : 1));
}

/**
 * Agrégats par semaine, mois, poste et jour de semaine.
 */
export const byWeek = (s) => agg(s, (x) => mondayOf(x.date)),
  byMonth = (s) => agg(s, (x) => x.date.slice(0, 7)),
  byRole = (s) => agg(s, (x) => x.role),
  byDay = (s) => agg(s, (x) => String(new Date(x.date + 'T12:00:00').getDay()));

/**
 * Méthode du « salaire fixe » : moyenne 3 mois, marge et coussin.
 * @returns {Object}
 */
export function budget(months, expenses, cush0, cushMonths) {
  const dep = r2(expenses.reduce((t, e) => t + n(e.amt), 0));
  const last = months.slice(-3);
  const ref = last.length ? last.reduce((t, m) => t + m.total, 0) / last.length : 0;
  const fixe = Math.floor(ref / 100) * 100;
  let c = n(cush0);
  const rows = months.map((m) => {
    c = r2(c + m.total - fixe);
    return { key: m.key, total: m.total, cush: c };
  });
  return {
    dep,
    ref: r2(ref),
    fixe,
    marge: r2(fixe - dep),
    cible: r2(dep * n(cushMonths)),
    rows,
    cush: rows.length ? c : n(cush0),
  };
}

/**
 * Ajoute k jours à une date ISO.
 * @param {string} d
 * @param {number} k
 * @returns {string}
 */
export function addDays(d, k) {
  const x = new Date(d + 'T12:00:00');
  x.setDate(x.getDate() + k);
  return x.toISOString().slice(0, 10);
}

/**
 * Les 7 dates (lun → dim) de la semaine de d.
 * @param {string} d
 * @returns {string[]}
 */
export function semaineJours(d) {
  const l = mondayOf(d);
  return [0, 1, 2, 3, 4, 5, 6].map((k) => addDays(l, k));
}

/**
 * Semaines (lun → dim) couvrant le mois AAAA-MM.
 * @param {string} ym
 * @returns {string[][]}
 */
export function grilleMois(ym) {
  const first = ym + '-01';
  let w = mondayOf(first);
  const weeks = [];
  while (w.slice(0, 7) <= ym) {
    weeks.push(semaineJours(w));
    w = addDays(w, 7);
  }
  return weeks;
}

/**
 * Somme brut/net/heures sur une liste de dates.
 * @returns {Object}
 */
export function sommeJours(days, PJ) {
  const t = { n: 0, hours: 0, total: 0, net: 0 };
  for (const d of days) {
    const x = PJ[d];
    if (!x) continue;
    t.n += x.n;
    t.hours += x.hours;
    t.total += x.total;
    t.net += x.net;
  }
  for (const k of ['hours', 'total', 'net']) t[k] = r2(t[k]);
  t.effNet = t.hours ? r2(t.net / t.hours) : 0;
  return t;
}

/**
 * Générateur d'identifiants uniques de quart.
 */
let _id = 0;
export const nid = () => Date.now().toString(36) + (_id++).toString(36) + Math.random().toString(36).slice(2, 6);

/**
 * Trie les quarts par date (copie).
 * @param {Shift[]} sh
 * @returns {Shift[]}
 */
export function trier(sh) {
  return sh.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Dernier quart saisi (horodatage _t), pas la dernière date.
 * @param {Shift[]} shifts
 * @returns {Shift|null}
 */
export function dernier(shifts) {
  return shifts.length
    ? shifts.reduce((a, s) => ((s._t || 0) >= (a._t || 0) ? s : a), shifts[shifts.length - 1])
    : null;
}

/**
 * Heures les plus fréquentes parmi les 10 derniers quarts du poste.
 * @returns {string}
 */
export function heuresHabituelles(shifts, role) {
  const h = shifts
    .filter((s) => !role || s.role === role)
    .slice(-10)
    .map((s) => n(s.hours))
    .filter((x) => x > 0);
  if (!h.length) return '';
  const c = {};
  h.forEach((x) => (c[x] = (c[x] || 0) + 1));
  return String(Object.entries(c).sort((a, b) => b[1] - a[1] || +b[0] - +a[0])[0][0]);
}

/**
 * Valeurs par défaut du formulaire rapide.
 * @returns {Shift}
 */
export function defautsRapides(shifts, P, auj) {
  const d = dernier(shifts);
  const role = d ? d.role : P.role || 'serveur';
  return {
    date: auj,
    role,
    hours: heuresHabituelles(shifts, role),
    rate: String(d && d.role === role ? n(d.rate) : (P.rates && P.rates[role]) || 13.3),
    card: '',
    cash: '',
    sales: '',
    toDir: d ? d.toDir || 'donne' : 'donne',
    toMode: d ? d.toMode || 'pctVentes' : 'pctVentes',
    toVal: d ? String(d.toVal ?? '') : '',
    notes: '',
  };
}

/**
 * Copie du dernier quart à la date donnée, pourboires vidés.
 * @returns {Shift|null}
 */
export function repeterDernier(shifts, auj) {
  const d = dernier(shifts);
  if (!d) return null;
  return Object.assign({}, d, { id: undefined, _t: undefined, date: auj, card: '', cash: '', sales: '', notes: '' });
}

/**
 * Ajoute un quart (id + horodatage) et retrie.
 * @returns {Shift[]}
 */
export function ajouter(shifts, q, t) {
  const s = Object.assign({}, q, { id: q.id || nid(), _t: t || Date.now() });
  return trier(shifts.concat([s]));
}

/**
 * Modifie un quart par id (immuable).
 * @returns {Shift[]}
 */
export function modifier(shifts, id, q) {
  return trier(shifts.map((s) => (s.id === id ? Object.assign({}, s, q, { id }) : s)));
}

/**
 * Supprime un quart et renvoie de quoi annuler.
 * @returns {{shifts:Shift[],undo:Object|null}}
 */
export function supprimer(shifts, id) {
  const i = shifts.findIndex((s) => s.id === id);
  if (i < 0) return { shifts, undo: null };
  return { shifts: shifts.filter((s) => s.id !== id), undo: { shift: shifts[i], index: i } };
}

/**
 * Annule une suppression.
 * @returns {Shift[]}
 */
export function annuler(shifts, undo) {
  if (!undo) return shifts;
  const a = shifts.slice();
  a.splice(Math.min(undo.index, a.length), 0, undo.shift);
  return trier(a);
}

/**
 * Dernier quart saisi pour un emploi donné.
 * @returns {Shift|null}
 */
export function dernierEmploi(shifts, job) {
  const f = job ? shifts.filter((s) => (s.job || '') === job) : shifts;
  return dernier(f);
}

/**
 * Construit un quart à partir du total des pourboires et des heures (entrée express).
 * @returns {Shift}
 */
export function expressQuart(shifts, P, auj, total, hours, job) {
  const d = dernierEmploi(shifts, job) || dernier(shifts);
  const base = defautsRapides(shifts, P, auj);
  const r = d && n(d.card) + n(d.cash) > 0 ? n(d.card) / (n(d.card) + n(d.cash)) : 1;
  const t = n(total);
  const card = r2(t * r);
  const q = Object.assign({}, base, {
    job: job || (d && d.job) || '',
    hours: String(n(hours) || n(base.hours)),
    card: String(card),
    cash: String(r2(t - card)),
    sales: '',
    express: true,
  });
  if (d) {
    q.role = d.role;
    q.rate = String(n(d.rate));
    q.toDir = d.toDir || 'donne';
  }
  if (q.toMode === 'pctVentes') {
    q.toMode = 'pctPourboires';
    q.toVal = d && d.toMode === 'pctPourboires' ? String(n(d.toVal)) : '0';
  }
  return q;
}

/**
 * Fraction (0 à 1) atteinte d'un objectif.
 * @returns {number}
 */
export function progression(val, obj) {
  obj = n(obj);
  return obj > 0 ? Math.max(0, Math.min(1, n(val) / obj)) : 0;
}

/**
 * Filtre les quarts d'un emploi.
 * @returns {Shift[]}
 */
export function filtreEmploi(shifts, job) {
  return job ? shifts.filter((s) => (s.job || '') === job) : shifts;
}

/**
 * Agrégats par emploi.
 * @returns {Array<Object>}
 */
export function parEmploi(shifts) {
  return agg(shifts, (s) => s.job || '');
}
