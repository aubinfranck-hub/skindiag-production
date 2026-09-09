import React from "react";
import { Scan, HelpCircle } from "lucide-react";
import { SkinZone, ZONE_LABELS } from "../types";

interface ZoneSelectorProps {
  onSelect: (zone: SkinZone) => void;
}

const ZONE_ORDER: SkinZone[] = ["visage", "cou", "bras", "avant_bras", "mains", "poitrine", "dos", "ventre", "jambes", "pieds"];

// Deux teintes chaudes alternées plutôt qu'un accent unique répété identique sur chaque carte
const ACCENTS = ["#c8663f", "#b8762e"];

export default function ZoneSelector({ onSelect }: ZoneSelectorProps) {
  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-display font-semibold text-[#f5ede1] mb-1.5">Quelle zone souhaitez-vous analyser ?</h2>
      <p className="text-sm text-[#f5ede1]/60 mb-6">Choisissez la zone de peau à examiner.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
        {ZONE_ORDER.map((zone, i) => {
          const accent = ACCENTS[i % 2];
          return (
            <button
              key={zone}
              onClick={() => onSelect(zone)}
              className="premium-card rounded-[22px] py-6 px-4 flex flex-col items-center gap-3 text-center hover:-translate-y-0.5 hover:border-white/20 transition cursor-pointer"
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
              <span className="text-sm font-medium text-[#f5ede1]">{ZONE_LABELS[zone]}</span>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onSelect("autre")}
        className="w-full mt-3.5 premium-card rounded-[22px] p-4 flex items-center justify-center gap-2 text-sm text-[#f5ede1]/70 hover:text-[#f5ede1] hover:border-white/20 transition cursor-pointer"
      >
        <HelpCircle className="w-4 h-4" />
        Je ne sais pas / Autre zone
      </button>
    </div>
  );
}
