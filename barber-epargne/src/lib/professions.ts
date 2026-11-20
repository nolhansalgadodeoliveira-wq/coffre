// Catalogue des métiers à revenus variables, et leurs catégories de recettes et de dépenses.
//
// Sélection : les métiers sans revenu fixe les plus répandus en France (artisans du bâtiment, commerce,
// transport de personnes et livraison, services à la personne, santé libérale, beauté, conseil et
// numérique, création, enseignement, restauration, agriculture, immobilier…). Les métiers salariés à
// revenu fixe ne sont pas couverts : l'app ne leur apporte rien. Un métier non reconnu reçoit le
// modèle « Indépendant » générique, entièrement modifiable.
//
// `keepPct` : part gardée par défaut sur l'encaissé (100 % pour un indépendant ; 50 % pour un barbier en salon).

import type { CategoryDef } from './types'

export interface Profession {
  id: string
  label: string
  emoji: string
  /** Mots qui désignent ce métier (sans accents, au singulier). */
  keywords: string[]
  keepPct: number
  /** Jours travaillés par défaut (0 = dimanche … 6 = samedi). */
  workdays: number[]
  income: CategoryDef[]
  expenses: CategoryDef[]
}

const c = (id: string, label: string, emoji: string, kind?: CategoryDef['kind']): CategoryDef => ({ id, label, emoji, ...(kind ? { kind } : {}) })

// Dépenses communes à la plupart des indépendants.
const COTIS = c('cotisations', 'Cotisations et impôts', '🧾')
const ASSUR = c('assurance', 'Assurances', '🛡️')
const VEHIC = c('vehicule', 'Carburant et véhicule', '⛽')
const TEL = c('telephone', 'Téléphone et abonnements', '📱')
const LOYER = c('loyer', 'Loyer du local', '🏠')
const MATOS = c('materiel', 'Matériel et outillage', '🧰')
const DEPL = c('deplacements', 'Déplacements', '🚆')
const LOGI = c('logiciels', 'Logiciels et abonnements', '💻')
const FORMA = c('formation', 'Formation', '🎓')
const PUB = c('publicite', 'Publicité', '📣')
const COMPTA = c('comptable', 'Comptable et banque', '🏦')
const PLATEF = c('plateforme', 'Commissions des plateformes', '🌐')
const EXPED = c('expedition', 'Expédition et emballages', '📦')
const TIPS = c('pourboires', 'Pourboires', '💶', 'tips')
const SEMAINE = [1, 2, 3, 4, 5]
const MARDI_SAMEDI = [2, 3, 4, 5, 6]

