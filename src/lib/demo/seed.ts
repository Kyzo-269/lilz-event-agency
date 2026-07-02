// Données fictives pour la démo — jamais persistées, uniquement en mémoire côté navigateur.
// Ce fichier alimente le faux client Supabase (voir mockClient.ts) quand
// NEXT_PUBLIC_DEMO_MODE=true. Aucune connexion à une vraie base n'a lieu.

let uidCounter = 1000;
export function genId(prefix = "demo") {
  uidCounter += 1;
  return `${prefix}-${uidCounter}`;
}

const today = new Date();
function iso(daysOffset = 0, hh = 12, mm = 0) {
  const d = new Date(today);
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}
function dateOnly(daysOffset = 0) {
  const d = new Date(today);
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().slice(0, 10);
}

export const demoProfiles = [
  { id: "u-ceo",     full_name: "Camille Reynaud",   role: "CEO",                          email: "camille@lilzagency.fr",  last_seen: iso(0, 9, 12),  statut_presence: "Disponible" },
  { id: "u-admin",   full_name: "Nathan Perreau",    role: "Admin",                        email: "nathan@lilzagency.fr",   last_seen: iso(0, 9, 40),  statut_presence: "Disponible" },
  { id: "u-cpe",     full_name: "Léa Dubosc",        role: "Chef de Projet Événementiel",  email: "lea@lilzagency.fr",      last_seen: iso(0, 10, 5),  statut_presence: "Sur scène" },
  { id: "u-cm",      full_name: "Yanis Kaddour",     role: "Community Manager",            email: "yanis@lilzagency.fr",    last_seen: iso(0, 8, 55),  statut_presence: "Disponible" },
  { id: "u-site",    full_name: "Inès Fontaine",     role: "Site Manager",                 email: "ines@lilzagency.fr",     last_seen: iso(0, 9, 20),  statut_presence: "En déplacement" },
  { id: "u-adv",     full_name: "Marc-Aurèle Simon", role: "Advisor",                      email: "marc@lilzagency.fr",     last_seen: iso(-1, 18, 0), statut_presence: "Hors ligne" },
  { id: "u-fin",     full_name: "Sofia Benali",      role: "Responsable Financier",        email: "sofia@lilzagency.fr",    last_seen: iso(0, 9, 0),   statut_presence: "Disponible" },
  { id: "u-ep",      full_name: "Hugo Lemercier",    role: "Event Planner",                email: "hugo@lilzagency.fr",     last_seen: iso(0, 9, 47),  statut_presence: "En pause" },
  { id: "u-reg1",    full_name: "Bastien Roche",     role: "Régisseur de production 1",    email: "bastien@lilzagency.fr",  last_seen: iso(0, 10, 12), statut_presence: "Sur scène" },
  { id: "u-reg2",    full_name: "Chloé Vasseur",     role: "Régisseur de production 2",    email: "chloe@lilzagency.fr",    last_seen: iso(0, 10, 15), statut_presence: "Sur scène" },
  { id: "u-reg3",    full_name: "Théo Guillard",     role: "Régisseur de production 3",    email: "theo@lilzagency.fr",     last_seen: iso(0, 9, 30),  statut_presence: "Disponible" },
];

