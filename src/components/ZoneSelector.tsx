import React from "react";
import { Scan, HelpCircle } from "lucide-react";
import { SkinZone, ZONE_LABELS } from "../types";

interface ZoneSelectorProps {
  onSelect: (zone: SkinZone) => void;
}

const ZONE_ORDER: SkinZone[] = ["visage", "cou", "bras", "avant_bras", "mains", "poitrine", "dos", "ventre", "jambes", "pieds"];

// Photo réelle par zone quand une bonne correspondance libre de droits existe (licence Unsplash
// gratuite, peaux noires/foncées). Pour les zones sans photo convenable trouvée, on garde
// l'icône plutôt que de forcer une image qui ne correspond pas réellement à la zone.
const ZONE_PHOTOS: Partial<Record<SkinZone, string>> = {
  visage: "https://images.unsplash.com/photo-1693004927824-f2623bbedc8b?w=500&q=80&auto=format&fit=crop",
  cou: "https://images.unsplash.com/photo-1613876215075-276fd62c89a4?w=500&q=80&auto=format&fit=crop",
  bras: "https://images.unsplash.com/photo-1618509682637-e4790939cf96?w=500&q=80&auto=format&fit=crop",
  avant_bras: "https://images.unsplash.com/photo-1632765866070-3fadf25d3d5b?w=500&q=80&auto=format&fit=crop",
  mains: "https://images.unsplash.com/photo-1648203276014-20f97ba1f817?w=500&q=80&auto=format&fit=crop",
  poitrine: "https://images.unsplash.com/photo-1609535895148-cf9f5c446290?w=500&q=80&auto=format&fit=crop",
};

const ACCENTS = ["#e0578f", "#d6407a"];

export default function ZoneSelector({ onSelect }: ZoneSelectorProps) {
  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-display font-semibold text-[#2b1620] mb-1.5">Quelle zone souhaitez-vous analyser ?</h2>
      <p className="text-sm text-[#2b1620]/60 mb-6">Choisissez la zone de peau à examiner.</p>

      <div className="grid grid-cols-2 gap-3.5">
        {ZONE_ORDER.map((zone, i) => {
          const photo = ZONE_PHOTOS[zone];
          const accent = ACCENTS[i % 2];

          if (photo) {
            return (
              <button
                key={zone}
                onClick={() => onSelect(zone)}
                className="rounded-[22px] overflow-hidden bg-white shadow-[0_10px_28px_-16px_rgba(214,64,122,0.35)] hover:-translate-y-0.5 transition cursor-pointer text-left"
              >
                <div className="relative h-28 sm:h-32">
                  <div className="absolute inset-0 bg-gradient-to-b from-[#d6407a]/10 to-transparent" />
                  <img src={photo} alt={ZONE_LABELS[zone]} className="w-full h-full object-cover" />
                </div>
                <div className="p-3 text-center">
                  <span className="text-sm font-semibold text-[#2b1620] block">{ZONE_LABELS[zone]}</span>
                  <span className="text-[10px] text-[#d6407a] font-medium">Analyse peau noire africaine</span>
                </div>
              </button>
            );
          }

          return (
            <button
              key={zone}
              onClick={() => onSelect(zone)}
              className="premium-card rounded-[22px] py-6 px-4 flex flex-col items-center gap-3 text-center hover:-translate-y-0.5 hover:border-[#2b1620]/25 transition cursor-pointer"
            >
              <div className="relative w-11 h-11 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full blur-md opacity-40" style={{ background: accent }} />
                <div
                  className="relative w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: `linear-gradient(155deg, ${accent}, transparent 130%)` }}
                >
                  <Scan className="w-4.5 h-4.5 text-white" />
                </div>
              </div>
              <span className="text-sm font-medium text-[#2b1620]">{ZONE_LABELS[zone]}</span>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onSelect("autre")}
        className="w-full mt-3.5 premium-card rounded-[22px] p-4 flex items-center justify-center gap-2 text-sm text-[#2b1620]/70 hover:text-[#2b1620] hover:border-[#2b1620]/25 transition cursor-pointer"
      >
        <HelpCircle className="w-4 h-4" />
        Je ne sais pas / Autre zone
      </button>
    </div>
  );
}