export const PROFESSIONS: Profession[] = [
  // ---- Beauté ----
  {
    id: 'barbier',
    label: 'Barbier, coiffeur',
    emoji: '💈',
    keywords: ['barbier', 'barber', 'coiffeur', 'coiffeuse', 'coiffure', 'barberie', 'salon de coiffure'],
    keepPct: 50,
    workdays: [6, 0],
    income: [c('coupes', 'Coupes au salon', '✂️'), c('produits', 'Produits vendus', '🧴'), TIPS, c('domicile', 'À domicile', '🏠', 'home')],
    expenses: [],
  },
  {
    id: 'esthetique',
    label: 'Esthéticienne, ongles, maquillage',
    emoji: '💅',
    keywords: ['estheticienne', 'esthetique', 'esthetic', 'prothesiste ongulaire', 'ongle', 'onglerie', 'nail', 'maquilleuse', 'maquillage', 'make up', 'cil', 'extension de cil', 'epilation', 'institut de beaute', 'beaute', 'soin du visage', 'sourcil', 'microblading'],
    keepPct: 100,
    workdays: MARDI_SAMEDI,
    income: [c('prestations', 'Prestations', '💅'), c('produits', 'Produits vendus', '🧴'), TIPS, c('domicile', 'À domicile', '🏠')],
    expenses: [c('consommables', 'Produits et consommables', '🧴'), LOYER, MATOS, FORMA, PUB, ASSUR, COTIS],
  },
  {
    id: 'tatoueur',
    label: 'Tatoueur, pierceur',
    emoji: '🖋️',
    keywords: ['tatoueur', 'tatoueuse', 'tatouage', 'tattoo', 'pierceur', 'piercing', 'perceur'],
    keepPct: 100,
    workdays: MARDI_SAMEDI,
    income: [c('tatouages', 'Tatouages', '🖋️'), c('piercings', 'Piercings', '💎'), c('bijoux', 'Bijoux et soins vendus', '🧴'), TIPS],
    expenses: [c('consommables', 'Encres et consommables', '🖋️'), c('reversion', 'Part reversée au shop', '🏪'), MATOS, LOYER, ASSUR, COTIS],
  },
  // ---- Bâtiment et artisans ----
  {
    id: 'clim',
    label: 'Climatisation, chauffage, plomberie',
    emoji: '🔧',
    keywords: ['climatisation', 'clim', 'climaticien', 'frigoriste', 'froid', 'chauffagiste', 'chauffage', 'pompe a chaleur', 'pac', 'plombier', 'plomberie', 'sanitaire', 'cvc', 'genie climatique', 'ventilation', 'chaudiere', 'thermique'],
    keepPct: 100,
    workdays: SEMAINE,
    income: [c('installations', 'Installations', '🛠️'), c('depannages', 'Dépannages', '🚨'), c('entretiens', 'Entretiens et contrats', '🔁'), c('vente', 'Matériel revendu', '📦')],
    expenses: [c('fournitures', 'Fournitures et pièces', '🔩'), MATOS, VEHIC, c('soustraitance', 'Sous-traitance', '🤝'), c('decennale', 'Assurance décennale', '🛡️'), TEL, COMPTA, COTIS],
  },
  {
    id: 'electricien',
    label: 'Électricien, domotique',
    emoji: '⚡',
    keywords: ['electricien', 'electricite', 'electrique', 'domotique', 'borne de recharge', 'irve', 'alarme', 'videosurveillance', 'antenniste', 'fibre', 'courant faible'],
    keepPct: 100,
    workdays: SEMAINE,
    income: [c('chantiers', 'Chantiers', '🏗️'), c('depannages', 'Dépannages', '🚨'), c('mises', 'Mises aux normes, diagnostics', '📋'), c('vente', 'Matériel revendu', '📦')],
    expenses: [c('fournitures', 'Fournitures et câbles', '🔌'), MATOS, VEHIC, c('soustraitance', 'Sous-traitance', '🤝'), c('decennale', 'Assurance décennale', '🛡️'), TEL, COMPTA, COTIS],
  },
  {
    id: 'batiment',
    label: 'Bâtiment, rénovation',
    emoji: '🧱',
    keywords: ['macon', 'maconnerie', 'batiment', 'btp', 'renovation', 'peintre', 'peinture', 'plaquiste', 'platrier', 'carreleur', 'carrelage', 'menuisier', 'menuiserie', 'charpentier', 'couvreur', 'toiture', 'facade', 'facadier', 'solier', 'parquet', 'isolation', 'terrassement', 'terrassier', 'multiservice', 'bricolage', 'homme toutes mains', 'serrurier', 'serrurerie', 'vitrier', 'metallier', 'soudeur', 'cuisiniste', 'poseur', 'agenceur', 'ebeniste', 'piscine', 'pisciniste', 'demolition', 'enduit', 'charpente', 'zingueur', 'etancheite', 'second oeuvre', 'gros oeuvre', 'artisan'],
    keepPct: 100,
    workdays: SEMAINE,
    income: [c('chantiers', 'Chantiers', '🏗️'), c('petits', 'Petits travaux, dépannages', '🔨'), c('fournitures-fact', 'Fournitures refacturées', '📦')],
    expenses: [c('materiaux', 'Matériaux', '🧱'), c('location', 'Location d’engins', '🚜'), MATOS, VEHIC, c('soustraitance', 'Sous-traitance', '🤝'), c('decennale', 'Assurance décennale', '🛡️'), COMPTA, COTIS],
  },
  {
    id: 'paysagiste',
    label: 'Paysagiste, jardinier',
    emoji: '🌳',
    keywords: ['paysagiste', 'jardinier', 'jardinage', 'espace vert', 'elagueur', 'elagage', 'tonte', 'entretien de jardin', 'arboriste', 'debroussaillage'],
    keepPct: 100,
    workdays: SEMAINE,
    income: [c('entretien', 'Entretien de jardins', '🌿'), c('creation', 'Création, aménagement', '🌳'), c('elagage', 'Élagage', '🪓')],
    expenses: [c('vegetaux', 'Végétaux et fournitures', '🌱'), MATOS, VEHIC, c('dechets', 'Déchets verts', '♻️'), ASSUR, COTIS],
  },
  {
    id: 'mecanique',
    label: 'Mécanique, carrosserie',
    emoji: '🚗',
    keywords: ['mecanicien', 'mecanique', 'garagiste', 'garage', 'carrossier', 'carrosserie', 'depanneur auto', 'pneu', 'vidange', 'reparation auto', 'moto mecanique', 'controle technique', 'detailing', 'lavage auto', 'preparateur esthetique automobile'],
    keepPct: 100,
    workdays: SEMAINE,
    income: [c('reparations', 'Réparations', '🔧'), c('entretiens', 'Entretiens', '🛢️'), c('pieces', 'Pièces revendues', '⚙️')],
    expenses: [c('pieces-achat', 'Pièces et fournitures', '⚙️'), MATOS, LOYER, ASSUR, TEL, COTIS],
  },
  // ---- Transport ----
  {
    id: 'vtc',
    label: 'VTC, taxi',
    emoji: '🚖',
    keywords: ['vtc', 'taxi', 'chauffeur', 'uber', 'bolt', 'heetch', 'chauffeur prive', 'transport de personne', 'ambulancier', 'chauffeur vtc'],
    keepPct: 100,
    workdays: [1, 2, 3, 4, 5, 6],
    income: [c('plateformes', 'Courses en application', '📱'), c('directes', 'Courses directes, clients', '🤝'), TIPS],
    expenses: [c('carburant', 'Carburant ou recharge', '⛽'), c('voiture', 'Location ou crédit voiture', '🚗'), PLATEF, c('entretien', 'Entretien et lavage', '🧽'), c('peages', 'Péages et parking', '🅿️'), ASSUR, TEL, COTIS],
  },
  {
    id: 'livreur',
    label: 'Livreur, coursier',
    emoji: '🛵',
    keywords: ['livreur', 'livraison', 'coursier', 'deliveroo', 'uber eats', 'ubereats', 'stuart', 'frichti', 'just eat', 'colis', 'messagerie'],
    keepPct: 100,
    workdays: [1, 2, 3, 4, 5, 6, 0],
    income: [c('livraisons', 'Livraisons', '🛵'), c('bonus', 'Bonus, primes', '⭐'), TIPS],
    expenses: [c('carburant', 'Carburant ou recharge', '⛽'), c('entretien', 'Entretien du véhicule', '🔧'), c('equipement', 'Équipement', '🎒'), TEL, ASSUR, COTIS],
  },
  {
    id: 'transport',
    label: 'Transport, déménagement',
    emoji: '🚚',
    keywords: ['demenageur', 'demenagement', 'transporteur', 'transport de marchandise', 'routier', 'chauffeur poids lourd', 'logistique', 'debarras', 'enlevement', 'convoyeur', 'chauffeur livreur'],
    keepPct: 100,
    workdays: SEMAINE,
    income: [c('missions', 'Transports, déménagements', '🚚'), c('manutention', 'Manutention, débarras', '📦')],
    expenses: [c('carburant', 'Carburant', '⛽'), c('location', 'Location ou crédit camion', '🚛'), c('peages', 'Péages', '🛣️'), c('entretien', 'Entretien du véhicule', '🔧'), ASSUR, COTIS],
  },
  // ---- Commerce, restauration ----
  {
    id: 'commerce',
    label: 'Commerce, boutique, marchés',
    emoji: '🛍️',
    keywords: ['commercant', 'commerce', 'boutique', 'magasin', 'marche', 'forain', 'vendeur', 'epicerie', 'fleuriste', 'caviste', 'librairie', 'tabac', 'buraliste', 'opticien', 'pressing', 'cordonnier', 'retoucherie', 'bijouterie', 'friperie', 'concept store'],
    keepPct: 100,
    workdays: MARDI_SAMEDI,
    income: [c('boutique', 'Ventes en boutique', '🛍️'), c('marches', 'Marchés, salons', '🎪'), c('enligne', 'Ventes en ligne', '🌐')],
    expenses: [c('marchandises', 'Achats de marchandises', '📦'), LOYER, c('energie', 'Électricité, eau', '💡'), c('personnel', 'Salaires', '👥'), COMPTA, PUB, COTIS],
  },
  {
    id: 'ecommerce',
    label: 'Vente en ligne, revente',
    emoji: '📦',
    keywords: ['e commerce', 'ecommerce', 'vente en ligne', 'revendeur', 'revente', 'vinted', 'leboncoin', 'amazon', 'etsy', 'dropshipping', 'shopify', 'achat revente', 'sneakers', 'resell'],
    keepPct: 100,
    workdays: SEMAINE,
    income: [c('ventes', 'Ventes', '🛒'), c('plateformes-v', 'Ventes sur plateformes', '🌐')],
    expenses: [c('stock', 'Achats de stock', '📦'), PLATEF, EXPED, PUB, LOGI, COTIS],
  },
  {
    id: 'restauration',
    label: 'Restauration, food truck, traiteur',
    emoji: '🍽️',
    keywords: ['restaurateur', 'restaurant', 'restauration', 'food truck', 'foodtruck', 'traiteur', 'snack', 'kebab', 'pizzeria', 'pizzaiolo', 'boulanger', 'boulangerie', 'patissier', 'patisserie', 'chocolatier', 'boucher', 'boucherie', 'cuisinier', 'chef a domicile', 'bar', 'cafe', 'glacier', 'creperie', 'burger', 'dark kitchen'],
    keepPct: 100,
    workdays: MARDI_SAMEDI,
    income: [c('surplace', 'Ventes sur place', '🍽️'), c('emporter', 'À emporter, livraison', '🥡'), c('evenements', 'Traiteur, événements', '🎉')],
    expenses: [c('matieres', 'Matières premières', '🥕'), c('emballages', 'Emballages', '🥡'), LOYER, c('energie', 'Énergie, gaz', '🔥'), c('personnel', 'Salaires', '👥'), PLATEF, COTIS],
  },
  {
    id: 'serveur',
    label: 'Serveur, barman (pourboires, extras)',
    emoji: '🍸',
    keywords: ['serveur', 'serveuse', 'barman', 'barmaid', 'extra', 'extras', 'hotellerie', 'chef de rang', 'runner', 'plonge', 'saisonnier', 'barista'],
    keepPct: 100,
    workdays: [3, 4, 5, 6, 0],
    income: [c('extras', 'Extras, missions', '🍸'), TIPS],
    expenses: [DEPL, c('tenue', 'Tenue de travail', '👔')],
  },
  // ---- Santé, bien-être, services ----
  {
    id: 'sante',
    label: 'Santé libérale',
    emoji: '🩺',
    keywords: ['infirmier', 'infirmiere', 'idel', 'kine', 'kinesitherapeute', 'osteopathe', 'osteo', 'orthophoniste', 'sage femme', 'medecin', 'dentiste', 'podologue', 'pedicure', 'orthoptiste', 'ergotherapeute', 'psychomotricien', 'dieteticien', 'nutritionniste', 'chiropracteur', 'pharmacien', 'veterinaire', 'liberal', 'liberale', 'audioprothesiste'],
    keepPct: 100,
    workdays: SEMAINE,
    income: [c('cabinet', 'Consultations au cabinet', '🩺'), c('domicile', 'Actes à domicile', '🏠'), c('autres-actes', 'Autres actes', '📋')],
    expenses: [c('loyer-cab', 'Loyer du cabinet', '🏥'), c('fournitures', 'Matériel et fournitures', '🧪'), VEHIC, c('rcp', 'Assurance RCP', '🛡️'), LOGI, FORMA, COMPTA, COTIS],
  },
  {
    id: 'bienetre',
    label: 'Bien-être, thérapies',
    emoji: '💆',
    keywords: ['masseur', 'masseuse', 'massage', 'naturopathe', 'sophrologue', 'hypnotherapeute', 'hypnose', 'psychologue', 'psy', 'therapeute', 'reflexologue', 'energeticien', 'reiki', 'doula', 'coach de vie', 'praticien bien etre', 'acupuncteur', 'magnetiseur', 'spa'],
    keepPct: 100,
    workdays: SEMAINE,
    income: [c('seances', 'Séances', '💆'), c('forfaits', 'Forfaits, cures', '🎟️'), c('ateliers', 'Ateliers, stages', '👥')],
    expenses: [c('loyer-cab', 'Loyer du cabinet', '🏠'), c('fournitures', 'Huiles et fournitures', '🧴'), FORMA, PUB, c('rcp', 'Assurance RCP', '🛡️'), COTIS],
  },
  {
    id: 'domicile',
    label: 'Ménage, aide à domicile, garde d’enfants',
    emoji: '🧹',
    keywords: ['menage', 'femme de menage', 'aide menagere', 'aide a domicile', 'auxiliaire de vie', 'nettoyage', 'agent d entretien', 'repassage', 'baby sitter', 'babysitter', 'baby sitting', 'nounou', 'garde d enfant', 'assistante maternelle', 'aide aux seniors', 'conciergerie', 'concierge', 'laveur de vitre', 'nettoyage de bureau'],
    keepPct: 100,
    workdays: SEMAINE,
    income: [c('heures', 'Heures de service', '🧹'), c('forfaits', 'Forfaits, contrats', '📋'), TIPS],
    expenses: [c('produits', 'Produits et matériel', '🧴'), DEPL, ASSUR, COTIS],
  },
  {
    id: 'animaux',
    label: 'Animaux : toilettage, garde',
    emoji: '🐶',
    keywords: ['toiletteur', 'toiletteuse', 'toilettage', 'pet sitter', 'petsitter', 'promeneur de chien', 'dog sitter', 'educateur canin', 'comportementaliste', 'pension canine', 'marechal ferrant', 'eleveur'],
    keepPct: 100,
    workdays: MARDI_SAMEDI,
    income: [c('prestations', 'Toilettages, gardes', '🐶'), c('promenades', 'Promenades, éducation', '🦮'), c('produits', 'Produits vendus', '🦴')],
    expenses: [c('produits-a', 'Produits et fournitures', '🧴'), MATOS, VEHIC, LOYER, ASSUR, COTIS],
  },
  // ---- Enseignement, sport ----
  {
    id: 'coach',
    label: 'Coach sportif, prof de sport',
    emoji: '🏋️',
    keywords: ['coach sportif', 'coach', 'personal trainer', 'preparateur physique', 'prof de sport', 'educateur sportif', 'yoga', 'pilates', 'professeur de yoga', 'moniteur', 'moniteur de ski', 'surf', 'maitre nageur', 'danse', 'professeur de danse', 'boxe', 'arts martiaux', 'equitation', 'golf', 'tennis', 'guide de montagne', 'escalade'],
    keepPct: 100,
    workdays: [1, 2, 3, 4, 5, 6],
    income: [c('individuels', 'Séances individuelles', '🏋️'), c('collectifs', 'Cours collectifs', '👥'), c('abonnements', 'Abonnements, programmes', '🔁')],
    expenses: [c('salle', 'Location de salle', '🏟️'), MATOS, DEPL, c('rcp', 'Assurance RC', '🛡️'), FORMA, COTIS],
  },
  {
    id: 'enseignement',
    label: 'Cours particuliers, formation',
    emoji: '🎓',
    keywords: ['professeur', 'prof', 'cours particulier', 'soutien scolaire', 'tuteur', 'formateur', 'formation', 'enseignant', 'moniteur auto ecole', 'auto ecole', 'professeur de musique', 'professeur de langue', 'aide aux devoirs', 'orthopedagogue'],
    keepPct: 100,
    workdays: SEMAINE,
    income: [c('cours', 'Cours', '📚'), c('formations', 'Formations, ateliers', '🎓')],
    expenses: [c('supports', 'Supports et fournitures', '📚'), DEPL, LOGI, COTIS],
  },
  // ---- Conseil, numérique, création ----
  {
    id: 'freelance',
    label: 'Freelance informatique, conseil',
    emoji: '💻',
    keywords: ['developpeur', 'dev', 'developpeuse', 'freelance', 'informaticien', 'informatique', 'consultant', 'consultante', 'conseil', 'data', 'web', 'webmaster', 'integrateur', 'devops', 'chef de projet', 'product owner', 'no code', 'ingenieur', 'cybersecurite', 'technicien informatique', 'depannage informatique', 'business developer', 'growth'],
    keepPct: 100,
    workdays: SEMAINE,
    income: [c('missions', 'Missions (TJM)', '💼'), c('forfaits', 'Projets au forfait', '📋'), c('maintenance', 'Maintenance, abonnements', '🔁')],
    expenses: [LOGI, c('ordinateur', 'Matériel informatique', '💻'), c('coworking', 'Coworking, bureau', '🏢'), DEPL, FORMA, COMPTA, COTIS],
  },
  {
    id: 'creatif',
    label: 'Graphisme, rédaction, communication',
    emoji: '✏️',
    keywords: ['graphiste', 'designer', 'design', 'ux', 'ui', 'directeur artistique', 'illustrateur', 'motion designer', 'community manager', 'social media', 'redacteur', 'redactrice', 'copywriter', 'traducteur', 'traductrice', 'interprete', 'correcteur', 'journaliste', 'pigiste', 'monteur', 'monteuse video', 'assistant virtuel', 'secretaire independante', 'marketing', 'seo', 'architecte', 'decorateur', 'architecte d interieur'],
    keepPct: 100,
    workdays: SEMAINE,
    income: [c('projets', 'Projets', '✏️'), c('abonnements', 'Clients au mois', '🔁'), c('droits', 'Droits, ventes', '©️')],
    expenses: [LOGI, c('ordinateur', 'Matériel', '💻'), FORMA, PUB, COMPTA, COTIS],
  },
  {
    id: 'photo',
    label: 'Photographe, vidéaste',
    emoji: '📷',
    keywords: ['photographe', 'photo', 'videaste', 'video', 'cameraman', 'realisateur', 'drone', 'telepilote', 'photographe mariage', 'shooting'],
    keepPct: 100,
    workdays: [3, 4, 5, 6, 0],
    income: [c('shootings', 'Shootings', '📷'), c('evenements', 'Mariages, événements', '💍'), c('ventes', 'Tirages, droits', '🖼️')],
    expenses: [c('equipement', 'Matériel photo, vidéo', '🎥'), LOGI, DEPL, ASSUR, PUB, COTIS],
  },
  {
    id: 'artiste',
    label: 'Musicien, DJ, artiste',
    emoji: '🎵',
    keywords: ['musicien', 'musicienne', 'dj', 'chanteur', 'chanteuse', 'artiste', 'comedien', 'comedienne', 'intermittent', 'animateur', 'magicien', 'humoriste', 'danseur', 'peintre artiste', 'sculpteur', 'plasticien', 'performer', 'beatmaker', 'producteur de musique'],
    keepPct: 100,
    workdays: [4, 5, 6],
    income: [c('cachets', 'Cachets, prestations', '🎤'), c('cours', 'Cours', '🎓'), c('ventes', 'Ventes, droits, streaming', '💿')],
    expenses: [c('equipement', 'Matériel, instruments', '🎛️'), DEPL, c('studio', 'Studio, répétitions', '🎙️'), PUB, COTIS],
  },
  {
    id: 'createur',
    label: 'Créateur de contenu',
    emoji: '📱',
    keywords: ['createur de contenu', 'influenceur', 'influenceuse', 'youtubeur', 'youtuber', 'tiktokeur', 'streamer', 'twitch', 'instagram', 'ugc', 'podcasteur', 'blogueur'],
    keepPct: 100,
    workdays: SEMAINE,
    income: [c('partenariats', 'Partenariats, marques', '🤝'), c('plateformes', 'Revenus des plateformes', '📺'), c('affiliation', 'Affiliation, produits', '🔗')],
    expenses: [c('equipement', 'Matériel', '🎥'), LOGI, c('montage', 'Montage, aides', '🎬'), DEPL, COTIS],
  },
  {
    id: 'artisanart',
    label: 'Créations faites main, couture',
    emoji: '🧵',
    keywords: ['couturiere', 'couturier', 'couture', 'retouche', 'createur', 'creatrice', 'fait main', 'bijoux', 'bijoutier', 'ceramiste', 'potier', 'maroquinier', 'tapissier', 'artisan d art', 'tricot', 'crochet', 'bougie', 'savon', 'cosmetique artisanale', 'imprimeur', 'brodeur', 'brodeuse', 'fleuriste evenementiel'],
    keepPct: 100,
    workdays: SEMAINE,
    income: [c('ventes', 'Créations vendues', '🧵'), c('commandes', 'Commandes sur mesure', '✂️'), c('marches', 'Marchés, salons', '🎪')],
    expenses: [c('matieres', 'Matières premières', '🧶'), PLATEF, EXPED, MATOS, c('stand', 'Stands, salons', '🎪'), COTIS],
  },
  {
    id: 'liberal',
    label: 'Profession libérale (avocat, comptable…)',
    emoji: '⚖️',
    keywords: ['avocat', 'avocate', 'notaire', 'huissier', 'commissaire de justice', 'expert comptable', 'comptable', 'juriste', 'geometre', 'expert', 'architecte dplg', 'mediateur', 'commissaire aux comptes', 'agent general d assurance', 'diagnostiqueur', 'diagnostic immobilier', 'economiste de la construction'],
    keepPct: 100,
    workdays: SEMAINE,
    income: [c('honoraires', 'Honoraires', '⚖️'), c('forfaits', 'Forfaits, abonnements clients', '🔁'), c('debours', 'Frais refacturés', '📋')],
    expenses: [c('loyer-cab', 'Loyer du cabinet', '🏢'), LOGI, c('rcp', 'Assurance RCP', '🛡️'), FORMA, c('personnel', 'Salaires, collaborateurs', '👥'), COMPTA, COTIS],
  },
  // ---- Immobilier, vente à la commission ----
  {
    id: 'immobilier',
    label: 'Agent immobilier, commercial à la commission',
    emoji: '🏡',
    keywords: ['agent immobilier', 'immobilier', 'mandataire', 'negociateur', 'courtier', 'commercial', 'commerciale', 'vrp', 'agent commercial', 'apporteur d affaire', 'conseiller immobilier', 'chasseur immobilier', 'assurance courtier', 'conseiller en patrimoine', 'cgp', 'vdi', 'vente a domicile', 'vendeur a domicile', 'marketing de reseau'],
    keepPct: 100,
    workdays: [1, 2, 3, 4, 5, 6],
    income: [c('commissions', 'Commissions', '🤝'), c('honoraires', 'Honoraires, frais', '📋'), c('primes', 'Primes', '⭐')],
    expenses: [c('reseau', 'Frais du réseau', '🏢'), VEHIC, PUB, TEL, FORMA, COTIS],
  },
  {
    id: 'location',
    label: 'Location courte durée, conciergerie',
    emoji: '🔑',
    keywords: ['airbnb', 'location courte duree', 'location saisonniere', 'gite', 'chambre d hote', 'loueur', 'loueur meuble', 'lmnp', 'booking', 'hote'],
    keepPct: 100,
    workdays: [5, 6, 0],
    income: [c('reservations', 'Réservations', '🔑'), c('menage-fact', 'Ménage facturé', '🧺')],
    expenses: [c('menage', 'Ménage et linge', '🧺'), PLATEF, c('charges', 'Charges, énergie', '💡'), c('credit', 'Crédit ou loyer', '🏦'), c('equipement', 'Équipement', '🛋️'), c('taxes', 'Taxes', '🧾')],
  },
  // ---- Agriculture ----
  {
    id: 'agriculture',
    label: 'Agriculture, maraîchage',
    emoji: '🌾',
    keywords: ['agriculteur', 'agricultrice', 'maraicher', 'maraichage', 'eleveur', 'apiculteur', 'viticulteur', 'vigneron', 'arboriculteur', 'horticulteur', 'paysan', 'exploitant agricole', 'cueillette', 'ferme', 'producteur', 'pecheur', 'marin pecheur', 'ostreiculteur', 'conchyliculteur', 'forestier', 'bucheron'],
    keepPct: 100,
    workdays: [1, 2, 3, 4, 5, 6],
    income: [c('directes', 'Ventes directes', '🧺'), c('gros', 'Ventes aux professionnels', '🚛'), c('aides', 'Aides, primes', '📋')],
    expenses: [c('intrants', 'Semences, plants, aliments', '🌱'), c('carburant', 'Carburant', '⛽'), MATOS, c('engrais', 'Engrais, traitements', '🧪'), ASSUR, COTIS],
  },
]

