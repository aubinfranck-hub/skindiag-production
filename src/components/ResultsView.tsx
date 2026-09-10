import React, { useState } from "react";
import { ArrowLeft, AlertTriangle, Sun, Moon, ShoppingBag, ShieldCheck, HelpCircle, Star, Sparkles } from "lucide-react";
import { SkinAnalysisResult, Product, ACTIF_LABELS, SKIN_TONE_LABELS } from "../types";
import OrderModal from "./OrderModal";

interface ResultsViewProps {
  result: SkinAnalysisResult;
  token: string;
  onRestart: () => void;
  restartLabel?: string;
}

function ProductCard({ product, highlighted, onOrder }: { product: Product; highlighted: boolean; onOrder: () => void }) {
  return (
    <div className={`rounded-2xl p-3.5 ${highlighted ? "bg-white border-2 border-[#d6407a]/30" : "bg-[#fdf1f5]"}`}>
      <div className="flex items-start gap-3">
        {product.image_url && (
          <img src={product.image_url} alt={product.name} className="w-14 h-14 rounded-xl object-cover shrink-0 bg-white" />
        )}
        <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {highlighted && <Star className="w-3.5 h-3.5 text-[#d6407a] fill-[#d6407a] shrink-0" />}
            <span className="text-sm font-semibold text-[#2b1620] truncate">{product.name}</span>
          </div>
          <span className="text-[11px] text-[#2b1620]/50">{product.brand}</span>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {product.actifsCorrespondants.map((a) => (
              <span key={a} className="text-[9px] bg-white border border-[#d6407a]/20 text-[#d6407a] px-1.5 py-0.5 rounded-full">
                {ACTIF_LABELS[a] || a}
              </span>
            ))}
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="text-sm font-bold text-[#d6407a] block">{product.price_fcfa.toLocaleString("fr-FR")} F</span>
          <span className="text-[10px] text-[#2b1620]/40">{product.matchScore}% correspondance</span>
        </div>
        </div>
      </div>
      <button
        onClick={onOrder}
        className="w-full mt-2.5 flex items-center justify-center gap-1.5 bg-[#2b1620]/[0.04] hover:bg-[#2b1620]/[0.07] text-[#2b1620] text-xs font-semibold py-2 rounded-lg transition cursor-pointer"
      >
        <ShoppingBag className="w-3.5 h-3.5" /> Commander
      </button>
    </div>
  );
}

