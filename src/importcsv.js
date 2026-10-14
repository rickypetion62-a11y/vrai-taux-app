/**
 * @file importcsv.js : import CSV depuis une autre appli (Just The Tips, TipSee, ServerLife, tableur).
 * Détection automatique des colonnes, repli par correspondance manuelle, conversion en quarts v6.
 */
import { n, r2, calcShift } from './calc.js';
import { assainirQuart } from './storage.js';

/** Champs reconnus par l'import, avec leurs libellés. */
export const CHAMPS = {
  date: 'Date',
  job: 'Emploi / resto',
  role: 'Poste',
  quart: 'Type de quart',
  debut: 'Heure de début',
  fin: 'Heure de fin',
  heures: 'Heures',
  salaire: 'Salaire du quart ($)',
  taux: 'Taux horaire ($/h)',
  cash: 'Pourboires cash',
  card: 'Pourboires carte',
  tipout: 'Tip-out remis ($)',
  ventes: 'Ventes',
  notes: 'Notes',
};

/** Motifs de détection (en-têtes en minuscules, sans accents). */
const MOTIFS = {
  date: /^(date|jour|day)$/,
  job: /(emploi|job|restaurant|resto|employeur|employer|workplace)/,
  role: /(poste|position|role|fonction)/,
  quart: /^(quart|shift( type)?|type)$/,
  debut: /(debut|start|clock ?in|heure d.?arrivee|arrivee)/,
  fin: /(fin|end|clock ?out|depart)/,
  heures: /^(heures?|hours?|duree|duration|hrs)( travaillees| worked)?$/,
  salaire: /(revenu horaire|salaire|wages?|hourly (pay|earnings|income)|paie)/,
  taux: /(taux|hourly rate|rate)/,
  cash: /(especes|cash|comptant)/,
  card: /(credit|carte|card|cc|debit)/,
  tipout: /(tip.?out|partage|tip share)/,
  ventes: /(ventes|sales)/,
  notes: /(notes?|commentaires?|memo)/,
};
const sansAccent = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/**
 * Lit un CSV (guillemets, virgule ou point-virgule, BOM).
 * @param {string} txt
 * @returns {{entetes:string[], lignes:string[][]}}
 */
export function lireCSV(txt) {
  txt = String(txt).replace(/^\uFEFF/, '');
  const premiere = txt.split(/\r?\n/)[0] || '';
  const sep = (premiere.match(/;/g) || []).length > (premiere.match(/,/g) || []).length ? ';' : ',';
  const out = [];
  let ligne = [],
    champ = '',
    q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) {
      if (c === '"' && txt[i + 1] === '"') {
        champ += '"';
        i++;
      } else if (c === '"') q = false;
      else champ += c;
    } else if (c === '"') q = true;
    else if (c === sep) {
      ligne.push(champ);
      champ = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && txt[i + 1] === '\n') i++;
      ligne.push(champ);
      champ = '';
      if (ligne.some((x) => x.trim() !== '')) out.push(ligne);
      ligne = [];
    } else champ += c;
  }
  ligne.push(champ);
  if (ligne.some((x) => x.trim() !== '')) out.push(ligne);
  const entetes = (out.shift() || []).map((h) => h.trim());
  return { entetes, lignes: out.map((l) => l.map((x) => x.trim())) };
}

/**
 * Montant tolérant : « 1 234,56 $ », « $1,234.56 », « 98,70 », « (5) ».
 * @param {string} s
 * @returns {number}
 */
export function lireMontant(s) {
  let t = String(s ?? '').replace(/[\s\u00a0\u202f$€]/g, '');
  if (!t) return 0;
  const neg = /^\(.*\)$/.test(t) || t.startsWith('-');
  t = t.replace(/[()-]/g, '');
  if (t.includes(',') && t.includes('.'))
    t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else if (t.includes(','))
    t =
      /,\d{3}$/.test(t) && !/,\d{1,2}$/.test(t) && t.split(',').length > 2 ? t.replace(/,/g, '') : t.replace(',', '.');
  const v = parseFloat(t);
  return isFinite(v) ? (neg ? -v : v) : 0;
}