/** Modèle générique : tout indépendant non reconnu (entièrement modifiable). */
export const GENERIC: Profession = {
  id: 'independant',
  label: 'Indépendant',
  emoji: '💼',
  keywords: [],
  keepPct: 100,
  workdays: SEMAINE,
  income: [c('prestations', 'Prestations', '💼'), c('ventes', 'Ventes', '🛒')],
  expenses: [MATOS, VEHIC, LOYER, TEL, ASSUR, COTIS],
}

export const BARBER = PROFESSIONS[0]

export const normalize = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const STOP = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'a', 'au', 'aux', 'en', 'et', 'un', 'une', 'je', 'suis', 'j', 'fais', 'travaille', 'dans', 'chez', 'pour', 'mon', 'ma', 'independant', 'independante', 'auto', 'entrepreneur', 'micro', 'freelance'])

/** Distance d'édition limitée (fautes de frappe). */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      best = Math.min(best, cur[j])
    }
    if (best > max) return max + 1
    prev = cur
  }
  return prev[b.length]
}

function wordScore(q: string, w: string): number {
  if (q === w) return 100
  if (w.startsWith(q) && q.length >= 3) return 60 + Math.min(20, q.length * 3)
  if (q.startsWith(w) && w.length >= 3 && q.length - w.length <= 3) return 75 // pluriel, féminin
  if (q.length >= 5 && w.length >= 5 && distance(q, w, 1) === 1) return 55 // une faute de frappe
  return 0
}

