import React, { useState } from "react";
import { X, Truck, Check, ExternalLink } from "lucide-react";
import { Product } from "../types";

interface OrderModalProps {
  product: Product;
  token: string;
  onClose: () => void;
}

// Frais de livraison affichés avant validation — le serveur recalcule et fait foi (1 000 F par commande).
const DELIVERY_FEE_DISPLAY = 1000;

interface CreatedOrder {
  orderId: number;
  productsTotal: number;
  deliveryFee: number;
  total: number;
  payUrl: string;
}

const fmt = (n: number) => `${n.toLocaleString("fr-FR")} F`;

export default function OrderModal({ product, token, onClose }: OrderModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [deliveryName, setDeliveryName] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<CreatedOrder | null>(null);
  const [reference, setReference] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const safeQty = Math.min(Math.max(Math.floor(quantity) || 1, 1), 20);
  const previewProducts = product.price_fcfa * safeQty;
  const previewTotal = previewProducts + DELIVERY_FEE_DISPLAY;

  const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  // Étape 1 : crée la commande ; le serveur calcule le total (produits + livraison).
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/skindiag/order", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ productId: product.id, quantity: safeQty, deliveryName, deliveryPhone, deliveryAddress }),
      });
      const data = await res.json();
      if (data.success) {
        setOrder(data);
      } else {
        setError(data.message || "Échec de la commande.");
      }
    } catch {
      setError("Erreur réseau.");
    } finally {
      setSubmitting(false);
    }
  };

  // Étape 2 : le client a payé via Wave et envoie l'identifiant de transaction pour vérification.
  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/skindiag/order/${order.orderId}/confirm-payment`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ reference }),
      });
      const data = await res.json();
      if (data.success) {
        setDone(true);
      } else {
        setError(data.message || "Échec de l'enregistrement du paiement.");
      }
    } catch {
      setError("Erreur réseau.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full bg-[#fdf1f5] border border-[#2b1620]/10 rounded-xl px-3 py-2.5 text-sm text-[#2b1620] placeholder-[#2b1620]/30 focus:outline-none focus:border-[#d6407a]";

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm max-h-[90vh] overflow-y-auto p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-display font-semibold text-[#2b1620]">{order ? "Paiement" : "Commander"}</h3>
          <button onClick={onClose} className="text-[#2b1620]/40 hover:text-[#2b1620] cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
              <Check className="w-7 h-7 text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-[#2b1620]">Paiement reçu — en cours de vérification</p>
            <p className="text-xs text-[#2b1620]/50 mt-1">
              Dès validation de votre paiement Wave, nous vous contactons pour organiser la livraison.
            </p>
            <button onClick={onClose} className="w-full mt-5 bg-[#2b1620]/[0.04] text-[#2b1620] font-medium text-sm py-3 rounded-xl cursor-pointer">
              Fermer
            </button>
          </div>
        ) : order ? (
          <form onSubmit={handleConfirmPayment} className="space-y-3">
            <div className="bg-[#fdf1f5] rounded-2xl p-4 space-y-1.5 text-sm text-[#2b1620]">
              <div className="flex justify-between"><span className="text-[#2b1620]/60">Produits</span><span>{fmt(order.productsTotal)}</span></div>
              <div className="flex justify-between"><span className="text-[#2b1620]/60">Livraison</span><span>{fmt(order.deliveryFee)}</span></div>
              <div className="flex justify-between font-bold text-[#d6407a] pt-1.5 border-t border-[#2b1620]/10">
                <span>Total à payer</span><span>{fmt(order.total)}</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-[#d6407a] text-white text-xs font-bold flex items-center justify-center">1</span>
              <p className="text-sm text-[#2b1620]">Payez <strong>{fmt(order.total)}</strong> via Wave.</p>
            </div>
            <a
              href={order.payUrl}
              target="_blank" rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-[#1DC48D] hover:bg-[#17a878] text-white font-semibold text-sm py-3.5 rounded-xl transition cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" /> Ouvrir Wave — Payer {fmt(order.total)}
            </a>

            <div className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-[#d6407a] text-white text-xs font-bold flex items-center justify-center">2</span>
              <p className="text-sm text-[#2b1620]">Saisissez l'identifiant de transaction indiqué sur votre reçu Wave.</p>
            </div>
            <input
              type="text" required minLength={4} placeholder="Ex : T_XXXXXXXXXXXX" value={reference}
              onChange={(e) => setReference(e.target.value)}
              className={inputClass}
            />

            {error && <p className="text-xs text-rose-500">{error}</p>}

            <button
              type="submit" disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#d6407a] to-[#8a2a54] disabled:opacity-50 text-white font-semibold text-sm py-3.5 rounded-xl transition cursor-pointer"
            >
              <Check className="w-4 h-4" /> {submitting ? "Envoi..." : "J'ai payé — Confirmer"}
            </button>
          </form>
        ) : (
          <>
            <div className="flex items-center gap-3 bg-[#fdf1f5] rounded-2xl p-3 mb-4">
              {product.image_url && (
                <img src={product.image_url} alt={product.name} className="w-12 h-12 rounded-lg object-cover shrink-0 bg-white" />
              )}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-[#2b1620] block">{product.name}</span>
                <span className="text-xs text-[#2b1620]/50">{product.brand}</span>
              </div>
              <span className="text-sm font-bold text-[#d6407a] shrink-0">{fmt(product.price_fcfa)}</span>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs text-[#2b1620]/60 font-medium mb-1">Quantité</label>
                <input
                  type="number" min={1} max={20} required value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-[#2b1620]/60 font-medium mb-1">Nom complet</label>
                <input
                  type="text" required placeholder="Votre nom" value={deliveryName}
                  onChange={(e) => setDeliveryName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-[#2b1620]/60 font-medium mb-1">Téléphone</label>
                <input
                  type="tel" required placeholder="07 12 34 56" value={deliveryPhone}
                  onChange={(e) => setDeliveryPhone(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-[#2b1620]/60 font-medium mb-1">Adresse de livraison</label>
                <textarea
                  required placeholder="Quartier, rue, repère..." value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  rows={2}
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div className="bg-[#fdf1f5] rounded-2xl p-4 space-y-1.5 text-sm text-[#2b1620]">
                <div className="flex justify-between"><span className="text-[#2b1620]/60">Produits ({safeQty})</span><span>{fmt(previewProducts)}</span></div>
                <div className="flex justify-between"><span className="text-[#2b1620]/60">Livraison</span><span>{fmt(DELIVERY_FEE_DISPLAY)}</span></div>
                <div className="flex justify-between font-bold text-[#d6407a] pt-1.5 border-t border-[#2b1620]/10">
                  <span>Total</span><span>{fmt(previewTotal)}</span>
                </div>
              </div>

              {error && <p className="text-xs text-rose-500">{error}</p>}

              <button
                type="submit" disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#d6407a] to-[#8a2a54] disabled:opacity-50 text-white font-semibold text-sm py-3.5 rounded-xl transition cursor-pointer"
              >
                <Truck className="w-4 h-4" /> {submitting ? "Envoi..." : `Continuer — payer ${fmt(previewTotal)}`}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
