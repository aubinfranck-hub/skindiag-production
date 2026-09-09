export type SkinZone =
  | "visage" | "cou" | "bras" | "avant_bras" | "mains"
  | "poitrine" | "dos" | "ventre" | "jambes" | "pieds" | "autre";

export const ZONE_LABELS: Record<SkinZone, string> = {
  visage: "Visage",
  cou: "Cou",
  bras: "Bras",
  avant_bras: "Avant-bras",
  mains: "Mains",
  poitrine: "Poitrine",
  dos: "Dos",
  ventre: "Ventre",
  jambes: "Jambes",
  pieds: "Pieds",
  autre: "Zone personnalisée",
};

export interface ZoneCategory {
  id: string;
  label: string;
  zones: SkinZone[];
  photo: string; // photo représentative de la catégorie (première sous-zone)
}

export const ZONE_CATEGORIES: ZoneCategory[] = [
  { id: "visage_cou", label: "Visage & Cou", zones: ["visage", "cou"], photo: "/zones/visage.jpg" },
  { id: "bras_mains", label: "Bras & Mains", zones: ["bras", "avant_bras", "mains"], photo: "/zones/bras.jpg" },
  { id: "torse", label: "Haut du corps", zones: ["poitrine", "dos"], photo: "/zones/poitrine.jpg" },
  { id: "abdomen", label: "Abdomen", zones: ["ventre"], photo: "/zones/ventre.jpg" },
  { id: "jambes_pieds", label: "Jambes & Pieds", zones: ["jambes", "pieds"], photo: "/zones/jambes.jpg" },
];

export const ACTIF_LABELS: Record<string, string> = {
  vitamine_c: "Vitamine C",
  niacinamide: "Niacinamide",
  acide_hyaluronique: "Acide hyaluronique",
  ceramides: "Céramides",
  glycerine: "Glycérine",
  acide_azelaique: "Acide azélaïque",
  beurre_de_karite: "Beurre de karité",
  protection_solaire: "Protection solaire",
  retinoides: "Rétinoïdes",
  uree: "Urée",
};

export interface DetectedCondition {
  nom: string;
  severite: "légère" | "modérée" | "marquée";
  description: string;
}

export interface Product {
  id: number;
  name: string;
  brand: string;
  category: string;
  price_fcfa: number;
  suitable_for: string[];
  availability_abidjan: boolean;
  actifs: string[];
  inci_composition: string;
  is_sponsored: boolean;
  is_partner: boolean;
  fragrance_free: boolean;
  matchScore: number;
  actifsCorrespondants: string[];
}

export interface BesoinIdentifie {
  besoin: string;
  priorite: "principal" | "secondaire";
}

export const SKIN_TONE_LABELS: Record<string, string> = {
  tres_clair: "Très clair",
  clair: "Clair",
  brun_clair: "Brun clair",
  brun_moyen: "Brun moyen",
  brun_fonce: "Brun foncé",
  tres_fonce: "Très foncé",
};

export interface QualiteImage {
  decision: "A_excellente" | "B_exploitable_imparfaite" | "C_insuffisante";
  acceptable: boolean;
  score: number;
  problemes: string[];
  message: string;
}

export interface SkinAnalysisResult {
  zoneAnalysee: string;
  qualiteImage: QualiteImage;
  analyseConcluante: boolean;
  scoreGlobal: number; // 0-100
  typeDePeau: string;
  profilTeinte: string;
  hydratation: "faible" | "moyenne" | "bonne";
  uniformite: "faible" | "moyenne" | "bonne";
  observation: string;
  hypothesesCompatibles: string[];
  conditionsDetectees: DetectedCondition[];
  explicationSimple: string;
  recommandationProfessionnel: boolean;
  raisonRecommandation?: string;
  besoinsIdentifies: BesoinIdentifie[];
  actifsRecherches: string[];
  routineMatin: string[];
  routineSoir: string[];
  produitsPartenaires: Product[];
  autresProduits: Product[];
  confianceImage: number; // 0-100
  confianceMotifClinique: number; // 0-100
}
