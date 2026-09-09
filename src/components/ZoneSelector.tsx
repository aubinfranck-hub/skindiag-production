import React from "react";
import { ChevronRight, ScanFace, Waypoints, Hand, Footprints, ShieldCheck, HelpCircle } from "lucide-react";
import { SkinZone, ZONE_LABELS } from "../types";

interface ZoneSelectorProps {
  onSelect: (zone: SkinZone) => void;
}

const ZONE_ORDER: SkinZone[] = ["visage", "cou", "bras", "avant_bras", "mains", "poitrine", "dos", "ventre", "jambes", "pieds"];

// Photos découpées directement depuis la maquette fournie par l'utilisateur (public/zones/*.jpg) —
// toutes les 10 zones sont couvertes, aucune recherche externe.
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

const ZONE_ICONS: Record<SkinZone, React.ElementType> = {
  visage: ScanFace,
  cou: Waypoints,
  bras: Waypoints,
  avant_bras: Waypoints,
  mains: Hand,
  poitrine: Waypoints,
  dos: Waypoints,
  ventre: Waypoints,
  jambes: Waypoints,
  pieds: Footprints,
  autre: HelpCircle,
};

export default function ZoneSelector({ onSelect }: ZoneSelectorProps) {
  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-display font-semibold text-[#2b1620] mb-1">Quelle zone souhaitez-vous analyser ?</h2>
          <p className="text-xs sm:text-sm text-[#2b1620]/60">Choisissez la zone de peau à examiner.</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-[#fdf1f5] border border-[#d6407a]/15 rounded-2xl px-3 py-2 shrink-0">
          <ShieldCheck className="w-4 h-4 text-[#d6407a]" />
          <span className="text-[10px] text-[#d6407a] font-medium leading-tight">Analyse rapide<br />et sécurisée</span>
        </div>
      </div>

      {/* Cartes horizontales compactes : photo carrée + icône/nom/sous-titre + chevron — tout tient sans défiler */}
      <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
        {ZONE_ORDER.map((zone) => {
          const Icon = ZONE_ICONS[zone];
          return (
            <button
              key={zone}
              onClick={() => onSelect(zone)}
              className="flex items-center gap-1.5 sm:gap-3 bg-white rounded-xl sm:rounded-2xl overflow-hidden shadow-[0_6px_18px_-10px_rgba(214,64,122,0.35)] hover:-translate-y-0.5 transition cursor-pointer text-left pr-1.5 sm:pr-3"
            >
              <img src={ZONE_PHOTOS[zone as Exclude<SkinZone, "autre">]} alt={ZONE_LABELS[zone]} className="w-11 h-11 sm:w-16 sm:h-16 object-cover shrink-0" />
              <div className="hidden sm:flex w-9 h-9 rounded-full bg-[#fdf1f5] items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-[#d6407a]" />
              </div>
              <div className="flex-1 min-w-0 py-1.5 sm:py-2">
                <span className="text-[11px] sm:text-sm font-semibold text-[#2b1620] block leading-tight truncate">{ZONE_LABELS[zone]}</span>
                <span className="text-[8px] sm:text-[10px] text-[#2b1620]/50 block truncate leading-tight">Analyse peau noire africaine</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#d6407a] shrink-0" />
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onSelect("autre")}
        className="w-full mt-2.5 bg-white shadow-[0_6px_18px_-10px_rgba(214,64,122,0.35)] rounded-2xl p-3.5 flex items-center justify-center gap-2 text-sm text-[#2b1620]/70 hover:text-[#2b1620] transition cursor-pointer"
      >
        <HelpCircle className="w-4 h-4" />
        Je ne sais pas / Autre zone
      </button>

      {/* Bandeau bas façon maquette */}
      <div className="mt-4 bg-[#fdf1f5] border border-[#d6407a]/15 rounded-2xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4.5 h-4.5 text-[#d6407a]" />
          </div>
          <div>
            <span className="text-xs sm:text-sm font-semibold text-[#2b1620] block">Des analyses précises pour une peau plus saine</span>
            <span className="text-[10px] text-[#2b1620]/50">IA · Expertise · Peau noire africaine</span>
          </div>
        </div>
        <span className="hidden sm:block font-display italic text-[#d6407a] text-sm text-right leading-tight shrink-0">
          Votre peau,<br />Notre expertise
        </span>
      </div>
    </div>
  );
}
