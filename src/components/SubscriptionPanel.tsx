import React, { useState } from "react";
import { Check, ExternalLink, Sparkles } from "lucide-react";

interface SubscriptionPanelProps {
  token: string;
  currentPlan: string;
  used: number;
  limit: number;
  onRequestSent: () => void;
}

const PLANS = [
  { id: "payg_day", label: "Pass Jour", price: 300, unit: "/ 24h", desc: "Analyses illimitées pendant 24h", features: ["Analyses illimitées 24h", "Toutes les zones", "Recommandations produits"] },
  { id: "monthly", label: "Mensuel", price: 5000, unit: "/ mois", desc: "30 analyses par mois", features: ["30 analyses / mois", "Historique complet", "Recommandations produits"] },
  { id: "premium", label: "Premium", price: 12000, unit: "/ mois", desc: "Sans limite, tout inclus", features: ["Analyses illimitées", "Historique complet", "Support prioritaire"] },
];

const WAVE_MERCHANT_URL = "https://pay.wave.com/m/M_ci_kwfmSykm6_et/c/ci/?amount=";

export default function SubscriptionPanel({ token, currentPlan, used, limit, onRequestSent }: SubscriptionPanelProps) {
  const [selected, setSelected] = useState(PLANS[0]);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    try {
      const res = await fetch("/api/user/request-activation", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: selected.id, amount: selected.price }),
      });
      const data = await res.json();
      if (data.success) {
        setSent(true);
        onRequestSent();
      } else {
        setError(data.message || "Échec de la demande.");
      }
    } catch {
      setError("Erreur réseau.");
    }
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-display font-semibold text-[#f5ede1] mb-1.5">Abonnement</h2>
      <p className="text-sm text-[#f5ede1]/60 mb-6">
        Forfait actuel : <strong className="text-[#e8a860]">{currentPlan === "free_trial" ? "Essai gratuit" : currentPlan === "free_expired" ? "Expiré" : currentPlan === "payg_day" ? "Pass Jour" : currentPlan === "monthly" ? "Mensuel" : "Premium"}</strong>
        {" · "}{used} / {limit === -1 ? "∞" : limit} analyses utilisées
      </p>

      <div className="grid grid-cols-1 gap-3 mb-6">
        {PLANS.map((p) => (
          <button
            key={p.id}
            onClick={() => { setSelected(p); setSent(false); }}
            className={`text-left rounded-2xl p-5 border transition cursor-pointer ${
              selected.id === p.id ? "border-[#b8762e] bg-[#b8762e]/10" : "premium-card border-white/10 hover:border-white/20"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#f5ede1]">{p.label}</span>
              <span className="text-lg font-bold text-[#b8762e]">{p.price.toLocaleString("fr-FR")}F <span className="text-xs text-[#f5ede1]/50 font-normal">{p.unit}</span></span>
            </div>
            <p className="text-xs text-[#f5ede1]/50 mt-1">{p.desc}</p>
            <ul className="mt-2.5 space-y-1">
              {p.features.map((f, i) => (
                <li key={i} className="flex items-center gap-1.5 text-[11px] text-[#f5ede1]/70">
                  <Check className="w-3 h-3 text-[#b8762e]" /> {f}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      <div className="premium-card rounded-2xl p-5">
        <div className="flex items-start gap-3 bg-black/20 p-3.5 rounded-xl mb-3">
          <span className="shrink-0 w-6 h-6 rounded-full bg-[#b8762e] text-white text-xs font-bold flex items-center justify-center">1</span>
          <p className="text-sm text-[#f5ede1]">Payez <strong>{selected.price.toLocaleString("fr-FR")}F</strong> via Wave.</p>
        </div>
        <a
          href={`${WAVE_MERCHANT_URL}${selected.price}`}
          target="_blank" rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 bg-[#1DC48D] hover:bg-[#17a878] text-white font-semibold text-sm py-3.5 rounded-xl transition cursor-pointer mb-3"
        >
          <ExternalLink className="w-4 h-4" /> Ouvrir Wave — Payer {selected.price}F
        </a>

        <div className="flex items-start gap-3 bg-black/20 p-3.5 rounded-xl mb-3">
          <span className="shrink-0 w-6 h-6 rounded-full bg-[#b8762e] text-white text-xs font-bold flex items-center justify-center">2</span>
          <p className="text-sm text-[#f5ede1]">Une fois payé, confirmez ici — activation manuelle sous quelques minutes.</p>
        </div>
        <button
          onClick={handleConfirm}
          disabled={sent}
          className="w-full flex items-center justify-center gap-2 bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-50 border border-white/10 text-[#f5ede1] font-semibold text-sm py-3.5 rounded-xl transition cursor-pointer"
        >
          <Sparkles className="w-4 h-4" /> {sent ? "Demande envoyée ✓" : "J'ai payé — Confirmer"}
        </button>
        {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
      </div>
    </div>
  );
}
