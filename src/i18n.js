/**
 * @file i18n.js : français par défaut, anglais en option.
 * Les chaînes sont dans un dictionnaire (clé = texte français). En anglais, un
 * MutationObserver traduit les nœuds texte, placeholders et aria-labels connus.
 */

/** @type {Record<string,string>} Dictionnaire français → anglais. */
export const EN = {
  'Mon vrai $/heure': 'My real $/hour',
  Mon: 'My',
  'vrai $/heure': 'real $/hour',
  'JP finance · pourboires, paie et impôts': 'JP finance · tips, pay and taxes',
  'Aller au contenu': 'Skip to content',
  'Hors ligne': 'Offline',
  'Navigation principale': 'Main navigation',
  Accueil: 'Home',
  Quarts: 'Shifts',
  Quart: 'Shift',
  Impôts: 'Taxes',
  Plus: 'More',
  Réglages: 'Settings',
  'Ajouter un quart': 'Add a shift',
  'Quart : ajouter un quart': 'Shift: add a shift',
  '＋ Quart': '＋ Shift',
  'Net estimé cette semaine': 'Estimated net this week',
  'objectif semaine': 'weekly goal',
  'objectif mois': 'monthly goal',
  'Ajoute ton premier quart avec le bouton ＋': 'Add your first shift with the ＋ button',
  '⚡ Entrée express': '⚡ Express entry',
  'Pourboires total ($)': 'Total tips ($)',
  Heures: 'Hours',
  Enregistrer: 'Save',
  '💡 Tes insights': '💡 Your insights',
  'Détail de la semaine': 'This week in detail',
  'Net estimé': 'Estimated net',
  '$/h net': 'Net $/h',
  Brut: 'Gross',
  '💵 Cash à mettre de côté': '💵 Cash to set aside',
  '↻ Répéter le dernier quart': '↻ Repeat last shift',
  Semaine: 'Week',
  Mois: 'Month',
  'Auj.': 'Today',
  'Période précédente': 'Previous period',
  'Période suivante': 'Next period',
  'Afficher heures et $/h net': 'Show hours and net $/h',
  'Derniers quarts': 'Latest shifts',
  'Tous mes quarts': 'All my shifts',
  'Par semaine': 'By week',
  'Par mois': 'By month',
  'Par emploi': 'By job',
  'Moyenne par poste': 'Average by role',
  'Moyenne par jour': 'Average by day',
  'Estimation seulement, pas un conseil fiscal': 'Estimate only, not tax advice',
  'Cette semaine': 'This week',
  'Ce mois-ci': 'This month',
  '📄 Sommaire annuel (style T4 / RL-1)': '📄 Annual summary (T4 / RL-1 style)',
  'Par quart (10 derniers)': 'By shift (last 10)',
  "D'où viennent les chiffres (2026)": 'Where the numbers come from (2026)',
  'Pourboires et impôts (Québec)': 'Tips and taxes (Québec)',
  "Tes dépenses d'un mois normal": 'Your expenses in a normal month',
  '+ Ajouter une ligne': '+ Add a line',
  'Total :': 'Total:',
  'Ce que tu reçois vraiment': 'What you really receive',
  'Ton nom (facultatif)': 'Your name (optional)',
  'Minimum au pourboire ($/h)': 'Tipped minimum ($/h)',
  'Minimum général ($/h)': 'General minimum ($/h)',
  'Taux de base par poste': 'Base rate by role',
  'Objectif $/h': 'Target $/h',
  'Coussin visé (mois)': 'Target cushion (months)',
  'Coussin de départ ($)': 'Starting cushion ($)',
  'Objectif net / semaine ($)': 'Net goal / week ($)',
  'Objectif net / mois ($)': 'Net goal / month ($)',
  'Mes emplois / restos (un par ligne)': 'My jobs / restaurants (one per line)',
  'Impôts (estimation)': 'Taxes (estimate)',
  'Revenu annuel estimé ($, vide = calculé à partir de tes quarts)':
    'Estimated annual income ($, empty = projected from your shifts)',
  'Pourboires cash déclarés (%)': 'Declared cash tips (%)',
  "Appliquer la règle des 8 % (attribution par l'employeur)": 'Apply the 8% rule (employer allocation)',
  'Ajuster les taux 2026 (JSON, avancé)': 'Adjust 2026 rates (JSON, advanced)',
  '🛟 Sauvegarde (aucune perte de données)': '🛟 Backup (no data loss)',
  '⬇️ Sauvegarder (fichier .json)': '⬇️ Back up (.json file)',
  '⬆️ Restaurer une sauvegarde': '⬆️ Restore a backup',
  '🔒 Verrou NIP (facultatif)': '🔒 PIN lock (optional)',
  'Nouveau NIP': 'New PIN',
  Activer: 'Enable',
  'Retirer le NIP': 'Remove PIN',
  "🧰 Journal d'erreurs (soutien)": '🧰 Error log (support)',
  'Exporter le journal': 'Export log',
  Vider: 'Clear',
  'Politique de confidentialité': 'Privacy policy',
  'Conditions et avis': 'Terms and disclaimer',
  '· Version': '· Version',
  'Charger des exemples': 'Load sample data',
  "Revoir l'accueil (3 étapes)": 'Replay the 3-step intro',
  'Exporter en CSV': 'Export CSV',
  'Effacer toutes les données': 'Erase all data',
  'Tes données restent sur ton téléphone seulement.': 'Your data stays on your phone only.',
  'Nouveau quart': 'New shift',
  'Modifier le quart': 'Edit shift',
  Fermer: 'Close',
  Date: 'Date',
  'Taux de base ($/h)': 'Base rate ($/h)',
  'Moins 15 minutes': 'Minus 15 minutes',
  'Plus 15 minutes': 'Plus 15 minutes',
  '💳 Pourb. carte ($)': '💳 Card tips ($)',
  '💵 Pourb. cash ($)': '💵 Cash tips ($)',
  'Tip-out remis (% des ventes)': 'Tip-out given (% of sales)',
  'Ventes du quart ($)': 'Shift sales ($)',
  'Pour calculer le tip-out en %': 'To compute tip-out in %',
  "Plus d'options": 'More options',
  'Tip-out': 'Tip-out',
  'Je remets': 'I give',
  'Je reçois': 'I receive',
  Calcul: 'Method',
  '% des ventes': '% of sales',
  '% des pourboires': '% of tips',
  'Montant ($)': 'Amount ($)',
  'Valeur du tip-out (% ou $)': 'Tip-out value (% or $)',
  Notes: 'Notes',
  'Terrasse, fête privée…': 'Patio, private party…',
  '↻ Remplir comme le dernier quart': '↻ Fill like last shift',
  'Supprimer ce quart': 'Delete this shift',
  Suivant: 'Next',
  Passer: 'Skip',
  "C'est parti !": "Let's go!",
  'Entre ton NIP': 'Enter your PIN',
  NIP: 'PIN',
  Annuler: 'Undo',
  '✨ Nouvelle version disponible': '✨ New version available',
  'Mettre à jour': 'Update',
  Sauvegarder: 'Back up',
  Aucun: 'None',
  Supprimer: 'Delete',
  Serveur: 'Server',
  Barman: 'Bartender',
  'Busboy / commis': 'Busser',
  Hôtesse: 'Host',
  "Maître d'hôtel": "Maître d'",
  'Afficher plus': 'Show more',
  '(sans emploi)': '(no job)',
  'NIP : 4 à 6 chiffres.': 'PIN: 4 to 6 digits.',
  '🔒 NIP activé': '🔒 PIN enabled',
  'NIP incorrect': 'Wrong PIN',
  'Aucune erreur enregistrée.': 'No errors logged.',
  'Quart modifié': 'Shift updated',
  'Quart supprimé': 'Shift deleted',
  'Suppression annulée': 'Deletion undone',
  'Réglages enregistrés': 'Settings saved',
  'Exemples chargés': 'Samples loaded',
  'Sauvegarde créée': 'Backup created',
  'NIP retiré': 'PIN removed',
  'Entre tes heures': 'Enter your hours',
  'Tes insights': 'Your insights',
  'Meilleur jour': 'Best day',
  'Meilleur quart': 'Best shift',
  'Tendance semaine': 'Weekly trend',
  "Reste pour l'objectif semaine": 'Left to weekly goal',
  'vs semaine passée à ce jour': 'vs last week to date',
  'Retenues estimées': 'Estimated deductions',
  'Revenu brut reçu': 'Gross received',
  'Impôt du Québec': 'Québec tax',
  'Assurance-emploi': 'Employment Insurance',
  RRQ: 'QPP',
  RQAP: 'QPIP',
  'Pense à sauvegarder tes données (dernière sauvegarde il y a plus de 7 jours).':
    'Remember to back up your data (last backup over 7 days ago).',
  'Ton ancien NIP a été retiré : crée un nouveau NIP (plus sûr) dans Réglages.':
    'Your old PIN was removed: create a new, safer PIN in Settings.',
};
let langue = 'fr';
let obs = null;
const ATTRS = ['placeholder', 'aria-label'];

