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
      <h2 className="text-lg sm:text-2xl font-display font-semibold text-[#2b1620] mb-1">Quelle zone souhaitez-vous analyser ?</h2>
      <p className="text-xs sm:text-sm text-[#2b1620]/60 mb-3">Choisissez une catégorie pour commencer.</p>

      <div className="space-y-2">
        {ZONE_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className="w-full flex items-center gap-4 bg-white rounded-2xl overflow-hidden shadow-[0_10px_24px_-14px_rgba(214,64,122,0.35)] hover:-translate-y-0.5 transition cursor-pointer text-left"
          >
            <img src={cat.photo} alt={cat.label} className="w-16 h-16 sm:w-24 sm:h-24 object-cover shrink-0" />
            <div className="flex-1 min-w-0 py-2 sm:py-3">
              <span className="text-sm sm:text-base font-semibold text-[#2b1620] block">{cat.label}</span>
              <span className="text-[10px] sm:text-xs text-[#2b1620]/50">
                {cat.zones.length} zone{cat.zones.length > 1 ? "s" : ""} d'analyse
              </span>
            </div>
            <ChevronRight className="w-5 h-5 text-[#d6407a] shrink-0 mr-4" />
          </button>
        ))}
      </div>

      <button
        onClick={onSelectAutre}
        className="w-full mt-2 bg-white shadow-[0_10px_24px_-14px_rgba(214,64,122,0.35)] rounded-2xl p-3 flex items-center justify-center gap-2 text-xs sm:text-sm text-[#2b1620]/70 hover:text-[#2b1620] transition cursor-pointer"
      >
        <HelpCircle className="w-4 h-4" />
        Je ne sais pas / Autre zone
      </button>

      {/* Bandeau bas — présent uniquement sur l'écran principal des catégories */}
      <div className="mt-2 bg-[#fdf1f5] border border-[#d6407a]/15 rounded-2xl p-3 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4 text-[#d6407a]" />
        </div>
        <div>
          <span className="text-xs sm:text-sm font-semibold text-[#2b1620] block leading-tight">Des analyses précises pour une peau plus saine</span>
          <span className="text-[9px] sm:text-[10px] text-[#2b1620]/50">IA · Expertise · Peau noire africaine</span>
        </div>
      </div>
    </div>
  );
}
