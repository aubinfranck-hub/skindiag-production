import React, { useState } from "react";
import { X, ShoppingBag, Star, Play } from "lucide-react";
import { Product, ACTIF_LABELS } from "../types";

interface ProductDetailProps {
  product: Product;
  onClose: () => void;
  onOrder: () => void;
}

export default function ProductDetail({ product, onClose, onOrder }: ProductDetailProps) {
  const [showVideo, setShowVideo] = useState(false);
  const hasPromo = product.original_price_fcfa && product.original_price_fcfa > product.price_fcfa;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto animate-fade-in">
        <div className="relative">
          {/* Grande image (ou vidéo si demandée), en plein format — remplace la petite vignette */}
          <div className="relative aspect-square bg-[#fdf1f5]">
            {showVideo && product.video_url ? (
              <video src={product.video_url} controls autoPlay className="w-full h-full object-contain bg-black" />
            ) : (
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            )}
            {!showVideo && product.video_url && (
              <button
                onClick={() => setShowVideo(true)}
                className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition cursor-pointer"
              >
                <span className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                  <Play className="w-6 h-6 text-[#d6407a] fill-[#d6407a]" />
                </span>
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow-lg cursor-pointer"
          >
            <X className="w-5 h-5 text-[#2b1620]" />
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-1.5">
            {product.is_sponsored && <Star className="w-3.5 h-3.5 text-[#d6407a] fill-[#d6407a] shrink-0" />}
            {product.is_new && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">NOUVEAU</span>}
          </div>
          <h3 className="text-lg font-display font-semibold text-[#2b1620] mt-1">{product.name}</h3>
          <p className="text-sm text-[#2b1620]/50">{product.brand}</p>

          <div className="flex items-center gap-1 mt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className={`w-3.5 h-3.5 ${i <= Math.round(product.rating_avg) ? "fill-amber-400 text-amber-400" : "text-[#2b1620]/15"}`} />
            ))}
            <span className="text-xs text-[#2b1620]/50">{product.rating_avg} ({product.rating_count} avis)</span>
          </div>

          <div className="mt-3">
            {hasPromo && (
              <span className="text-sm text-[#2b1620]/40 line-through mr-2">{product.original_price_fcfa!.toLocaleString("fr-FR")} F</span>
            )}
            <span className={`text-xl font-bold ${hasPromo ? "text-rose-600" : "text-[#d6407a]"}`}>{product.price_fcfa.toLocaleString("fr-FR")} F</span>
          </div>

          {product.actifs?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {product.actifs.map((a) => (
                <span key={a} className="text-xs bg-[#fdf1f5] border border-[#d6407a]/20 text-[#d6407a] px-2 py-1 rounded-full">
                  {ACTIF_LABELS[a] || a}
                </span>
              ))}
            </div>
          )}

          {product.inci_composition && (
            <div className="mt-4">
              <h4 className="text-xs uppercase tracking-wider text-[#2b1620]/40 font-semibold mb-1">Composition INCI</h4>
              <p className="text-xs text-[#2b1620]/60 leading-relaxed">{product.inci_composition}</p>
            </div>
          )}

          <button
            onClick={onOrder}
            className="w-full mt-5 flex items-center justify-center gap-2 bg-gradient-to-r from-[#d6407a] to-[#8a2a54] text-white font-semibold text-sm py-3.5 rounded-xl transition cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" /> Commander
          </button>
        </div>
      </div>
    </div>
  );
}
