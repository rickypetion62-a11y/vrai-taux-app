/**
 * @file taxes.js : retenues 2026 du Québec, rapports et CSV.
 */
import { JOURS, ROLES, addDays, byDay, calcShift, mondayOf, n, r2 } from './calc.js';

/**
 * Export CSV (une ligne par quart, total et sommes par jour).
 * @returns {string}
 */
export function toCSV(shifts, A, o) {
  const h = [
    'date',
    'jour',
    'poste',
    'heures',
    'taux_base',
    'salaire_base',
    'ventes',
    'pourboires_carte',
    'pourboires_cash',
    'tip_out',
    'pourboires_nets',
    'revenu_total',
    'taux_effectif',
    'pct_pourboire',
    'notes',
  ].concat(A != null ? ['retenues_estimees', 'net_estime'] : []);
  const q = (v) => {
    v = v == null ? '' : String(v);
    return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  };
  return [h.join(',')]
    .concat(
      shifts.map((s) => {
        const c = calcShift(s);
        return [
          s.date,
          JOURS[new Date(s.date + 'T12:00:00').getDay()],
          ROLES[s.role] || s.role,
          c.hours,
          n(s.rate),
          c.base,
          n(s.sales),
          n(s.card),
          n(s.cash),
          c.tipout,
          c.netTips,
          c.total,
          c.eff,
          c.tipPct ?? '',
          s.notes || '',
        ]
          .concat(A != null ? [impotQuart(s, A, o).ded, impotQuart(s, A, o).net] : [])
          .map(q)
          .join(',');
      }),
    )
    .concat(csvSommes(shifts, A, o, q))
    .join('\n');
}

/**
 * Lignes de sommes ajoutées à la fin du CSV.
 * @returns {string[]}
 */
function csvSommes(shifts, A, o, q) {
  if (!shifts.length) return [];
  const t = { h: 0, b: 0, v: 0, ca: 0, cs: 0, to: 0, nt: 0, tot: 0, ded: 0, net: 0 };
  for (const s of shifts) {
    const c = calcShift(s);
    t.h += c.hours;
    t.b += c.base;
    t.v += n(s.sales);
    t.ca += n(s.card);
    t.cs += n(s.cash);
    t.to += c.tipout;
    t.nt += c.netTips;
    t.tot += c.total;
    if (A != null) {
      const i = impotQuart(s, A, o);
      t.ded += i.ded;
      t.net += i.net;
    }
  }
  const out = [
    '',
    'TOTAL,,,' +
      [
        r2(t.h),
        '',
        r2(t.b),
        r2(t.v),
        r2(t.ca),
        r2(t.cs),
        r2(t.to),
        r2(t.nt),
        r2(t.tot),
        t.h ? r2(t.tot / t.h) : '',
        '',
        '',
      ]
        .concat(A != null ? [r2(t.ded), r2(t.net)] : [])
        .join(','),
    '',
    'SOMMES PAR JOUR',
    'date,quarts,heures,brut,net_estime',
  ];
  const PJ = A != null ? parJour(shifts, A, o) : null;
  const dates = [...new Set(shifts.map((s) => s.date))].sort();
  for (const d of dates) {
    const ss = shifts.filter((s) => s.date === d);
    out.push(
      [
        d,
        ss.length,
        r2(ss.reduce((a, s) => a + calcShift(s).hours, 0)),
        r2(ss.reduce((a, s) => a + calcShift(s).total, 0)),
        PJ ? PJ[d].net : '',
      ].join(','),
    );
  }
  return out;
}

/**
 * Taux 2026 intégrés (repli si taux-2026.json est absent). Sources dans taux-2026.json.
 */