/**
 * Heure en heures décimales : « 4:30p.m. », « 16:30 », « 4:30 PM », « 16h30 ».
 * @param {string} s
 * @returns {number|null}
 */
export function lireHeure(s) {
  const t = sansAccent(s).replace(/\s+/g, '');
  const m = t.match(/^(\d{1,2})[:h]?(\d{2})?([ap])?\.?m?\.?$/);
  if (!m) return null;
  let h = +m[1];
  const mi = +(m[2] || 0);
  if (m[3]) h = (h % 12) + (m[3] === 'p' ? 12 : 0);
  if (h > 23 || mi > 59) return null;
  return h + mi / 60;
}

/**
 * Date en AAAA-MM-JJ : ISO, JJ/MM/AAAA (par défaut) ou MM/JJ/AAAA si le jour dépasse 12 en 2e position.
 * @param {string} s
 * @returns {string|null}
 */
export function lireDate(s) {
  const t = String(s).trim();
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    let [a, b, y] = [+m[1], +m[2], m[3].length === 2 ? '20' + m[3] : m[3]];
    if (b > 12 && a <= 12) [a, b] = [b, a];
    if (a > 31 || b > 12) return null;
    return `${y}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
  }
  return null;
}

/**
 * Détecte la correspondance colonnes → champs à partir des en-têtes.
 * @param {string[]} entetes
 * @returns {{map:Object<string,number>, source:string}}
 */
export function detecterColonnes(entetes) {
  const map = {};
  const norm = entetes.map(sansAccent);
  for (const [champ, re] of Object.entries(MOTIFS)) {
    const i = norm.findIndex((h, k) => re.test(h) && !Object.values(map).includes(k));
    if (i >= 0) map[champ] = i;
  }
  if (map.salaire != null && map.taux === map.salaire) delete map.taux;
  const jtt = ['heure debut', 'heure fin', 'revenu horaire', 'especes', 'credit', 'tip-out'].every((h) =>
    norm.includes(h),
  );
  return { map, source: jtt ? 'Just The Tips' : 'générique' };
}

/** Correspondance de postes vers les postes de l'appli. */
export function posteVers(s, defaut = 'serveur') {
  const t = sansAccent(s);
  if (/bar(man|maid|tend|back)?/.test(t)) return 'barman';
  if (/(busboy|bus|commis|runner|busser)/.test(t)) return 'busboy';
  if (/(maitre|captain|capitaine|manager)/.test(t)) return 'maitre';
  if (/(hote|host)/.test(t)) return 'hotesse';
  if (/(serv|wait)/.test(t)) return 'serveur';
  return defaut;
}

/** Empreinte stable (FNV-1a) pour éviter les doublons lors d'un nouvel import. */
function empreinte(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h.toString(36);
}

/**
 * Convertit les lignes CSV en quarts v6, avec un rapport d'anomalies et des totaux source.
 * @param {string[][]} lignes
 * @param {Object<string,number>} map
 * @param {{emploiDefaut?:string, posteDefaut?:string, tauxDefaut?:number, tipoutImpot?:boolean}} [o]
 *   tipoutImpot : la colonne Tip-out contient des retenues d'impôt (Just The Tips) ; tip-out mis à 0, valeur gardée en note.
 * @returns {{quarts:Object[], rejets:Object[], anomalies:Object[], totaux:Object}}
 */
export function convertir(lignes, map, o = {}) {
  const get = (l, c) => (map[c] != null ? (l[map[c]] ?? '').trim() : '');
  const quarts = [],
    rejets = [],
    anomalies = [];
  const tot = { lignes: lignes.length, heures: 0, salaire: 0, cash: 0, card: 0, tipout: 0, retenue: 0, ventes: 0 };
  lignes.forEach((l, i) => {
    const no = i + 2;
    const date = lireDate(get(l, 'date'));
    if (!date) return rejets.push({ ligne: no, raison: 'date invalide', valeur: get(l, 'date') });
    let h = map.heures != null ? lireMontant(get(l, 'heures')) : null;
    if (h == null) {
      const a = lireHeure(get(l, 'debut')),
        b = lireHeure(get(l, 'fin'));
      h = a == null || b == null ? 0 : (((b - a) % 24) + 24) % 24;
    }
    h = r2(h);
    const sal = lireMontant(get(l, 'salaire')),
      cash = lireMontant(get(l, 'cash')),
      card = lireMontant(get(l, 'card')),
      to = Math.abs(lireMontant(get(l, 'tipout'))),
      ventes = lireMontant(get(l, 'ventes'));
    let taux = map.taux != null ? lireMontant(get(l, 'taux')) : h > 0 && sal > 0 ? sal / h : 0;
    const tauxDefaut = !(taux > 0);
    if (tauxDefaut) taux = o.tauxDefaut ?? 13.3;
    if (h === 0)
      anomalies.push({ ligne: no, date, type: 'heures-nulles', detail: `${get(l, 'debut')} → ${get(l, 'fin')}` });
    if (h > 12) anomalies.push({ ligne: no, date, type: 'quart-long', detail: `${h} h` });
    tot.heures += h;
    tot.salaire += sal;
    tot.cash += cash;
    tot.card += card;
    if (o.tipoutImpot) tot.retenue += to;
    else tot.tipout += to;
    tot.ventes += ventes;
    const job = get(l, 'job');
    const notes = [
      get(l, 'quart'),
      get(l, 'notes'),
      'import ' + (o.source || 'CSV'),
      tauxDefaut && h > 0 ? 'taux par défaut' : '',
      o.tipoutImpot && to ? `Retenue JTT : ${String(r2(to)).replace('.', ',')} $` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    const q = assainirQuart({
      id: 'csv-' + empreinte([date, get(l, 'debut'), get(l, 'fin'), cash, card, to, sal].join('|')),
      date,
      role: posteVers(get(l, 'role'), o.posteDefaut || 'serveur'),
      hours: String(h),
      rate: String(Math.round(taux * 10000) / 10000),
      card: String(card),
      cash: String(cash),
      sales: ventes ? String(ventes) : '',
      toDir: 'donne',
      toMode: 'montant',
      toVal: o.tipoutImpot ? '0' : String(to),
      job: !job || /^default job$/i.test(job) ? o.emploiDefaut || '' : job,
      notes,
      _t: 1,
    });
    if (q) quarts.push(q);
  });
  const d = quarts.map((q) => q.date).sort();
  for (const k of ['heures', 'salaire', 'cash', 'card', 'tipout', 'retenue', 'ventes']) tot[k] = r2(tot[k]);
  tot.du = d[0] || null;
  tot.au = d[d.length - 1] || null;
  return { quarts, rejets, anomalies, totaux: tot };
}

/**
 * Totaux calculés par l'appli sur des quarts (pour vérifier un import).
 * @param {Object[]} quarts
 * @returns {{heures:number, salaire:number, cash:number, card:number, tipout:number, total:number, eff:number}}
 */
export function totauxQuarts(quarts) {
  const t = { heures: 0, salaire: 0, cash: 0, card: 0, tipout: 0, total: 0 };
  for (const s of quarts) {
    const c = calcShift(s);
    t.heures += c.hours;
    t.salaire += c.base;
    t.cash += n(s.cash);
    t.card += n(s.card);
    t.tipout += -c.tipout;
    t.total += c.total;
  }
  for (const k in t) t[k] = r2(t[k]);
  t.eff = t.heures ? r2(t.total / t.heures) : 0;
  return t;
}
