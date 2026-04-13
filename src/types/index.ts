// ============================================
// TYPES GLOBAUX — LIL'Z EVENT AGENCY
// ============================================

export type Role =
  | "CEO"
  | "Chef de Projet Événementiel"
  | "Community Manager"
  | "Site Manager"
  | "Advisor"
  | "Responsable Financier"
  | "Event Planner"
  | "Régisseur de production 1"
  | "Régisseur de production 2"
  | "Régisseur de production 3"
  | "Régisseur de production 4";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  avatar_url?: string;
  last_seen?: string;
  statut_presence?: string;
  created_at: string;
}

// Billetterie
export type TicketStatus = "En attente" | "Confirmée" | "Présent" | "No-show" | "Annulée";

export interface Ticket {
  id: string;
  client_name: string;
  nb_personnes: number;
  statut: TicketStatus;
  created_by: string;
  created_at: string;
}

// Matériel Technique
export type EtatMateriel   = "OK" | "Manquant" | "Fragile" | "Usé" | "À réparer";
export type PrioriteMatériel = "Urgent" | "Normal" | "Optionnel";
export type TypeMateriel   = "prevu" | "a_prevoir";

export interface Materiel {
  id: string;
  type: TypeMateriel;
  nom: string;
  categorie: string;
  quantite: number;
  etat: EtatMateriel | null;
  priorite: PrioriteMatériel | null;
  note: string | null;
  created_by: string;
  created_at: string;
}

// Planning
export interface PlanningEntry {
  id: string;
  user_id: string;
  assigne_id?: string;
  assigne_nom?: string;
  assigne_role?: string;
  poste: string;
  date: string;
  heure_debut: string;
  heure_fin: string;
  notes?: string;
  created_by: string;
  created_at: string;
}

// Notes internes
export interface NoteInterne {
  id: string;
  author_id: string;
  author_name: string;
  author_role?: string;
  content: string;
  is_urgent: boolean;
  is_pinned: boolean;
  reply_to?: string | null;
  reply_preview?: string | null;
  audio_url?: string | null;
  image_url?: string | null;
  created_at: string;
}

// Finances
export type TypeFinance = "Recette" | "Dépense";

export interface FinanceEntry {
  id: string;
  libelle: string;
  montant: number;
  type: TypeFinance;
  categorie: string;
  date: string;
  created_by: string;
  created_at: string;
}

// Messages directs
export interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  media_url: string | null;
  media_type: "image" | "audio" | null;
  read_at: string | null;
  created_at: string;
}

// Événements
export type StatutEvenement = "En préparation" | "En cours" | "Terminé" | "Annulé";

export interface Evenement {
  id: string;
  nom: string;
  date: string;
  lieu: string;
  description?: string;
  statut: StatutEvenement;
  created_by?: string;
  created_at: string;
}