export const demoEvenements = [
  { id: "ev-1", nom: "Soirée Blanche — Rooftop 33",        date: dateOnly(3),  lieu: "Rooftop 33, Lyon",            description: "Soirée thématique all-white, DJ set + photobooth.",           statut: "Confirmé",      created_by: "u-cpe", created_at: iso(-10) },
  { id: "ev-2", nom: "Festival Urban Sound Vol.4",         date: dateOnly(10), lieu: "Halle Tony Garnier",          description: "Festival musique urbaine, 3 scènes, 2000 places.",             statut: "En préparation", created_by: "u-cpe", created_at: iso(-25) },
  { id: "ev-3", nom: "Gala Entreprise — Groupe Alméo",     date: dateOnly(-2), lieu: "Château de Fleurville",       description: "Soirée de gala privée, 180 invités, dîner assis.",              statut: "Terminé",       created_by: "u-ep",  created_at: iso(-40) },
  { id: "ev-4", nom: "Anniversaire 30 ans — Family Club",  date: dateOnly(0),  lieu: "Family Club, Villeurbanne",   description: "Anniversaire privé, ambiance club, 250 personnes.",             statut: "En cours",      created_by: "u-cpe", created_at: iso(-15) },
  { id: "ev-5", nom: "Lancement produit — MaisonNova",     date: dateOnly(18), lieu: "Sucrière, Lyon",              description: "Soirée de lancement produit avec showcase artistique.",         statut: "En préparation", created_by: "u-adv", created_at: iso(-5)  },
  { id: "ev-6", nom: "Mariage Camille & Yohan",            date: dateOnly(-15), lieu: "Domaine de la Combe",        description: "Mariage 120 invités, cérémonie + soirée dansante.",             statut: "Terminé",       created_by: "u-ep",  created_at: iso(-60) },
];

export const demoTickets = [
  { id: "tk-1",  client_name: "Amandine Roussel",  nb_personnes: 4, statut: "Confirmée", created_at: iso(-2, 14, 20), created_by: "u-cm" },
  { id: "tk-2",  client_name: "Jules Béranger",     nb_personnes: 2, statut: "Présent",   created_at: iso(-3, 11, 5),  created_by: "u-cm" },
  { id: "tk-3",  client_name: "Sarah Idrissi",      nb_personnes: 6, statut: "Confirmée", created_at: iso(-1, 16, 40), created_by: "u-cm" },
  { id: "tk-4",  client_name: "Mehdi Larbi",        nb_personnes: 3, statut: "En attente",created_at: iso(0, 9, 15),  created_by: "u-cm" },
  { id: "tk-5",  client_name: "Chloé Fabre",        nb_personnes: 2, statut: "No-show",   created_at: iso(-4, 20, 0), created_by: "u-cm" },
  { id: "tk-6",  client_name: "Nicolas Petit",      nb_personnes: 5, statut: "Confirmée", created_at: iso(-1, 10, 10),created_by: "u-cm" },
  { id: "tk-7",  client_name: "Emma Lefebvre",      nb_personnes: 1, statut: "Présent",   created_at: iso(-2, 19, 30),created_by: "u-cm" },
  { id: "tk-8",  client_name: "Rayan Cherif",       nb_personnes: 8, statut: "Confirmée", created_at: iso(0, 8, 50),  created_by: "u-cm" },
  { id: "tk-9",  client_name: "Julie Marchand",     nb_personnes: 2, statut: "Annulée",   created_at: iso(-5, 13, 0), created_by: "u-cm" },
  { id: "tk-10", client_name: "Adam Nasri",         nb_personnes: 4, statut: "En attente",created_at: iso(0, 11, 25), created_by: "u-cm" },
];

