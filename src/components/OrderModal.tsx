import React, { useState } from "react";
import { X, Truck, Check } from "lucide-react";
import { Product } from "../types";

interface OrderModalProps {
  product: Product;
  token: string;
  onClose: () => void;
}

export default function OrderModal({ product, token, onClose }: OrderModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [deliveryName, setDeliveryName] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/skindiag/order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId: product.id, quantity, deliveryName, deliveryPhone, deliveryAddress }),
      });
      const data = await res.json();
      if (data.success) {
        setDone(true);
      } else {
        setError(data.message || "Échec de la commande.");
      }
    } catch {
      setError("Erreur réseau.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm max-h-[90vh] overflow-y-auto p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-display font-semibold text-[#2b1620]">Commander</h3>
          <button onClick={onClose} className="text-[#2b1620]/40 hover:text-[#2b1620] cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
              <Check className="w-7 h-7 text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-[#2b1620]">Commande enregistrée</p>
            <p className="text-xs text-[#2b1620]/50 mt-1">Nous vous contacterons pour confirmer la livraison.</p>
            <button onClick={onClose} className="w-full mt-5 bg-[#2b1620]/[0.04] text-[#2b1620] font-medium text-sm py-3 rounded-xl cursor-pointer">
              Fermer
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 bg-[#fdf1f5] rounded-2xl p-3 mb-4">
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-[#2b1620] block">{product.name}</span>
                <span className="text-xs text-[#2b1620]/50">{product.brand}</span>
              </div>
              <span className="text-sm font-bold text-[#d6407a] shrink-0">{product.price_fcfa.toLocaleString("fr-FR")} F</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-[#2b1620]/60 font-medium mb-1">Quantité</label>
                <input
                  type="number" min={1} required value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full bg-[#fdf1f5] border border-[#2b1620]/10 rounded-xl px-3 py-2.5 text-sm text-[#2b1620] focus:outline-none focus:border-[#d6407a]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#2b1620]/60 font-medium mb-1">Nom complet</label>
                <input
                  type="text" required placeholder="Votre nom" value={deliveryName}
                  onChange={(e) => setDeliveryName(e.target.value)}
                  className="w-full bg-[#fdf1f5] border border-[#2b1620]/10 rounded-xl px-3 py-2.5 text-sm text-[#2b1620] placeholder-[#2b1620]/30 focus:outline-none focus:border-[#d6407a]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#2b1620]/60 font-medium mb-1">Téléphone</label>
                <input
                  type="tel" required placeholder="07 12 34 56" value={deliveryPhone}
                  onChange={(e) => setDeliveryPhone(e.target.value)}
                  className="w-full bg-[#fdf1f5] border border-[#2b1620]/10 rounded-xl px-3 py-2.5 text-sm text-[#2b1620] placeholder-[#2b1620]/30 focus:outline-none focus:border-[#d6407a]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#2b1620]/60 font-medium mb-1">Adresse de livraison</label>
                <textarea
                  required placeholder="Quartier, rue, repère..." value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  rows={2}
                  className="w-full bg-[#fdf1f5] border border-[#2b1620]/10 rounded-xl px-3 py-2.5 text-sm text-[#2b1620] placeholder-[#2b1620]/30 focus:outline-none focus:border-[#d6407a] resize-none"
                />
              </div>

              {error && <p className="text-xs text-rose-500">{error}</p>}

              <button
                type="submit" disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#d6407a] to-[#8a2a54] disabled:opacity-50 text-white font-semibold text-sm py-3.5 rounded-xl transition cursor-pointer"
              >
                <Truck className="w-4 h-4" /> {submitting ? "Envoi..." : "Confirmer la commande"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
