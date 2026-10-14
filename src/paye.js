/**
 * @file paye.js : périodes de paie, bulletin estimé, cumul annuel et aperçu T4 / RL-1.
 * Hypothèse par défaut : la période se termine le dimanche avant la paye (décalage 5 jours pour une paye le vendredi).
 */
import { n, r2, calcShift } from './calc.js';
import { retenuesAnnuelles, impotQuart } from './taxes.js';

/** Fréquences de paie : libellé et nombre de payes par an. */
export const FREQS = {
  sem: { lbl: 'Hebdomadaire', parAn: 52, pas: 7 },
  '2sem': { lbl: 'Aux deux semaines', parAn: 26, pas: 14 },
  bimens: { lbl: 'Deux fois par mois (15 et fin du mois)', parAn: 24 },
  mens: { lbl: 'Mensuelle', parAn: 12 },
};
export const PAYE_DEF = { payFreq: '2sem', payJour: 5, payRef: '2026-10-16', payDecal: 5 };

const D = (s) => new Date(s + 'T12:00:00Z');
const S = (d) => d.toISOString().slice(0, 10);
/** Ajoute des jours à une date AAAA-MM-JJ. */
export const plusJours = (s, k) => S(new Date(D(s).getTime() + k * 864e5));
const ecart = (a, b) => Math.round((D(b) - D(a)) / 864e5);
const finMois = (y, m) => new Date(Date.UTC(y, m + 1, 0, 12)).getUTCDate();

/** Normalise la configuration de paie. */
export function cfgPaye(P = {}) {
  const c = {
    freq: FREQS[P.payFreq] ? P.payFreq : PAYE_DEF.payFreq,
    jour: P.payJour == null || P.payJour === '' ? PAYE_DEF.payJour : Math.min(6, Math.max(0, Math.round(n(P.payJour)))),
    ref: /^\d{4}-\d{2}-\d{2}$/.test(P.payRef || '') ? P.payRef : PAYE_DEF.payRef,
    decal: P.payDecal == null || P.payDecal === '' ? PAYE_DEF.payDecal : Math.max(0, Math.round(n(P.payDecal))),
  };
  if (FREQS[c.freq].pas) {
    // la date de référence suit le jour de paye choisi (même semaine)
    const j = D(c.ref).getUTCDay();
    c.ref = plusJours(c.ref, c.jour - j);
  }
  c.parAn = FREQS[c.freq].parAn;
  return c;
}

/** Paye suivante (k = +1) ou précédente (k = -1) à partir d'une date de paye. */
function voisine(c, p, k) {
  const f = FREQS[c.freq];
  if (f.pas) return plusJours(p, k * f.pas);
  const d = D(p),
    y = d.getUTCFullYear(),
    m = d.getUTCMonth(),
    j = d.getUTCDate();
  if (c.freq === 'mens') {
    const jr = D(c.ref).getUTCDate();
    const mm = new Date(Date.UTC(y, m + k, 1, 12));
    return S(
      new Date(
        Date.UTC(
          mm.getUTCFullYear(),
          mm.getUTCMonth(),
          Math.min(jr, finMois(mm.getUTCFullYear(), mm.getUTCMonth())),
          12,
        ),
      ),
    );
  }
  // bimensuelle : le 15 et le dernier jour du mois
  if (k > 0)
    return j < 15
      ? S(new Date(Date.UTC(y, m, 15, 12)))
      : j < finMois(y, m)
        ? S(new Date(Date.UTC(y, m, finMois(y, m), 12)))
        : S(new Date(Date.UTC(y, m + 1, 15, 12)));
  return j > 15 ? S(new Date(Date.UTC(y, m, 15, 12))) : S(new Date(Date.UTC(y, m, 0, 12)));
}

/** Date de paye ancre alignée sur le calendrier de la fréquence. */
function ancre(c) {
  if (c.freq !== 'bimens') return c.ref;
  const d = D(c.ref),
    y = d.getUTCFullYear(),
    m = d.getUTCMonth();
  return d.getUTCDate() <= 15 ? S(new Date(Date.UTC(y, m, 15, 12))) : S(new Date(Date.UTC(y, m, finMois(y, m), 12)));
}