export const demoMateriel = [
  { id: "mat-1",  type: "prevu",     nom: "Enceintes JBL PRX815",       categorie: "Son",      quantite: 4,  etat: "OK",       priorite: "Normal",   note: null,                              created_by: "u-reg1", created_at: iso(-8) },
  { id: "mat-2",  type: "prevu",     nom: "Console DJ Pioneer CDJ-3000",categorie: "Son",      quantite: 2,  etat: "OK",       priorite: "Urgent",   note: null,                              created_by: "u-reg1", created_at: iso(-8) },
  { id: "mat-3",  type: "prevu",     nom: "Projecteurs LED Par64",      categorie: "Lumière",  quantite: 12, etat: "Fragile",  priorite: "Normal",   note: "2 unités à vérifier avant départ", created_by: "u-reg2", created_at: iso(-6) },
  { id: "mat-4",  type: "prevu",     nom: "Machine à fumée",            categorie: "Lumière",  quantite: 2,  etat: "Manquant", priorite: "Urgent",   note: "Louée chez Dispro, livraison J-1", created_by: "u-reg2", created_at: iso(-3) },
  { id: "mat-5",  type: "prevu",     nom: "Praticables scène 2x1m",     categorie: "Scène",    quantite: 8,  etat: "Usé",      priorite: "Optionnel",note: null,                              created_by: "u-reg3", created_at: iso(-12) },
  { id: "mat-6",  type: "prevu",     nom: "Mange-debout",               categorie: "Mobilier", quantite: 20, etat: "OK",       priorite: "Normal",   note: null,                              created_by: "u-site", created_at: iso(-9) },
  { id: "mat-7",  type: "prevu",     nom: "Nappes blanches",            categorie: "Décor",    quantite: 15, etat: "À réparer",priorite: "Normal",   note: "3 tachées, à laver",              created_by: "u-site", created_at: iso(-9) },
  { id: "mat-8",  type: "a_prevoir",  nom: "Arche florale entrée",       categorie: "Décor",    quantite: 1,  etat: null,       priorite: "Normal",   note: "Devis fleuriste en attente",       created_by: "u-cpe",  created_at: iso(-2) },
  { id: "mat-9",  type: "a_prevoir",  nom: "Groupe électrogène 20kVA",   categorie: "Autre",    quantite: 1,  etat: null,       priorite: "Urgent",   note: "Réserver avant vendredi",          created_by: "u-reg1", created_at: iso(-1) },
  { id: "mat-10", type: "a_prevoir",  nom: "Barrières Vauban",           categorie: "Autre",    quantite: 10, etat: null,       priorite: "Optionnel",note: null,                              created_by: "u-site", created_at: iso(-1) },
];

export const demoPlanning = [
  { id: "pl-1", assigne_nom: "Bastien Roche",  assigne_role: "Régisseur de production 1", poste: "Régie son",       date: dateOnly(0), heure_debut: "14:00", heure_fin: "23:30", notes: "Balances à 15h",              created_by: "u-cpe", created_at: iso(-3) },
  { id: "pl-2", assigne_nom: "Chloé Vasseur",  assigne_role: "Régisseur de production 2", poste: "Régie lumière",   date: dateOnly(0), heure_debut: "14:00", heure_fin: "23:30", notes: null,                            created_by: "u-cpe", created_at: iso(-3) },
  { id: "pl-3", assigne_nom: "Inès Fontaine",  assigne_role: "Site Manager",               poste: "Accueil / sécurité", date: dateOnly(0), heure_debut: "18:00", heure_fin: "02:00", notes: "Briefing équipe sécu à 17h30", created_by: "u-cpe", created_at: iso(-2) },
  { id: "pl-4", assigne_nom: "Hugo Lemercier", assigne_role: "Event Planner",              poste: "Coordination générale", date: dateOnly(0), heure_debut: "13:00", heure_fin: "01:00", notes: null,                        created_by: "u-cpe", created_at: iso(-2) },
  { id: "pl-5", assigne_nom: "Théo Guillard",  assigne_role: "Régisseur de production 3",  poste: "Backline / plateau", date: dateOnly(3), heure_debut: "10:00", heure_fin: "20:00", notes: "Montage scène", created_by: "u-cpe", created_at: iso(-1) },
  { id: "pl-6", assigne_nom: "Léa Dubosc",     assigne_role: "Chef de Projet Événementiel",poste: "Supervision",     date: dateOnly(3), heure_debut: "10:00", heure_fin: "23:00", notes: null,                            created_by: "u-cpe", created_at: iso(-1) },
  { id: "pl-7", assigne_nom: "Yanis Kaddour",  assigne_role: "Community Manager",          poste: "Couverture réseaux sociaux", date: dateOnly(3), heure_debut: "18:00", heure_fin: "00:00", notes: "Stories + reels en live", created_by: "u-cpe", created_at: iso(0) },
  { id: "pl-8", assigne_nom: "Sofia Benali",   assigne_role: "Responsable Financier",      poste: "Caisse / billetterie", date: dateOnly(3), heure_debut: "19:00", heure_fin: "01:00", notes: null,                        created_by: "u-fin", created_at: iso(0) },
  { id: "pl-9", assigne_nom: "Bastien Roche",  assigne_role: "Régisseur de production 1",  poste: "Démontage",       date: dateOnly(4), heure_debut: "09:00", heure_fin: "13:00", notes: null,                            created_by: "u-cpe", created_at: iso(0) },
  { id: "pl-10",assigne_nom: "Nathan Perreau", assigne_role: "Admin",                      poste: "Repérage site",   date: dateOnly(9), heure_debut: "09:00", heure_fin: "12:00", notes: "Visite technique Halle Tony Garnier", created_by: "u-adv", created_at: iso(1) },
  { id: "pl-11",assigne_nom: "Chloé Vasseur",  assigne_role: "Régisseur de production 2",  poste: "Régie lumière",   date: dateOnly(10), heure_debut: "08:00", heure_fin: "22:00", notes: "Montage + service festival",   created_by: "u-cpe", created_at: iso(1) },
  { id: "pl-12",assigne_nom: "Théo Guillard",  assigne_role: "Régisseur de production 3",  poste: "Backline / plateau", date: dateOnly(10), heure_debut: "08:00", heure_fin: "22:00", notes: null,                        created_by: "u-cpe", created_at: iso(1) },
];

