/**
 * @file security.js : NIP haché avec PBKDF2-SHA-256 (WebCrypto) et sel aléatoire.
 * Le NIP n'est jamais stocké en clair. Ce verrou cache l'écran ; il ne chiffre pas les données.
 */

const ITER = 150000;
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/**
 * Génère un sel aléatoire de 16 octets (hex).
 * @returns {string}
 */
export function nouveauSel() {
  return hex(globalThis.crypto.getRandomValues(new Uint8Array(16)));
}

/**
 * Hache un NIP avec PBKDF2-SHA-256.
 * @param {string} pin
 * @param {string} sel
 * @param {number} [iter]
 * @returns {Promise<string>} empreinte hex de 256 bits
 */
export async function hacherNip(pin, sel, iter = ITER) {
  const c = globalThis.crypto.subtle;
  const cle = await c.importKey('raw', new TextEncoder().encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
  const bits = await c.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(sel), iterations: iter },
    cle,
    256,
  );
  return hex(bits);
}

/**
 * Vérifie un NIP en temps constant.
 * @param {string} pin
 * @param {{pinH:string,pinS:string}} P
 * @returns {Promise<boolean>}
 */
export async function verifierNip(pin, P) {
  if (!P.pinH || !P.pinS) return false;
  const h = await hacherNip(pin, P.pinS);
  let d = h.length ^ P.pinH.length;
  for (let i = 0; i < h.length; i++) d |= h.charCodeAt(i) ^ (P.pinH.charCodeAt(i) || 0);
  return d === 0;
}
