import React from "react";
import { Scan, HelpCircle } from "lucide-react";
import { SkinZone, ZONE_LABELS } from "../types";

interface ZoneSelectorProps {
  onSelect: (zone: SkinZone) => void;
}

const ZONE_ORDER: SkinZone[] = ["visage", "cou", "bras", "avant_bras", "mains", "poitrine", "dos", "ventre", "jambes", "pieds"];

export default function ZoneSelector({ onSelect }: ZoneSelectorProps) {
  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-display font-semibold text-[#f5ede1] mb-1.5">Quelle zone souhaitez-vous analyser ?</h2>
      <p className="text-sm text-[#f5ede1]/60 mb-6">Choisissez la zone de peau à examiner.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {ZONE_ORDER.map((zone) => (
          <button
            key={zone}
            onClick={() => onSelect(zone)}
            className="premium-card rounded-2xl p-5 text-left hover:border-[#b8762e]/40 hover:bg-white/[0.03] transition cursor-pointer"
          >
            <Scan className="w-5 h-5 text-[#b8762e] mb-2" />
            <span className="text-sm font-medium text-[#f5ede1]">{ZONE_LABELS[zone]}</span>
          </button>
        ))}
      </div>

      <button
        onClick={() => onSelect("autre")}
        className="w-full mt-3 premium-card rounded-2xl p-4 flex items-center justify-center gap-2 text-sm text-[#f5ede1]/70 hover:text-[#f5ede1] hover:border-[#b8762e]/40 transition cursor-pointer"
      >
        <HelpCircle className="w-4 h-4" />
        Je ne sais pas / Autre zone
      </button>
    </div>
  );
}
