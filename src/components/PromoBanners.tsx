import React from "react";
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
}

export default function PromoBanners({ banners }: { banners: PromoBanner[] }) {
  if (banners.length === 0) return null;

  return (
    <div className="space-y-3 mb-5">
      {banners.map((b) => (
        <a
          key={b.id}
          href={b.linkUrl || undefined}
          target={b.linkUrl ? "_blank" : undefined}
          rel="noopener noreferrer"
          className="block rounded-2xl overflow-hidden relative min-h-[140px] cursor-pointer"
          style={{ background: `linear-gradient(120deg, ${b.colorFrom}, ${b.colorTo})` }}
        >
          {b.imageUrl && (
            <img src={b.imageUrl} alt={b.brandName} className="absolute inset-0 w-full h-full object-cover opacity-90" />
          )}
          <div className="relative z-10 p-5 flex flex-col justify-between h-full min-h-[140px]" style={{ color: b.textColor }}>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{b.brandName}</span>
              <h3 className="text-lg font-display font-semibold leading-tight mt-0.5">{b.title}</h3>
              {b.subtitle && <p className="text-xs opacity-90 mt-1">{b.subtitle}</p>}
            </div>
            {b.ctaText && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold mt-3 bg-black/20 backdrop-blur-sm px-3 py-1.5 rounded-full w-fit">
                {b.ctaText} <ArrowRight className="w-3.5 h-3.5" />
              </span>
            )}
          </div>
        </a>
      ))}
    </div>
  );
}