export const TAUX2026 = {
  fedBr: [
    [58523, 0.14],
    [117045, 0.205],
    [181440, 0.26],
    [258482, 0.29],
    [Infinity, 0.33],
  ],
  fedBPA: 16452,
  cea: 1501,
  abattement: 0.165,
  qcBr: [
    [54345, 0.14],
    [108680, 0.19],
    [132245, 0.24],
    [Infinity, 0.2575],
  ],
  qcBPA: 18952,
  qcTravMax: 1450,
  qcTravTaux: 0.06,
  rrqMGA: 74600,
  rrqExempt: 3500,
  rrqTaux: 0.063,
  rrqBase: 0.053,
  rrqMSGA: 85000,
  rrq2Taux: 0.04,
  aeMax: 68900,
  aeTaux: 0.013,
  rqapMax: 103000,
  rqapTaux: 0.0043,
};

/**
 * Impôt progressif selon des tranches [plafond, taux].
 * @returns {number}
 */
export function impotTranches(rev, br) {
  let t = 0,
    prev = 0;
  for (const [lim, r] of br) {
    if (rev <= prev) break;
    t += (Math.min(rev, lim) - prev) * r;
    prev = lim;
  }
  return t;
}

/**
 * Impôt fédéral de base après crédit personnel et abattement du Québec.
 * @returns {number}
 */
export function fedBrut(taxable, T = TAUX_ACTIF) {
  return Math.max(0, impotTranches(taxable, T.fedBr) - T.fedBr[0][1] * T.fedBPA) * (1 - T.abattement);
}

/**
 * Impôt du Québec de base après crédit personnel.
 * @returns {number}
 */
export function qcBrut(taxable, T = TAUX_ACTIF) {
  return Math.max(0, impotTranches(taxable, T.qcBr) - T.qcBr[0][1] * T.qcBPA);
}

/**
 * Retenues annuelles estimées (fédéral, Québec, RRQ, AE, RQAP) et taux moyens.
 * @param {number} A revenu annuel
 * @returns {Object}
 */
export function retenuesAnnuelles(A, T = TAUX_ACTIF) {
  A = Math.max(0, n(A));
  const rrq1 = Math.max(0, Math.min(A, T.rrqMGA) - T.rrqExempt) * T.rrqTaux,
    rrq2 = Math.max(0, Math.min(A, T.rrqMSGA) - T.rrqMGA) * T.rrq2Taux;
  const rrqBase = (rrq1 * T.rrqBase) / T.rrqTaux,
    rrqSupp = rrq1 - rrqBase + rrq2;
  const ae = Math.min(A, T.aeMax) * T.aeTaux,
    rqap = Math.min(A, T.rqapMax) * T.rqapTaux;
  const fedTax = Math.max(0, A - rrqSupp);
  const fed =
    Math.max(
      0,
      impotTranches(fedTax, T.fedBr) - T.fedBr[0][1] * (T.fedBPA + rrqBase + ae + rqap + Math.min(T.cea, A)),
    ) *
    (1 - T.abattement);
  const qcTax = Math.max(0, A - rrqSupp - Math.min(T.qcTravMax, A * T.qcTravTaux));
  const qc = qcBrut(qcTax, T);
  const o = { revenu: r2(A), fed: r2(fed), qc: r2(qc), rrq: r2(rrq1 + rrq2), ae: r2(ae), rqap: r2(rqap) };
  o.total = r2(o.fed + o.qc + o.rrq + o.ae + o.rqap);
  o.taux = {};
  for (const k of ['fed', 'qc', 'rrq', 'ae', 'rqap', 'total']) o.taux[k] = A > 0 ? o[k] / A : 0;
  return o;
}

/**
 * Retenues estimées d'un quart au taux moyen annualisé, avec règle des 8 % et cash déclaré.
 * @returns {Object}
 */