export const demoNotes = [
  { id: "nt-1", author_id: "u-ceo", author_name: "Camille Reynaud",   author_role: "CEO",                         content: "Bravo à toute l'équipe pour le gala Alméo, super retours du client 👏", is_urgent: false, is_pinned: true,  reply_to: null, reply_preview: null, audio_url: null, image_url: null, created_at: iso(-1, 9, 10) },
  { id: "nt-2", author_id: "u-cpe", author_name: "Léa Dubosc",        author_role: "Chef de Projet Événementiel", content: "Rappel : brief équipe pour Rooftop 33 demain 15h en visio.",  is_urgent: true,  is_pinned: true,  reply_to: null, reply_preview: null, audio_url: null, image_url: null, created_at: iso(0, 8, 30) },
  { id: "nt-3", author_id: "u-reg1",author_name: "Bastien Roche",     author_role: "Régisseur de production 1",   content: "Console CDJ-3000 réceptionnée et testée, tout est OK niveau son.", is_urgent: false, is_pinned: false, reply_to: null, reply_preview: null, audio_url: null, image_url: null, created_at: iso(0, 9, 5) },
  { id: "nt-4", author_id: "u-fin", author_name: "Sofia Benali",      author_role: "Responsable Financier",       content: "Facture traiteur Alméo réglée, dossier clôturé côté finances.",   is_urgent: false, is_pinned: false, reply_to: null, reply_preview: null, audio_url: null, image_url: null, created_at: iso(0, 10, 0) },
  { id: "nt-5", author_id: "u-site",author_name: "Inès Fontaine",     author_role: "Site Manager",                content: "Machine à fumée toujours pas livrée, on relance le loueur cet aprem.", is_urgent: true, is_pinned: false, reply_to: null, reply_preview: null, audio_url: null, image_url: null, created_at: iso(0, 10, 20) },
  { id: "nt-6", author_id: "u-cm",  author_name: "Yanis Kaddour",     author_role: "Community Manager",           content: "Teaser Instagram du festival posté, déjà 3k vues en 1h 🔥",       is_urgent: false, is_pinned: false, reply_to: null, reply_preview: null, audio_url: null, image_url: null, created_at: iso(0, 11, 0) },
  { id: "nt-7", author_id: "u-ep",  author_name: "Hugo Lemercier",    author_role: "Event Planner",               content: "Merci Bastien pour le check son, on est ok pour ce soir 👍", is_urgent: false, is_pinned: false, reply_to: "nt-3", reply_preview: "Console CDJ-3000 réceptionnée et testée...", audio_url: null, image_url: null, created_at: iso(0, 11, 30) },
  { id: "nt-8", author_id: "u-adv", author_name: "Marc-Aurèle Simon", author_role: "Advisor",                     content: "Point stratégie Q3 à caler la semaine prochaine avec Camille.",   is_urgent: false, is_pinned: false, reply_to: null, reply_preview: null, audio_url: null, image_url: null, created_at: iso(-2, 17, 45) },
];

