import React from "react";
import { ChevronRight, ShieldCheck, HelpCircle } from "lucide-react";
import { ZONE_CATEGORIES } from "../types";

interface CategorySelectorProps {
  onSelectCategory: (categoryId: string) => void;
  onSelectAutre: () => void;
}

export default function CategorySelector({ onSelectCategory, onSelectAutre }: CategorySelectorProps) {
  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-2xl font-display font-semibold text-[#2b1620] mb-1.5">Quelle partie du corps souhaitez-vous analyser ?</h2>
          <p className="text-sm text-[#2b1620]/60">Choisissez une catégorie, puis la zone précise.</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-[#fdf1f5] border border-[#d6407a]/15 rounded-2xl px-3 py-2 shrink-0">
          <ShieldCheck className="w-4 h-4 text-[#d6407a]" />
          <span className="text-[10px] text-[#d6407a] font-medium leading-tight">Analyse rapide<br />et sécurisée</span>
        </div>
      </div>

      <div className="space-y-3">
        {ZONE_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className="w-full flex items-center gap-4 bg-white rounded-2xl overflow-hidden shadow-[0_10px_24px_-14px_rgba(214,64,122,0.35)] hover:-translate-y-0.5 transition cursor-pointer text-left"
          >
            <img src={cat.photo} alt={cat.label} className="w-24 h-24 object-cover shrink-0" />
            <div className="flex-1 min-w-0 py-3">
              <span className="text-base font-semibold text-[#2b1620] block">{cat.label}</span>
              <span className="text-xs text-[#2b1620]/50">
                {cat.zones.length} zone{cat.zones.length > 1 ? "s" : ""} · Analyse peau noire africaine
              </span>
            </div>
            <ChevronRight className="w-5 h-5 text-[#d6407a] shrink-0 mr-4" />
          </button>
        ))}
      </div>

      <button
        onClick={onSelectAutre}
        className="w-full mt-3 bg-white shadow-[0_10px_24px_-14px_rgba(214,64,122,0.35)] rounded-2xl p-4 flex items-center justify-center gap-2 text-sm text-[#2b1620]/70 hover:text-[#2b1620] transition cursor-pointer"
      >
        <HelpCircle className="w-4 h-4" />
        Je ne sais pas / Autre zone
      </button>
    </div>
  );
}
