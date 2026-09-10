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
  tags: string;
  badgeText: string;
}

// Le clic ouvre le lien seulement si un lien est renseigné — sinon la bannière est juste visuelle.
function BannerLink({ b, className, style, children }: { b: PromoBanner; className: string; style?: React.CSSProperties; children: React.ReactNode }) {
  if (b.linkUrl) {
    return (
      <a href={b.linkUrl} target="_blank" rel="noopener noreferrer" className={className} style={style}>
        {children}
      </a>
    );
  }
  return <div className={className} style={style}>{children}</div>;
}

// Si une image est fournie, c'est ELLE le visuel final (déjà conçu, texte compris) — on
// l'affiche telle quelle, sans rien superposer. Le texte/dégradé généré n'est qu'un repli
// pour un bandeau qui n'a pas encore d'image.
function BannerContent({ b, minHeight }: { b: PromoBanner; minHeight: number }) {
  if (b.imageUrl) {
    return <img src={b.imageUrl} alt={b.brandName} className="w-full h-auto block" />;
  }
  return (
    <div
      className="relative p-5 flex flex-col justify-end"
      style={{ background: `linear-gradient(120deg, ${b.colorFrom}, ${b.colorTo})`, minHeight, color: b.textColor }}
    >
      {b.badgeText && (
        <span className="absolute top-3 left-3 text-[10px] font-bold bg-black/25 backdrop-blur-sm px-2.5 py-1 rounded-full">
          {b.badgeText}
        </span>
      )}
      <span className="text-xs font-bold uppercase tracking-wider opacity-90">{b.brandName}</span>
      <h3 className="text-xl font-display font-semibold leading-tight mt-0.5">{b.title}</h3>
      {b.subtitle && <p className="text-xs opacity-90 mt-1">{b.subtitle}</p>}
      {b.ctaText && (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold mt-3 bg-white/90 text-[#2b1620] px-3 py-1.5 rounded-full w-fit">
          {b.ctaText} <ArrowRight className="w-3.5 h-3.5" />
        </span>
      )}
    </div>
  );
}

// "hero" : carrousel défilant, une image (ou bloc texte de repli) par page, avec points.
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
      <div ref={scrollRef} onScroll={handleScroll} className="flex overflow-x-auto snap-x snap-mandatory rounded-2xl" style={{ scrollbarWidth: "none" }}>
        {banners.map((b) => (
          <BannerLink key={b.id} b={b} className="relative shrink-0 w-full snap-start rounded-2xl overflow-hidden cursor-pointer">
            <BannerContent b={b} minHeight={170} />
          </BannerLink>
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
        <BannerLink key={b.id} b={b} className="block rounded-2xl overflow-hidden cursor-pointer">
          <BannerContent b={b} minHeight={110} />
        </BannerLink>
      ))}
    </div>
  );
}
