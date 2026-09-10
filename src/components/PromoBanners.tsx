import React, { useState, useRef } from "react";
import { ArrowRight } from "lucide-react";

interface PromoBanner {
  id: number;
  brandName: string;
  title: string;
  subtitle: string;
  ctaText: string;
  linkUrl: string;
  imageUrl: string;
  colorFrom: string;
  colorTo: string;
  textColor: string;
  position: "hero" | "secondary";
  tags: string; // séparés par des virgules
  badgeText: string;
}

// Bandeau "hero" : carrousel défilant avec points de pagination (comme le bandeau
// "Partenaire officiel" en haut de la maquette).
function HeroCarousel({ banners }: { banners: PromoBanner[] }) {
  const [active, setActive] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const idx = Math.round(scrollRef.current.scrollLeft / scrollRef.current.clientWidth);
    setActive(idx);
  };

  return (
    <div className="mb-5">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory rounded-2xl -mx-0"
        style={{ scrollbarWidth: "none" }}
      >
        {banners.map((b) => (
          <a
            key={b.id}
            href={b.linkUrl || undefined}
            target={b.linkUrl ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="relative shrink-0 w-full snap-start rounded-2xl overflow-hidden min-h-[170px] cursor-pointer"
            style={{ background: `linear-gradient(120deg, ${b.colorFrom}, ${b.colorTo})` }}
          >
            {b.badgeText && (
              <span className="absolute top-3 left-3 z-10 text-[10px] font-bold bg-black/25 backdrop-blur-sm px-2.5 py-1 rounded-full" style={{ color: b.textColor }}>
                {b.badgeText}
              </span>
            )}
            {b.imageUrl && (
              <img src={b.imageUrl} alt={b.brandName} className="absolute inset-0 w-full h-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent" />
            <div className="relative z-10 p-5 flex flex-col justify-end h-full min-h-[170px]" style={{ color: b.textColor }}>
              <span className="text-xs font-bold uppercase tracking-wider opacity-90">{b.brandName}</span>
              <h3 className="text-xl font-display font-semibold leading-tight mt-0.5">{b.title}</h3>
              {b.subtitle && <p className="text-xs opacity-90 mt-1">{b.subtitle}</p>}
              {b.ctaText && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold mt-3 bg-white/90 text-[#2b1620] px-3 py-1.5 rounded-full w-fit">
                  {b.ctaText} <ArrowRight className="w-3.5 h-3.5" />
                </span>
              )}
            </div>
          </a>
        ))}
      </div>
      {banners.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2.5">
          {banners.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-[#d6407a]" : "w-1.5 bg-[#2b1620]/15"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

// Bandeau "secondary" : empilé, avec mots-clés listés à droite (comme les bandeaux
// Even Better / Infini Clear / Paw Paw en bas de la maquette).
function SecondaryBanner({ b }: { b: PromoBanner }) {
  const tagList = b.tags.split(",").map((t) => t.trim()).filter(Boolean);
  return (
    <a
      href={b.linkUrl || undefined}
      target={b.linkUrl ? "_blank" : undefined}
      rel="noopener noreferrer"
      className="relative block rounded-2xl overflow-hidden min-h-[110px] cursor-pointer"
      style={{ background: `linear-gradient(120deg, ${b.colorFrom}, ${b.colorTo})` }}
    >
      {b.imageUrl && (
        <img src={b.imageUrl} alt={b.brandName} className="absolute inset-0 w-full h-full object-cover opacity-95" />
      )}
      <div className="relative z-10 flex items-center justify-between gap-3 p-4 min-h-[110px]" style={{ color: b.textColor }}>
        <div>
          <h3 className="text-lg font-display font-bold leading-tight">{b.brandName}</h3>
          <p className="text-xs opacity-90 mt-0.5 max-w-[160px]">{b.title}</p>
          {b.ctaText && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold mt-2 bg-black/25 backdrop-blur-sm px-2.5 py-1 rounded-full w-fit">
              {b.ctaText} <ArrowRight className="w-3 h-3" />
            </span>
          )}
        </div>
        {tagList.length > 0 && (
          <div className="text-right shrink-0">
            {tagList.map((t, i) => (
              <p key={i} className="text-xs font-semibold leading-tight">{t}</p>
            ))}
          </div>
        )}
      </div>
    </a>
  );
}

interface PromoBannersProps {
  banners: PromoBanner[];
  slot: "hero" | "secondary";
}

export default function PromoBanners({ banners, slot }: PromoBannersProps) {
  const filtered = banners.filter((b) => b.position === slot);
  if (filtered.length === 0) return null;

  if (slot === "hero") return <HeroCarousel banners={filtered} />;

  return (
    <div className="space-y-3 mt-5">
      {filtered.map((b) => (
        <SecondaryBanner key={b.id} b={b} />
      ))}
    </div>
  );
}