export function impotQuart(s, A, o = {}) {
  const c = calcShift(s),
    decl = o.declPct == null ? 1 : n(o.declPct) / 100,
    regle8 = o.regle8 !== false;
  const g = c.gross,
    netT = c.netTips,
    cardNet = g > 0 ? (netT * n(s.card)) / g : 0,
    cashNet = netT - cardNet;
  const declare = r2(cardNet + cashNet * decl);
  const attrib = regle8 && n(s.sales) > 0 ? r2(Math.max(0, 0.08 * n(s.sales) - declare)) : 0;
  const imposable = r2(c.base + declare + attrib);
  const R = o.ret || retenuesAnnuelles(A, o.T);
  const det = {};
  for (const k of ['fed', 'qc', 'rrq', 'ae', 'rqap']) det[k] = r2(imposable * R.taux[k]);
  const ded = r2(det.fed + det.qc + det.rrq + det.ae + det.rqap);
  const aMettre = imposable > 0 ? r2((ded * Math.max(0, cashNet * decl)) / imposable) : 0;
  return Object.assign({}, c, {
    declare,
    attrib,
    imposable,
    det,
    ded,
    retenuSource: r2(ded - aMettre),
    aMettreDeCote: aMettre,
    cashNonDeclare: r2(cashNet * (1 - decl)),
    net: r2(c.total - ded),
    effBrut: c.eff,
    effNet: c.hours > 0 ? r2((c.total - ded) / c.hours) : 0,
  });
}

/**
 * Somme des retenues sur plusieurs quarts.
 * @returns {Object}
 */
export function sommeImpot(shifts, A, o) {
  const t = {
    n: 0,
    hours: 0,
    total: 0,
    imposable: 0,
    attrib: 0,
    ded: 0,
    net: 0,
    aMettreDeCote: 0,
    retenuSource: 0,
    det: { fed: 0, qc: 0, rrq: 0, ae: 0, rqap: 0 },
  };
  const R = retenuesAnnuelles(A, o && o.T);
  for (const s of shifts) {
    const q = impotQuart(s, A, Object.assign({}, o, { ret: R }));
    t.n++;
    for (const k of ['hours', 'total', 'imposable', 'attrib', 'ded', 'net', 'aMettreDeCote', 'retenuSource'])
      t[k] += q[k];
    for (const k in t.det) t.det[k] += q.det[k];
  }
  for (const k of ['hours', 'total', 'imposable', 'attrib', 'ded', 'net', 'aMettreDeCote', 'retenuSource'])
    t[k] = r2(t[k]);
  for (const k in t.det) t.det[k] = r2(t.det[k]);
  t.effBrut = t.hours ? r2(t.total / t.hours) : 0;
  t.effNet = t.hours ? r2(t.net / t.hours) : 0;
  return t;
}

/**
 * Projette le revenu annuel à partir des quarts saisis.
 * @returns {number}
 */
export function revenuAnnuelEstime(shifts) {
  if (!shifts.length) return 0;
  const d = shifts.map((s) => new Date(s.date + 'T12:00:00'));
  const jours = Math.max(7, (Math.max(...d) - Math.min(...d)) / 864e5 + 1);
  return r2((shifts.reduce((t, s) => t + calcShift(s).total, 0) / jours) * 365);
}

/**
 * Brut, net et heures par date.
 * @returns {Object<string,Object>}
 */
export function parJour(shifts, A, o) {
  const R = retenuesAnnuelles(A, o && o.T),
    m = {};
  for (const s of shifts) {
    const q = impotQuart(s, A, Object.assign({}, o, { ret: R }));
    const d = m[s.date] || (m[s.date] = { date: s.date, n: 0, hours: 0, total: 0, ded: 0, net: 0, shifts: [] });
    d.n++;
    d.hours += q.hours;
    d.total += q.total;
    d.ded += q.ded;
    d.net += q.net;
    d.shifts.push(s);
  }
  for (const d of Object.values(m)) {
    d.hours = r2(d.hours);
    d.total = r2(d.total);
    d.ded = r2(d.ded);
    d.net = r2(d.net);
    d.effNet = d.hours ? r2(d.net / d.hours) : 0;
  }
  return m;
}

/**
 * Meilleur jour, meilleur quart, tendance et totaux net.
 * @returns {Object}
 */
