import React from "react";
import { ChevronRight, ScanFace, Waypoints, Hand, Footprints, ShieldCheck, HelpCircle } from "lucide-react";
import { SkinZone, ZONE_LABELS } from "../types";

interface ZoneSelectorProps {
  onSelect: (zone: SkinZone) => void;
}

const ZONE_ORDER: SkinZone[] = ["visage", "cou", "bras", "avant_bras", "mains", "poitrine", "dos", "ventre", "jambes", "pieds"];

// Photo réelle par zone (licence Unsplash gratuite, peaux noires/foncées). Pour dos/ventre/jambes/pieds,
// aucune photo libre de droits suffisamment proche n'a été trouvée : la carte garde la même taille
// que les autres (structure identique) mais avec un fond dégradé à la place d'une photo qui ne
// correspondrait pas réellement à la zone.
const ZONE_PHOTOS: Partial<Record<SkinZone, string>> = {
  visage: "https://images.unsplash.com/photo-1693004927824-f2623bbedc8b?w=700&q=80&auto=format&fit=crop",
  cou: "https://images.unsplash.com/photo-1613876215075-276fd62c89a4?w=700&q=80&auto=format&fit=crop",
  bras: "https://images.unsplash.com/photo-1618509682637-e4790939cf96?w=700&q=80&auto=format&fit=crop",
  avant_bras: "https://images.unsplash.com/photo-1632765866070-3fadf25d3d5b?w=700&q=80&auto=format&fit=crop",
  mains: "https://images.unsplash.com/photo-1648203276014-20f97ba1f817?w=700&q=80&auto=format&fit=crop",
  poitrine: "https://images.unsplash.com/photo-1609535895148-cf9f5c446290?w=700&q=80&auto=format&fit=crop",
};

// Icône propre à chaque zone dans la pastille ronde (au lieu d'une seule icône générique répétée)
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
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-display font-semibold text-[#2b1620] mb-1.5">Quelle zone souhaitez-vous analyser ?</h2>
          <p className="text-sm text-[#2b1620]/60">Choisissez la zone de peau à examiner.</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-[#fdf1f5] border border-[#d6407a]/15 rounded-2xl px-3.5 py-2.5 shrink-0">
          <ShieldCheck className="w-4 h-4 text-[#d6407a]" />
          <span className="text-[11px] text-[#d6407a] font-medium leading-tight">Analyse rapide<br />et sécurisée</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {ZONE_ORDER.map((zone) => {
          const photo = ZONE_PHOTOS[zone];
          const Icon = ZONE_ICONS[zone];

          return (
            <button
              key={zone}
              onClick={() => onSelect(zone)}
              className="rounded-[22px] overflow-hidden bg-white shadow-[0_10px_28px_-16px_rgba(214,64,122,0.35)] hover:-translate-y-0.5 transition cursor-pointer text-left"
            >
              {/* Grande zone photo : ~4:3, dominante de la carte */}
              <div className="relative aspect-[4/3] bg-gradient-to-br from-[#f2a3c4] to-[#d6407a]">
                {photo && (
                  <img src={photo} alt={ZONE_LABELS[zone]} className="absolute inset-0 w-full h-full object-cover" />
                )}
              </div>
              {/* Barre blanche : pastille icône, nom, sous-titre, chevron */}
              <div className="flex items-center gap-3 p-3.5">
                <div className="w-10 h-10 rounded-full bg-[#fdf1f5] flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-[#d6407a]" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-base font-semibold text-[#2b1620] block leading-tight">{ZONE_LABELS[zone]}</span>
                  <span className="text-[11px] text-[#2b1620]/50">Analyse peau noire africaine</span>
                </div>
                <ChevronRight className="w-5 h-5 text-[#d6407a] shrink-0" />
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onSelect("autre")}
        className="w-full mt-4 bg-white shadow-[0_10px_28px_-16px_rgba(214,64,122,0.35)] rounded-[22px] p-4 flex items-center justify-center gap-2 text-sm text-[#2b1620]/70 hover:text-[#2b1620] transition cursor-pointer"
      >
        <HelpCircle className="w-4 h-4" />
        Je ne sais pas / Autre zone
      </button>
    </div>
  );
}