export default function ResultsView({ result, token, onRestart, restartLabel }: ResultsViewProps) {
  const [orderingProduct, setOrderingProduct] = useState<Product | null>(null);

  return (
    <div className="animate-fade-in">
      <button onClick={onRestart} className="flex items-center gap-1.5 text-xs font-semibold text-[#d6407a] bg-white shadow-[0_4px_14px_-6px_rgba(214,64,122,0.4)] rounded-full px-3.5 py-2 mb-4 hover:-translate-y-0.5 transition cursor-pointer">
        <ArrowLeft className="w-4 h-4" /> {restartLabel || "Nouvelle analyse"}
      </button>

      {!result.analyseConcluante ? (
        // Analyse non concluante : on ne fabrique aucune conclusion, on l'assume clairement
        <div className="premium-card rounded-3xl p-6 text-center">
          <HelpCircle className="w-10 h-10 text-[#2b1620]/30 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-[#2b1620] mb-1.5">Analyse non concluante</h3>
          <p className="text-sm text-[#2b1620]/60 leading-relaxed">{result.explicationSimple}</p>
        </div>
      ) : (
        <>
          {/* Score global */}
          <div className="premium-card rounded-3xl p-6 flex items-center gap-5 mb-4">
            <div className="relative w-20 h-20 shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(43,22,32,0.08)" strokeWidth="10" />
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
              <span className="text-xs uppercase tracking-wider text-[#2b1620]/50 font-medium">Score — {result.zoneAnalysee}</span>
              <p className="text-sm text-[#2b1620] mt-1">Type de peau : <strong>{result.typeDePeau}</strong> · {SKIN_TONE_LABELS[result.profilTeinte] || result.profilTeinte}</p>
              <p className="text-xs text-[#2b1620]/60 mt-0.5">Confiance image : {result.confianceImage}% · Confiance du motif clinique : {result.confianceMotifClinique}%</p>
            </div>
          </div>

          {result.qualiteImage?.decision === "B_exploitable_imparfaite" && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3.5 mb-4 text-xs text-blue-700">
              <strong>Fiabilité réduite :</strong> {result.qualiteImage.message}
            </div>
          )}

          {result.recommandationProfessionnel && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 mb-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-700">Avis d'un professionnel recommandé</p>
                <p className="text-xs text-amber-600/90 mt-1">{result.raisonRecommandation}</p>
              </div>
            </div>
          )}

          {/* Observation (niveau 1) */}
          <div className="premium-card rounded-2xl p-5 mb-4">
            <h3 className="text-xs uppercase tracking-wider text-[#2b1620]/50 font-semibold mb-2">Observation</h3>
            <p className="text-sm text-[#2b1620]/85 leading-relaxed">{result.observation}</p>
          </div>

          {/* Hypothèses compatibles (niveau 2) */}
          {result.hypothesesCompatibles.length > 0 && (
            <div className="premium-card rounded-2xl p-5 mb-4">
              <h3 className="text-xs uppercase tracking-wider text-[#2b1620]/50 font-semibold mb-2">Causes possibles (non un diagnostic)</h3>
              <ul className="space-y-1">
                {result.hypothesesCompatibles.map((h, i) => (
                  <li key={i} className="text-xs text-[#2b1620]/75 flex gap-2">
                    <span className="text-[#d6407a]">•</span> {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Besoins identifiés */}
          {result.besoinsIdentifies.length > 0 && (
            <div className="premium-card rounded-2xl p-5 mb-4">
              <h3 className="text-xs uppercase tracking-wider text-[#2b1620]/50 font-semibold mb-3">Besoins de votre peau</h3>
              <div className="flex flex-wrap gap-2">
                {result.besoinsIdentifies.map((b, i) => (
                  <span key={i} className={`text-xs font-medium px-3 py-1.5 rounded-full ${
                    b.priorite === "principal" ? "bg-[#d6407a] text-white" : "bg-[#fdf1f5] text-[#d6407a]"
                  }`}>
                    {b.besoin}
                  </span>
                ))}
              </div>
              {result.actifsRecherches.length > 0 && (
                <>
                  <h4 className="text-[11px] text-[#2b1620]/40 font-medium mt-3.5 mb-1.5">Actifs recherchés pour ces besoins</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {result.actifsRecherches.map((a) => (
                      <span key={a} className="text-[10px] bg-white border border-[#2b1620]/10 text-[#2b1620]/70 px-2 py-1 rounded-full">
                        {ACTIF_LABELS[a] || a}
                      </span>
                    ))}
                  </div>
                </>
              )}
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

          {/* Produits partenaires (sponsorisés), classés par correspondance réelle */}
          {result.produitsPartenaires.length > 0 && (
            <div className="premium-card rounded-2xl p-5 mb-4">
              <h3 className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-[#d6407a] font-semibold mb-3">
                <Sparkles className="w-3.5 h-3.5" /> Produits partenaires recommandés
              </h3>
              <div className="space-y-2.5">
                {result.produitsPartenaires.map((p) => (
                  <ProductCard key={p.id} product={p} highlighted onOrder={() => setOrderingProduct(p)} />
                ))}
              </div>
            </div>
          )}

          {/* Autres produits compatibles, non sponsorisés — toujours visibles, jamais masqués */}
          {result.autresProduits.length > 0 && (
            <div className="premium-card rounded-2xl p-5 mb-4">
              <h3 className="text-xs uppercase tracking-wider text-[#2b1620]/50 font-semibold mb-3">Autres produits compatibles</h3>
              <div className="space-y-2.5">
                {result.autresProduits.map((p) => (
                  <ProductCard key={p.id} product={p} highlighted={false} onOrder={() => setOrderingProduct(p)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex items-start gap-2.5 text-[11px] text-[#2b1620]/40 leading-relaxed px-1 mt-2">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
        <p>Analyse indicative — ne remplace pas un diagnostic médical. SkinDiag ne fournit pas de diagnostic.</p>
      </div>

      {orderingProduct && (
        <OrderModal product={orderingProduct} token={token} onClose={() => setOrderingProduct(null)} />
      )}
    </div>
  );
}