/** Première date de paye ≥ jour donné. */
export function prochainePaye(c, jour) {
  let p = ancre(c);
  if (FREQS[c.freq].pas) {
    const pas = FREQS[c.freq].pas;
    return plusJours(p, Math.ceil(ecart(p, jour) / pas) * pas);
  }
  while (p < jour) p = voisine(c, p, 1);
  for (let q = voisine(c, p, -1); q >= jour; q = voisine(c, q, -1)) p = q;
  return p;
}

/** Période de travail couverte par une paye : du lendemain de la fin précédente à paye − décalage. */
export function periode(c, paye) {
  const fin = plusJours(paye, -c.decal);
  const debut = plusJours(plusJours(voisine(c, paye, -1), -c.decal), 1);
  return { paye, debut, fin };
}

/** Payes dont la date tombe entre du et au (inclus). */
export function payesEntre(c, du, au) {
  const out = [];
  for (let p = prochainePaye(c, du); p <= au; p = voisine(c, p, 1)) out.push(p);
  return out;
}

const dans = (s, du, au) => s.date >= du && s.date <= au;

/**
 * Bulletin de paie estimé (méthode des retenues périodiques : revenu de la période annualisé).
 * Brut imposable = salaire + pourboires carte + cash déclaré + attribution 8 %. Dépôt = salaire + carte − retenues.
 * @returns {Object}
 */
export function bulletin(shifts, c, paye, o = {}) {
  const per = periode(c, paye);
  const qs = shifts.filter((s) => dans(s, per.debut, per.fin));
  const t = { ...per, n: qs.length, heures: 0, salaire: 0, carte: 0, cash: 0, cashDecl: 0, attrib: 0, brut: 0 };
  for (const s of qs) {
    const q = impotQuart(s, 0, { ...o, ret: { taux: { fed: 0, qc: 0, rrq: 0, ae: 0, rqap: 0 } } });
    const cardNet = q.gross > 0 ? (q.netTips * n(s.card)) / q.gross : 0;
    t.heures += q.hours;
    t.salaire += q.base;
    t.carte += cardNet;
    t.cash += q.netTips - cardNet;
    t.cashDecl += q.declare - cardNet;
    t.attrib += q.attrib;
    t.brut += q.imposable;
  }
  const R = retenuesAnnuelles(t.brut * c.parAn, o.T);
  t.det = {};
  for (const k of ['fed', 'qc', 'rrq', 'ae', 'rqap']) t.det[k] = r2(t.brut * R.taux[k]);
  t.ded = r2(Object.values(t.det).reduce((a, b) => a + b, 0));
  for (const k of ['heures', 'salaire', 'carte', 'cash', 'cashDecl', 'attrib', 'brut']) t[k] = r2(t[k]);
  t.depot = r2(t.salaire + t.carte - t.ded);
  return t;
}

/** Bulletins des payes passées (≤ aujourd'hui), plus récentes d'abord. */
export function bulletinsPasses(shifts, c, auj, o, max = 26) {
  if (!shifts.length) return [];
  const premier = shifts.reduce((m, s) => (s.date < m ? s.date : m), auj);
  const ps = payesEntre(c, premier, auj).reverse().slice(0, max);
  return ps.map((p) => bulletin(shifts, c, p, o)).filter((b) => b.n);
}

/** Total sur une période libre : brut, net estimé, cash, carte. */
export function totalPeriode(shifts, du, au, A, o = {}) {
  const qs = shifts.filter((s) => dans(s, du, au));
  const R = retenuesAnnuelles(A, o.T);
  const t = { du, au, n: qs.length, heures: 0, brut: 0, ded: 0, net: 0, cash: 0, carte: 0, salaire: 0 };
  for (const s of qs) {
    const q = impotQuart(s, A, { ...o, ret: R });
    t.heures += q.hours;
    t.brut += q.total;
    t.ded += q.ded;
    t.cash += n(s.cash);
    t.carte += n(s.card);
    t.salaire += q.base;
  }
  for (const k of ['heures', 'brut', 'ded', 'cash', 'carte', 'salaire']) t[k] = r2(t[k]);
  t.net = r2(t.brut - t.ded);
  return t;
}

/** Fraction de l'année écoulée au jour donné (1 pour une année passée). */
export function fractionAnnee(an, auj) {
  const y = +auj.slice(0, 4);
  if (an < y) return 1;
  if (an > y) return 0;
  const jours = ecart(`${an}-01-01`, `${an + 1}-01-01`);
  return (ecart(`${an}-01-01`, auj) + 1) / jours;
}