/**
 * Traduit une chaîne française selon la langue active.
 * @param {string} fr
 * @returns {string}
 */
export function t(fr) {
  return langue === 'en' && EN[fr] ? EN[fr] : fr;
}

/**
 * Traduit un nœud et ses descendants (texte, placeholder, aria-label).
 * @param {Node} root
 */
function traduire(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let nd = w.nextNode(); nd; nd = w.nextNode()) {
    const k = nd.nodeValue.trim();
    if (k && EN[k]) {
      nd._fr = nd._fr || nd.nodeValue;
      nd.nodeValue = nd.nodeValue.replace(k, EN[k]);
    }
  }
  if (root.querySelectorAll)
    for (const el of root.querySelectorAll('[placeholder],[aria-label]'))
      for (const a of ATTRS) {
        const v = el.getAttribute(a);
        if (v && EN[v]) el.setAttribute(a, EN[v]);
      }
}

/**
 * Active une langue ('fr' ou 'en'). Le retour au français recharge la page.
 * @param {string} l
 */
export function appliquerLangue(l) {
  const avant = langue;
  langue = l === 'en' ? 'en' : 'fr';
  document.documentElement.lang = langue === 'en' ? 'en-CA' : 'fr-CA';
  const b = document.getElementById('lang');
  if (b) {
    b.textContent = langue === 'en' ? 'FR' : 'EN';
    b.setAttribute('aria-label', langue === 'en' ? 'FR : passer en français' : 'EN : changer de langue (English)');
  }
  if (langue === 'en') {
    traduire(document.body);
    if (!obs) {
      obs = new MutationObserver((ms) => {
        for (const m of ms) for (const nd of m.addedNodes) traduire(nd.nodeType === 3 ? nd.parentNode : nd);
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }
  } else if (avant === 'en') location.reload();
}
