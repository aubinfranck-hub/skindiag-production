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
