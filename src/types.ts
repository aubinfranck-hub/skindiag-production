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
}

export interface SkinAnalysisResult {
  zoneAnalysee: string;
  scoreGlobal: number; // 0-100
  typeDePeau: string;
  hydratation: "faible" | "moyenne" | "bonne";
  uniformite: "faible" | "moyenne" | "bonne";
  conditionsDetectees: DetectedCondition[];
  explicationSimple: string;
  recommandationProfessionnel: boolean;
  raisonRecommandation?: string;
  routineMatin: string[];
  routineSoir: string[];
  produitsRecommandes: Product[];
  confiance: number; // 0-100
}