/**
 * Cumul de l'année (par date de quart) : cash, carte, salaire, revenu d'emploi, retenues estimées.
 * @returns {Object}
 */
export function cumulAnnee(shifts, an, auj, o = {}) {
  const qs = shifts.filter((s) => s.date.startsWith(String(an)) && s.date <= auj);
  const t = {
    an,
    n: qs.length,
    heures: 0,
    cash: 0,
    carte: 0,
    salaire: 0,
    tipout: 0,
    attrib: 0,
    revenuEmploi: 0,
    brut: 0,
  };
  const zero = { taux: { fed: 0, qc: 0, rrq: 0, ae: 0, rqap: 0 } };
  for (const s of qs) {
    const q = impotQuart(s, 0, { ...o, ret: zero });
    t.heures += q.hours;
    t.cash += n(s.cash);
    t.carte += n(s.card);
    t.salaire += q.base;
    t.tipout += -q.tipout;
    t.attrib += q.attrib;
    t.revenuEmploi += q.imposable;
    t.brut += q.total;
  }
  for (const k of ['heures', 'cash', 'carte', 'salaire', 'tipout', 'attrib', 'revenuEmploi', 'brut']) t[k] = r2(t[k]);
  const f = fractionAnnee(an, auj);
  t.fraction = f;
  t.projection = f > 0 ? r2(t.revenuEmploi / f) : 0;
  const R = retenuesAnnuelles(t.projection, o.T);
  t.ded = r2(t.revenuEmploi * R.taux.total);
  t.net = r2(t.brut - t.ded);
  return t;
}

/** Années présentes dans les quarts (plus récente d'abord). */
export const annees = (shifts) => [...new Set(shifts.map((s) => +s.date.slice(0, 4)))].sort((a, b) => b - a);

/**
 * Aperçu T4 / RL-1 (estimation) : cases à date et projetées sur l'année, solde à payer (+) ou remboursement (−).
 * Retenu = méthode périodique paye par paye (année selon la date de paye) ; dû = impôt réel sur le revenu annuel.
 * @returns {Object}
 */
export function apercuT4(shifts, an, c, auj, o = {}) {
  const lim = an < +auj.slice(0, 4) ? `${an}-12-31` : auj;
  const ps = payesEntre(c, `${an}-01-01`, `${an}-12-31`);
  const faits = ps.filter((p) => p <= lim);
  const cum = { brut: 0, fed: 0, qc: 0, rrq: 0, ae: 0, rqap: 0 };
  for (const p of faits) {
    const b = bulletin(shifts, c, p, o);
    cum.brut += b.brut;
    for (const k of ['fed', 'qc', 'rrq', 'ae', 'rqap']) cum[k] += b.det[k];
  }
  // payes à venir de l'année : quarts déjà travaillés qui seront payés plus tard + projection du reste
  const f = faits.length && ps.length ? faits.length / ps.length : fractionAnnee(an, auj);
  const proj = {};
  for (const k in cum) proj[k] = f > 0 ? r2(cum[k] / f) : 0;
  for (const k in cum) cum[k] = r2(cum[k]);
  const cases = (x) => ({
    t4: { 14: x.brut, 16: 0, 17: x.rrq, 18: x.ae, 22: x.fed, 55: x.rqap },
    rl1: { A: x.brut, 'B.A': x.rrq, C: x.ae, H: x.rqap, E: x.qc },
  });
  const du = retenuesAnnuelles(proj.brut, o.T);
  const retenu = r2(proj.fed + proj.qc + proj.rrq + proj.ae + proj.rqap);
  return {
    an,
    payes: faits.length,
    payesAn: ps.length,
    fraction: f,
    aDate: cases(cum),
    projete: cases(proj),
    du,
    retenu,
    solde: r2(du.total - retenu),
    soldeDet: {
      fed: r2(du.fed - proj.fed),
      qc: r2(du.qc - proj.qc),
      cotisations: r2(du.rrq + du.ae + du.rqap - proj.rrq - proj.ae - proj.rqap),
    },
  };
}

/** Libellé court « ven. 16 oct. ». */
export function dateCourte(s) {
  const J = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  const M = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const d = D(s);
  return `${J[d.getUTCDay()]} ${d.getUTCDate()} ${M[d.getUTCMonth()]}`;
}

export { calcShift };
