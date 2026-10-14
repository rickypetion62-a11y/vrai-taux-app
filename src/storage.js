/**
 * @file storage.js : schéma versionné, migrations, validation/assainissement,
 * sauvegarde atomique dans IndexedDB (repli localStorage) et fichiers de sauvegarde.
 */
import { n, nid, trier, ROLES } from './calc.js';

/** Version actuelle du schéma de données. */
export const SCHEMA = 6;
const APP_ID = 'vrai-taux-horaire';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DIRS = ['donne', 'recu'];
const MODES = ['pctVentes', 'pctPourboires', 'montant'];

/**
 * Nettoie une chaîne saisie : caractères de contrôle retirés, longueur limitée.
 * @param {*} v
 * @param {number} [max=80]
 * @returns {string}
 */
export function propre(v, max = 80) {
  return (
    String(v ?? '')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f<>]/g, '')
      .trim()
      .slice(0, max)
  );
}

/**
 * Nombre positif borné, renvoyé en chaîne ('' si vide).
 * @param {*} v
 * @param {number} max
 * @returns {string}
 */
function num(v, max) {
  if (v === '' || v == null) return '';
  const x = n(v);
  return String(Math.min(Math.max(0, x), max));
}

/**
 * Valide et assainit un quart. Renvoie null si la date est invalide.
 * @param {Object} s
 * @returns {import('./calc.js').Shift|null}
 */
export function assainirQuart(s) {
  if (!s || typeof s !== 'object' || !DATE_RE.test(String(s.date))) return null;
  const d = new Date(s.date + 'T12:00:00');
  if (isNaN(d)) return null;
  const q = {
    id: propre(s.id, 40) || nid(),
    date: s.date,
    role: Object.prototype.hasOwnProperty.call(ROLES, s.role) ? s.role : 'serveur',
    hours: num(s.hours, 24),
    rate: num(s.rate, 500),
    card: num(s.card, 100000),
    cash: num(s.cash, 100000),
    sales: num(s.sales, 1000000),
    toDir: DIRS.includes(s.toDir) ? s.toDir : 'donne',
    toMode: MODES.includes(s.toMode) ? s.toMode : 'pctVentes',
    toVal: num(s.toVal, 100000),
    job: propre(s.job, 60),
    notes: propre(s.notes, 200),
  };
  if (s._t) q._t = n(s._t);
  if (s.express) q.express = true;
  return q;
}

/**
 * Migre un état de n'importe quelle version (v1 = sans version) vers SCHEMA.
 * @param {{v?:number,P?:Object,S?:Array,E?:Array,log?:Array}} st
 * @returns {{v:number,P:Object,S:Array,E:Array|null,log:Array,notes:string[]}}
 */
export function migrerEtat(st) {
  const o = Object.assign({ P: {}, S: [], E: null, log: [] }, st);
  const notes = [];
  let v = n(o.v) || 1;
  if (v < 2) {
    o.S = (o.S || []).map((s) => (s && s.id ? s : Object.assign({ id: nid() }, s)));
    v = 2;
  }
  if (v < 3) {
    o.P = Object.assign({ rev: '', decl: 100, r8: true, taux: '' }, o.P);
    v = 3;
  }
  if (v < 4) {
    o.P = Object.assign({ onb: (o.S || []).length > 0, role: 'serveur' }, o.P);
    v = 4;
  }
  if (v < 5) {
    o.P = Object.assign({ objSem: 900, objMois: 3600, jobs: [], job: '' }, o.P);
    v = 5;
  }
  if (v < 6) {
    if (o.P.pinH && !o.P.pinAlgo) {
      o.P.pinH = '';
      o.P.pinS = '';
      notes.push('pin-legacy');
    }
    o.P.lang = o.P.lang || 'fr';
    v = 6;
  }
  o.S = trier((o.S || []).map(assainirQuart).filter(Boolean));
  o.P.jobs = [...new Set((o.P.jobs || []).map((j) => propre(j, 60)).filter(Boolean))];
  o.P.name = propre(o.P.name, 60);
  if (Array.isArray(o.E)) o.E = o.E.map((e) => ({ lbl: propre(e && e.lbl, 60), amt: n(e && e.amt) }));
  return { v, P: o.P, S: o.S, E: o.E, log: Array.isArray(o.log) ? o.log.slice(-100) : [], notes };
}

/**
 * Sérialise l'état complet en JSON de sauvegarde (sans le NIP).
 * @param {{P:Object,S:Array,E:Array}} st
 * @param {string} [quand]
 * @returns {string}
 */
export function exporterSauvegarde(st, quand) {
  const P = Object.assign({}, st.P, { pinH: '', pinS: '', pinAlgo: '' });
  return JSON.stringify(
    { app: APP_ID, version: SCHEMA, date: quand || new Date().toISOString(), param: P, quarts: st.S, depenses: st.E },
    null,
    1,
  );
}

/**
 * Valide, assainit et migre un fichier de sauvegarde (toutes versions).
 * @param {string} txt
 * @throws {Error} si le fichier est invalide
 * @returns {{P:Object,S:Array,E:Array|null}}
 */