export const demoNoteReactions = [
  { id: "nr-1", note_id: "nt-1", user_id: "u-cpe", emoji: "🙌" },
  { id: "nr-2", note_id: "nt-1", user_id: "u-reg1", emoji: "🙌" },
  { id: "nr-3", note_id: "nt-1", user_id: "u-fin", emoji: "❤️" },
  { id: "nr-4", note_id: "nt-6", user_id: "u-ceo", emoji: "🔥" },
];

export const demoFinances = [
  { id: "fin-1",  libelle: "Billetterie — Soirée Blanche",       montant: 3200,  type: "Recette", categorie: "Billetterie", date: dateOnly(-2), created_by: "u-fin", created_at: iso(-2) },
  { id: "fin-2",  libelle: "Location sono JBL",                  montant: 850,   type: "Dépense", categorie: "Matériel",    date: dateOnly(-8), created_by: "u-fin", created_at: iso(-8) },
  { id: "fin-3",  libelle: "Prestation traiteur Gala Alméo",     montant: 4200,  type: "Dépense", categorie: "Traiteur",    date: dateOnly(-2), created_by: "u-fin", created_at: iso(-2) },
  { id: "fin-4",  libelle: "Facturation Gala Alméo",             montant: 12500, type: "Recette", categorie: "Prestation",  date: dateOnly(-2), created_by: "u-fin", created_at: iso(-2) },
  { id: "fin-5",  libelle: "Sécurité privée",                    montant: 1400,  type: "Dépense", categorie: "Sécurité",    date: dateOnly(0),  created_by: "u-fin", created_at: iso(0) },
  { id: "fin-6",  libelle: "Billetterie — Anniversaire 30 ans",  montant: 2750,  type: "Recette", categorie: "Billetterie", date: dateOnly(0),  created_by: "u-fin", created_at: iso(0) },
  { id: "fin-7",  libelle: "Location Halle Tony Garnier (accompte)", montant: 6000, type: "Dépense", categorie: "Location salle", date: dateOnly(-5), created_by: "u-fin", created_at: iso(-5) },
  { id: "fin-8",  libelle: "Sponsoring MaisonNova",              montant: 8000,  type: "Recette", categorie: "Sponsoring",  date: dateOnly(-1), created_by: "u-fin", created_at: iso(-1) },
  { id: "fin-9",  libelle: "Impression supports com'",           montant: 320,   type: "Dépense", categorie: "Communication", date: dateOnly(-3), created_by: "u-cm", created_at: iso(-3) },
  { id: "fin-10", libelle: "Facturation Mariage Camille & Yohan",montant: 9800,  type: "Recette", categorie: "Prestation",  date: dateOnly(-15), created_by: "u-fin", created_at: iso(-15) },
  { id: "fin-11", libelle: "Fleuriste — arche entrée",           montant: 480,   type: "Dépense", categorie: "Décoration",  date: dateOnly(2),  created_by: "u-cpe", created_at: iso(-1) },
  { id: "fin-12", libelle: "Groupe électrogène location",        montant: 610,   type: "Dépense", categorie: "Matériel",    date: dateOnly(1),  created_by: "u-reg1", created_at: iso(0) },
];

