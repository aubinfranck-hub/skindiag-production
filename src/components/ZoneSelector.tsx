import React from "react";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { SkinZone, ZONE_LABELS, ZONE_CATEGORIES } from "../types";

interface ZoneSelectorProps {
  categoryId: string;
  onBack: () => void;
  onSelect: (zone: SkinZone) => void;
}

const ZONE_PHOTOS: Record<Exclude<SkinZone, "autre">, string> = {
  visage: "/zones/visage.jpg",
  cou: "/zones/cou.jpg",
  bras: "/zones/bras.jpg",
  avant_bras: "/zones/avant_bras.jpg",
  mains: "/zones/mains.jpg",
  poitrine: "/zones/poitrine.jpg",
  dos: "/zones/dos.jpg",
  ventre: "/zones/ventre.jpg",
  jambes: "/zones/jambes.jpg",
  pieds: "/zones/pieds.jpg",
};

export default function ZoneSelector({ categoryId, onBack, onSelect }: ZoneSelectorProps) {
  const category = ZONE_CATEGORIES.find((c) => c.id === categoryId) ?? ZONE_CATEGORIES[0];

  return (
    <div className="animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold text-[#d6407a] bg-white shadow-[0_4px_14px_-6px_rgba(214,64,122,0.4)] rounded-full px-3.5 py-2 mb-4 hover:-translate-y-0.5 transition cursor-pointer">
        <ArrowLeft className="w-4 h-4" /> Changer de catégorie
      </button>

      <h2 className="text-2xl font-display font-semibold text-[#2b1620] mb-1.5">{category.label}</h2>
      <p className="text-sm text-[#2b1620]/60 mb-6">Choisissez la zone à analyser.</p>

      <div className="space-y-3.5">
        {category.zones.map((zone) => (
          <button
            key={zone}
            onClick={() => onSelect(zone)}
            className="w-full flex items-center gap-4 bg-white rounded-[22px] overflow-hidden shadow-[0_10px_28px_-16px_rgba(214,64,122,0.35)] hover:-translate-y-0.5 transition cursor-pointer text-left"
          >
            <img src={ZONE_PHOTOS[zone as Exclude<SkinZone, "autre">]} alt={ZONE_LABELS[zone]} className="w-32 h-32 sm:w-40 sm:h-40 object-cover shrink-0" />
            <div className="flex-1 min-w-0 py-4">
              <span className="text-lg font-semibold text-[#2b1620] block">{ZONE_LABELS[zone]}</span>
              <span className="text-xs text-[#2b1620]/50">Analyse peau noire africaine</span>
            </div>
            <ChevronRight className="w-5 h-5 text-[#d6407a] shrink-0 mr-4" />
          </button>
        ))}
      </div>
    </div>
  );
}
