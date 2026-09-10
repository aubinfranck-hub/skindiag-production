import React from "react";
import { Search, ShieldCheck, Droplet, Leaf, Bell } from "lucide-react";

export function PromoHeader() {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between gap-3">
        <img src="/logo-wide.png" alt="SkinDiag" className="h-12 sm:h-14 object-contain" />
        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden sm:block font-display italic text-[#d6407a] text-xs text-right leading-tight">
            Votre peau,<br />notre expertise
          </span>
          <button className="relative w-9 h-9 rounded-full bg-white shadow-[0_4px_14px_-6px_rgba(214,64,122,0.4)] flex items-center justify-center cursor-pointer">
            <Bell className="w-4 h-4 text-[#d6407a]" />
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 px-1">
        {[
          { icon: Search, label: "Identifier" },
          { icon: ShieldCheck, label: "Prévenir" },
          { icon: Droplet, label: "Prendre soin" },
          { icon: Leaf, label: "Peau saine" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <item.icon className="w-3.5 h-3.5 text-[#d6407a]" />
            <span className="text-[11px] text-[#2b1620]/60 font-medium">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PromoFooter({ partnerName }: { partnerName?: string }) {
  return (
    <div className="mt-6 pt-4 border-t border-[#2b1620]/[0.06] flex items-center justify-between gap-3">
      <div className="text-xs">
        <span className="font-bold text-[#2b1620]">SkinDiag</span>
        {partnerName && (
          <>
            <span className="text-[#2b1620]/40 mx-1.5">×</span>
            <span className="font-bold text-[#d6407a]">{partnerName}</span>
          </>
        )}
        <p className="text-[#2b1620]/40 text-[11px] mt-0.5">Partenariat beauté &amp; innovation</p>
      </div>
      <div className="flex items-center gap-1.5 text-right">
        <p className="text-[11px] text-[#2b1620]/50">Parce que chaque peau est unique</p>
        <Leaf className="w-3.5 h-3.5 text-[#d6407a] shrink-0" />
      </div>
    </div>
  );
}