export const demoEventChecklist = [
  { id: "chk-1", event_id: "ev-1", texte: "Confirmer DJ + rider technique", done: true,  status: "done",        assignee_id: "u-cpe",  assignee_name: "Léa Dubosc",     created_at: iso(-8) },
  { id: "chk-2", event_id: "ev-1", texte: "Valider plan de salle",          done: true,  status: "done",        assignee_id: "u-site", assignee_name: "Inès Fontaine",  created_at: iso(-7) },
  { id: "chk-3", event_id: "ev-1", texte: "Briefing sécurité",              done: false, status: "in_progress", assignee_id: "u-site", assignee_name: "Inès Fontaine",  created_at: iso(-2) },
  { id: "chk-4", event_id: "ev-1", texte: "Livraison décoration blanche",   done: false, status: "todo",        assignee_id: "u-cpe",  assignee_name: "Léa Dubosc",     created_at: iso(-1) },
  { id: "chk-5", event_id: "ev-2", texte: "Contrats artistes signés",       done: true,  status: "done",        assignee_id: "u-adv",  assignee_name: "Marc-Aurèle Simon", created_at: iso(-20) },
  { id: "chk-6", event_id: "ev-2", texte: "Plan de sécurité festival",      done: false, status: "in_progress", assignee_id: "u-site", assignee_name: "Inès Fontaine",  created_at: iso(-10) },
  { id: "chk-7", event_id: "ev-2", texte: "Billetterie en ligne ouverte",   done: true,  status: "done",        assignee_id: "u-cm",   assignee_name: "Yanis Kaddour",  created_at: iso(-18) },
  { id: "chk-8", event_id: "ev-4", texte: "Sono + lumière installées",     done: true,  status: "done",        assignee_id: "u-reg1", assignee_name: "Bastien Roche",  created_at: iso(-1) },
  { id: "chk-9", event_id: "ev-4", texte: "Accueil VIP prêt",              done: false, status: "in_progress", assignee_id: "u-ep",   assignee_name: "Hugo Lemercier", created_at: iso(0) },
];

export const demoEventPhotos: { id: string; event_id: string; url: string; uploaded_by: string | null; created_at: string }[] = [
  { id: "ph-1", event_id: "ev-3", url: "https://picsum.photos/seed/lilz-gala-1/900/600", uploaded_by: "u-ep", created_at: iso(-2) },
  { id: "ph-2", event_id: "ev-3", url: "https://picsum.photos/seed/lilz-gala-2/900/600", uploaded_by: "u-ep", created_at: iso(-2) },
  { id: "ph-3", event_id: "ev-6", url: "https://picsum.photos/seed/lilz-mariage-1/900/600", uploaded_by: "u-ep", created_at: iso(-15) },
];

export const demoDirectMessages = [
  { id: "dm-1", sender_id: "u-cpe", receiver_id: "u-reg1", content: "Tu peux confirmer l'horaire de montage pour vendredi ?", read_at: iso(-1, 9, 5), created_at: iso(-1, 8, 50) },
  { id: "dm-2", sender_id: "u-reg1", receiver_id: "u-cpe", content: "Oui top, on démarre à 10h comme prévu 👍", read_at: iso(-1, 9, 10), created_at: iso(-1, 9, 2) },
  { id: "dm-3", sender_id: "u-fin", receiver_id: "u-ceo", content: "Le bilan financier du gala Alméo est dispo dans le module Finances.", read_at: null, created_at: iso(0, 10, 30) },
];

export const demoPushSubscriptions: Record<string, unknown>[] = [];

export type DemoTables = {
  profiles: typeof demoProfiles;
  evenements: typeof demoEvenements;
  tickets: typeof demoTickets;
  materiel_technique: typeof demoMateriel;
  planning: typeof demoPlanning;
  notes_internes: typeof demoNotes;
  note_reactions: typeof demoNoteReactions;
  finances: typeof demoFinances;
  event_checklist: typeof demoEventChecklist;
  event_photos: typeof demoEventPhotos;
  direct_messages: typeof demoDirectMessages;
  push_subscriptions: typeof demoPushSubscriptions;
};

// Store en mémoire (réinitialisé à chaque rechargement de page)
export function createDemoDb() {
  return {
    profiles: [...demoProfiles],
    evenements: [...demoEvenements],
    tickets: [...demoTickets],
    materiel_technique: [...demoMateriel],
    planning: [...demoPlanning],
    notes_internes: [...demoNotes],
    note_reactions: [...demoNoteReactions],
    finances: [...demoFinances],
    event_checklist: [...demoEventChecklist],
    event_photos: [...demoEventPhotos],
    direct_messages: [...demoDirectMessages],
    push_subscriptions: [...demoPushSubscriptions],
  } as { [K in keyof DemoTables]: DemoTables[K] };
}