/**
 * Métiers les plus proches de ce que la personne a tapé (« installateur clim », « je fais du Uber »…),
 * du meilleur au moins bon. Vide si rien ne ressemble.
 */
export function searchProfessions(text: string, limit = 4): Profession[] {
  const full = ` ${normalize(text)} `
  const words = normalize(text)
    .split(' ')
    .filter((w) => w && !STOP.has(w))
  if (words.length === 0 && full.trim() === '') return []
  const scored: { p: Profession; score: number; i: number }[] = []
  PROFESSIONS.forEach((p, i) => {
    let score = 0
    for (const k of p.keywords) {
      // Expression complète présente (« pompe a chaleur », « uber eats »).
      if (k.includes(' ') && full.includes(` ${k} `)) score = Math.max(score, 120 + k.length)
    }
    for (const q of words) {
      let best = 0
      for (const k of p.keywords) for (const w of k.split(' ')) if (!STOP.has(w)) best = Math.max(best, wordScore(q, w))
      for (const w of normalize(p.label).split(' ')) best = Math.max(best, wordScore(q, w) * 0.9)
      score += best
    }
    if (score > 0) scored.push({ p, score, i })
  })
  scored.sort((a, b) => b.score - a.score || a.i - b.i)
  return scored.slice(0, limit).map((s) => s.p)
}

export const findProfession = (id?: string) => PROFESSIONS.find((p) => p.id === id) ?? (id === GENERIC.id ? GENERIC : undefined)