export function importerSauvegarde(txt) {
  let o;
  try {
    o = JSON.parse(txt);
  } catch (e) {
    throw new Error('Fichier illisible (JSON invalide).');
  }
  if (!o || o.app !== APP_ID || !Array.isArray(o.quarts))
    throw new Error("Ce fichier n'est pas une sauvegarde de l'appli.");
  if (!o.quarts.every((s) => s && DATE_RE.test(s.date) && n(s.hours) >= 0))
    throw new Error('Sauvegarde corrompue : un quart a une date invalide.');
  const m = migrerEtat({
    v: n(o.version) || 1,
    P: o.param || {},
    S: o.quarts,
    E: Array.isArray(o.depenses) ? o.depenses : null,
  });
  delete m.P.pinH;
  delete m.P.pinS;
  delete m.P.pinAlgo;
  return { P: m.P, S: m.S, E: m.E };
}

/**
 * Faut-il rappeler de faire une sauvegarde ? (7 jours sans sauvegarde et au moins 5 quarts)
 * @param {string|undefined} derniere date AAAA-MM-JJ de la dernière sauvegarde
 * @param {number} nbQuarts
 * @param {string} auj
 * @param {number} [jours=7]
 * @returns {boolean}
 */
export function rappelSauvegarde(derniere, nbQuarts, auj, jours = 7) {
  if (nbQuarts < 5) return false;
  if (!derniere) return true;
  return (new Date(auj + 'T12:00:00') - new Date(derniere + 'T12:00:00')) / 864e5 >= jours;
}

/* ---------- Stockage : IndexedDB (transaction unique = écriture atomique), repli localStorage ---------- */
const DB = 'vrai-taux',
  OS = 'etat',
  CLE = 'courant';

/** @returns {Promise<IDBDatabase|null>} */
function ouvrirDB() {
  return new Promise((res) => {
    try {
      if (typeof indexedDB === 'undefined') return res(null);
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(OS);
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    } catch (e) {
      res(null);
    }
  });
}

/**
 * Crée un magasin d'état. Une seule clé, écrite dans une seule transaction (atomique).
 * En repli localStorage : écriture dans une clé temporaire puis bascule.
 * @param {Storage} [ls]
 */
export function creerMagasin(ls = globalThis.localStorage) {
  let db = null,
    pret = null;
  const lsLire = () => {
    try {
      const j = ls.getItem('vh_etat');
      if (j) return JSON.parse(j);
      const S = JSON.parse(ls.getItem('vh_shifts') || 'null');
      if (!S) return null; // aucune donnée v1-v5
      return { v: 1, P: JSON.parse(ls.getItem('vh_param') || '{}'), S, E: JSON.parse(ls.getItem('vh_exp') || 'null') };
    } catch (e) {
      return null;
    }
  };
  const lsEcrire = (st) => {
    const j = JSON.stringify(st);
    ls.setItem('vh_etat_tmp', j);
    ls.setItem('vh_etat', j);
    ls.removeItem('vh_etat_tmp');
  };
  return {
    /** @returns {Promise<string>} 'indexeddb' ou 'localStorage' */
    async init() {
      pret = pret || ouvrirDB().then((d) => (db = d));
      await pret;
      return db ? 'indexeddb' : 'localStorage';
    },
    /** @returns {Promise<Object>} état migré */
    async lire() {
      await this.init();
      let st = null;
      if (db)
        st = await new Promise((res) => {
          const t = db.transaction(OS).objectStore(OS).get(CLE);
          t.onsuccess = () => res(t.result || null);
          t.onerror = () => res(null);
        });
      if (!st) st = lsLire();
      return migrerEtat(st || { v: SCHEMA });
    },
    /** @param {Object} st @returns {Promise<void>} */
    async ecrire(st) {
      const val = JSON.parse(JSON.stringify(Object.assign({ v: SCHEMA }, st)));
      if (db) {
        await new Promise((res, rej) => {
          const tx = db.transaction(OS, 'readwrite');
          tx.objectStore(OS).put(val, CLE);
          tx.oncomplete = res;
          tx.onerror = () => rej(tx.error);
          tx.onabort = () => rej(tx.error);
        });
        try {
          ls.removeItem('vh_shifts');
        } catch (e) {
          /* rien */
        }
      } else lsEcrire(val);
    },
  };
}

/**
 * Ajoute un id aux quarts qui n'en ont pas.
 * @returns {Shift[]}
 */
export function migrer(shifts) {
  return shifts.map((s) => (s.id ? s : Object.assign({ id: nid() }, s)));
}

/**
 * Fusionne deux listes de quarts par id.
 * @returns {Shift[]}
 */
export function fusionner(a, b) {
  const m = new Map();
  a.concat(b).forEach((s) => m.set(s.id, s));
  return trier([...m.values()]);
}

/**
 * NIP de 4 à 6 chiffres.
 * @returns {boolean}
 */
export function nipValide(pin) {
  return /^\d{4,6}$/.test(String(pin));
}