export function insights(shifts, A, o, auj) {
  const out = { n: shifts.length };
  if (!shifts.length) return out;
  const D = byDay(shifts)
    .filter((x) => x.n >= 1)
    .sort((a, b) => b.eff - a.eff);
  out.meilleurJour = D.length ? { jour: JOURS[+D[0].key], eff: D[0].eff, n: D[0].n } : null;
  const best = shifts
    .map((s) => ({ s, c: calcShift(s) }))
    .filter((x) => x.c.hours > 0)
    .sort((a, b) => b.c.eff - a.c.eff)[0];
  out.meilleurQuart = best ? { date: best.s.date, eff: best.c.eff, total: best.c.total } : null;
  const lun = mondayOf(auj),
    lunP = addDays(lun, -7),
    jour = (new Date(auj + 'T12:00:00').getDay() + 6) % 7;
  const cette = shifts.filter((s) => mondayOf(s.date) === lun),
    prec = shifts.filter((s) => s.date >= lunP && s.date <= addDays(lunP, jour));
  const a = sommeImpot(cette, A, o).net,
    b = sommeImpot(prec, A, o).net;
  out.semaine = a;
  out.semainePrec = b;
  out.tendance = b > 0 ? r2(((a - b) / b) * 100) : null;
  const ym = auj.slice(0, 7);
  out.mois = sommeImpot(
    shifts.filter((s) => s.date.slice(0, 7) === ym),
    A,
    o,
  ).net;
  return out;
}

/**
 * Sommaire annuel de style T4 / RL-1 (estimation).
 * @returns {Object}
 */
export function sommaireAnnuel(shifts, an, A, o) {
  const ss = shifts.filter((s) => s.date.slice(0, 4) === String(an));
  const R = retenuesAnnuelles(A, o && o.T),
    oo = Object.assign({}, o, { ret: R });
  const t = {
    an: String(an),
    n: ss.length,
    heures: 0,
    salaire: 0,
    pourbCarte: 0,
    pourbCashDecl: 0,
    attrib: 0,
    cashNonDecl: 0,
    imposable: 0,
    fed: 0,
    qc: 0,
    rrq: 0,
    ae: 0,
    rqap: 0,
    aMettre: 0,
  };
  for (const s of ss) {
    const q = impotQuart(s, A, oo);
    t.heures += q.hours;
    t.salaire += q.base;
    const card = q.gross > 0 ? (q.netTips * n(s.card)) / q.gross : 0;
    t.pourbCarte += card;
    t.pourbCashDecl += q.declare - card;
    t.attrib += q.attrib;
    t.cashNonDecl += q.cashNonDeclare;
    t.imposable += q.imposable;
    for (const k of ['fed', 'qc', 'rrq', 'ae', 'rqap']) t[k] += q.det[k];
    t.aMettre += q.aMettreDeCote;
  }
  for (const k in t) if (typeof t[k] === 'number' && k !== 'n') t[k] = r2(t[k]);
  t.pourboiresDeclares = r2(t.pourbCarte + t.pourbCashDecl + t.attrib);
  t.retenues = r2(t.fed + t.qc + t.rrq + t.ae + t.rqap);
  return t;
}

/** Taux actifs (chargés depuis taux-AAAA.json au démarrage). */
let TAUX_ACTIF = TAUX2026;
/**
 * Convertit le fichier de configuration JSON (null = sans plafond) en objet de taux.
 * @param {Object} cfg contenu de taux-2026.json
 * @returns {Object}
 */
export function tauxDepuisConfig(cfg) {
  const t = Object.assign({}, cfg.taux);
  for (const k of ['fedBr', 'qcBr']) t[k] = t[k].map(([lim, r]) => [lim == null ? Infinity : lim, r]);
  return t;
}
/** @param {Object} t taux à activer */
export function setTaux(t) {
  TAUX_ACTIF = t;
}
/** @returns {Object} taux actifs */
export function getTaux() {
  return TAUX_ACTIF;
}
