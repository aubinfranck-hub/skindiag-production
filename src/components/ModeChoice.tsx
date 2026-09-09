import React from "react";
import { Camera, Video, ArrowLeft, ArrowRight } from "lucide-react";
import { SkinZone, ZONE_LABELS } from "../types";

interface ModeChoiceProps {
  zone: SkinZone;
  onBack: () => void;
  onChoose: (mode: "photo" | "video") => void;
}

export default function ModeChoice({ zone, onBack, onChoose }: ModeChoiceProps) {
  return (
    <div className="animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-[#f5ede1]/60 hover:text-[#f5ede1] mb-4 cursor-pointer">
        <ArrowLeft className="w-3.5 h-3.5" /> Changer de zone
      </button>

      <h2 className="text-2xl font-display font-semibold text-[#f5ede1] mb-1.5">Zone : {ZONE_LABELS[zone]}</h2>
      <p className="text-sm text-[#f5ede1]/60 mb-6">Comment voulez-vous montrer cette zone ?</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => onChoose("photo")}
          className="premium-card rounded-2xl p-6 text-left hover:border-[#d6407a]/40 hover:bg-white/[0.03] transition cursor-pointer group"
        >
          <Camera className="w-7 h-7 text-[#d6407a] mb-3" />
          <h3 className="text-base font-semibold text-[#f5ede1] mb-1">Photo</h3>
          <p className="text-xs text-[#f5ede1]/50 leading-relaxed">Rapide, une seule image nette de la zone.</p>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#f28fb0] mt-4 group-hover:gap-2.5 transition-all">
            Continuer <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </button>

        <button
          onClick={() => onChoose("video")}
          className="premium-card rounded-2xl p-6 text-left hover:border-[#d6407a]/40 hover:bg-white/[0.03] transition cursor-pointer group"
        >
          <Video className="w-7 h-7 text-[#d6407a] mb-3" />
          <h3 className="text-base font-semibold text-[#f5ede1] mb-1">Vidéo</h3>
          <p className="text-xs text-[#f5ede1]/50 leading-relaxed">Un court clip (8s), pour un meilleur aperçu du relief et de la texture.</p>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#f28fb0] mt-4 group-hover:gap-2.5 transition-all">
            Continuer <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </button>
      </div>
    </div>
  );
}
