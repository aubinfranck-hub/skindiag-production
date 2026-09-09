import React from "react";
import { ArrowLeft, AlertTriangle, Sun, Moon, ShoppingBag, ShieldCheck } from "lucide-react";
import { SkinAnalysisResult } from "../types";

interface ResultsViewProps {
  result: SkinAnalysisResult;
  onRestart: () => void;
}

export default function ResultsView({ result, onRestart }: ResultsViewProps) {
  return (
    <div className="animate-fade-in">
      <button onClick={onRestart} className="flex items-center gap-1.5 text-xs text-[#2b1620]/60 hover:text-[#2b1620] mb-4 cursor-pointer">
        <ArrowLeft className="w-3.5 h-3.5" /> Nouvelle analyse
      </button>

      {/* Score global */}
      <div className="premium-card rounded-3xl p-6 flex items-center gap-5 mb-4">
        <div className="relative w-20 h-20 shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(245,237,225,0.1)" strokeWidth="10" />
            <circle
              cx="50" cy="50" r="42" fill="none" stroke="#d6407a" strokeWidth="10"
              strokeDasharray={`${(result.scoreGlobal / 100) * 264} 264`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-[#2b1620]">
            {result.scoreGlobal}
          </div>
        </div>
        <div>
          <span className="text-xs uppercase tracking-wider text-[#2b1620]/50 font-medium">Score global — {result.zoneAnalysee}</span>
          <p className="text-sm text-[#2b1620] mt-1">Type de peau : <strong>{result.typeDePeau}</strong></p>
          <p className="text-xs text-[#2b1620]/60 mt-0.5">Hydratation {result.hydratation} · Uniformité {result.uniformite}</p>
        </div>
      </div>

      {/* Recommandation professionnel */}
      {result.recommandationProfessionnel && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-300">Avis d'un professionnel recommandé</p>
            <p className="text-xs text-amber-200/80 mt-1">{result.raisonRecommandation}</p>
          </div>
        </div>
      )}

      {/* Explication */}
      <div className="premium-card rounded-2xl p-5 mb-4">
        <p className="text-sm text-[#2b1620]/85 leading-relaxed">{result.explicationSimple}</p>
      </div>

      {/* Conditions détectées */}
      {result.conditionsDetectees.length > 0 && (
        <div className="premium-card rounded-2xl p-5 mb-4">
          <h3 className="text-xs uppercase tracking-wider text-[#2b1620]/50 font-semibold mb-3">Observations</h3>
          <div className="space-y-2.5">
            {result.conditionsDetectees.map((c, i) => (
              <div key={i} className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-sm text-[#2b1620] font-medium">{c.nom}</span>
                  <p className="text-xs text-[#2b1620]/60 mt-0.5">{c.description}</p>
                </div>
                <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                  c.severite === "marquée" ? "bg-rose-500/15 text-rose-300" :
                  c.severite === "modérée" ? "bg-amber-500/15 text-amber-300" :
                  "bg-emerald-500/15 text-emerald-300"
                }`}>
                  {c.severite}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Routines */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div className="premium-card rounded-2xl p-5">
          <h3 className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-[#2b1620]/50 font-semibold mb-3">
            <Sun className="w-3.5 h-3.5" /> Routine matin
          </h3>
          <ol className="space-y-1.5">
            {result.routineMatin.map((step, i) => (
              <li key={i} className="text-xs text-[#2b1620]/80 flex gap-2">
                <span className="text-[#d6407a] font-bold">{i + 1}.</span> {step}
              </li>
            ))}
          </ol>
        </div>
        <div className="premium-card rounded-2xl p-5">
          <h3 className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-[#2b1620]/50 font-semibold mb-3">
            <Moon className="w-3.5 h-3.5" /> Routine soir
          </h3>
          <ol className="space-y-1.5">
            {result.routineSoir.map((step, i) => (
              <li key={i} className="text-xs text-[#2b1620]/80 flex gap-2">
                <span className="text-[#d6407a] font-bold">{i + 1}.</span> {step}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Produits recommandés */}
      {result.produitsRecommandes.length > 0 && (
        <div className="premium-card rounded-2xl p-5 mb-4">
          <h3 className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-[#2b1620]/50 font-semibold mb-3">
            <ShoppingBag className="w-3.5 h-3.5" /> Produits recommandés (disponibles à Abidjan)
          </h3>
          <div className="space-y-2.5">
            {result.produitsRecommandes.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 bg-[#fdf1f5] rounded-xl p-3">
                <div>
                  <span className="text-sm text-[#2b1620] font-medium">{p.name}</span>
                  <p className="text-[11px] text-[#2b1620]/50">{p.brand} · {p.category}</p>
                </div>
                <span className="text-sm font-bold text-[#d6407a] shrink-0">{p.price_fcfa.toLocaleString("fr-FR")} F</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-start gap-2.5 text-[11px] text-[#2b1620]/40 leading-relaxed px-1">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
        <p>Analyse indicative de niveau {result.confiance}% de confiance — ne remplace pas un avis médical. SkinDiag ne fournit pas de diagnostic.</p>
      </div>
    </div>
  );
}
