import React, { useState, useEffect } from "react";
import { ShoppingBag, Star, Search, Truck, MessageCircle, Wallet } from "lucide-react";
import { Product, ACTIF_LABELS } from "../types";
import OrderModal from "./OrderModal";

const CATEGORY_LABELS: Record<string, string> = {
  cleanser: "Nettoyants",
  serum: "Sérums",
  moisturizer: "Crèmes hydratantes",
  sunscreen: "Protection solaire",
};

function StarRating({ avg, count }: { avg: number; count: number }) {
  return (
    <div className="flex items-center gap-1 mt-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className={`w-3 h-3 ${i <= Math.round(avg) ? "fill-amber-400 text-amber-400" : "text-[#2b1620]/15"}`} />
        ))}
      </div>
      <span className="text-xs text-[#2b1620]/50">{avg} ({count})</span>
    </div>
  );
}

function ProductTile({ product, onOrder }: { product: Product; onOrder: () => void }) {
  const hasPromo = product.original_price_fcfa && product.original_price_fcfa > product.price_fcfa;
  return (
    <div className={`rounded-2xl p-3.5 ${product.is_sponsored ? "bg-white border-2 border-[#d6407a]/30" : "premium-card"}`}>
      <div className="flex items-start gap-3">
        {product.image_url && (
          <img src={product.image_url} alt={product.name} className="w-16 h-16 rounded-xl object-cover shrink-0 bg-white" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {product.is_sponsored && <Star className="w-3 h-3 text-[#d6407a] fill-[#d6407a] shrink-0" />}
                {product.is_new && <span className="text-[11px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full shrink-0">NOUVEAU</span>}
                <span className="text-base font-semibold text-[#2b1620] truncate">{product.name}</span>
              </div>
              <span className="text-xs text-[#2b1620]/60">{product.brand} · {CATEGORY_LABELS[product.category] || product.category}</span>
              <StarRating avg={product.rating_avg} count={product.rating_count} />
            </div>
            <div className="text-right shrink-0">
              {hasPromo && (
                <span className="text-sm text-[#2b1620]/40 line-through block">{product.original_price_fcfa!.toLocaleString("fr-FR")} F</span>
              )}
              <span className={`text-base font-bold block ${hasPromo ? "text-rose-600" : "text-[#d6407a]"}`}>{product.price_fcfa.toLocaleString("fr-FR")} F</span>
            </div>
          </div>
          {product.actifs?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {product.actifs.map((a) => (
                <span key={a} className="text-[11px] bg-[#fdf1f5] border border-[#d6407a]/20 text-[#d6407a] px-1.5 py-0.5 rounded-full">
                  {ACTIF_LABELS[a] || a}
                </span>
              ))}
            </div>
          )}
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

export default function Shop({ token }: { token: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [orderingProduct, setOrderingProduct] = useState<Product | null>(null);

  useEffect(() => {
    fetch("/api/skindiag/products")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setProducts(data.products);
      })
      .finally(() => setLoading(false));
  }, []);

  const categories = ["all", ...Array.from(new Set(products.map((p) => p.category)))];
  const nouveautes = products.filter((p) => p.is_new);
  const promos = products.filter((p) => p.original_price_fcfa && p.original_price_fcfa > p.price_fcfa);

  const filtered = products.filter((p) => {
    const matchesCategory = category === "all" || p.category === category;
    const matchesSearch = search.trim() === "" || p.name.toLowerCase().includes(search.toLowerCase()) || p.brand.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });
  const sorted = [...filtered].sort((a, b) => Number(b.is_sponsored) - Number(a.is_sponsored));

  return (
    <div className="animate-fade-in">
      <h2 className="text-xl sm:text-2xl font-display font-semibold text-[#2b1620] mb-1">Boutique</h2>
      <p className="text-xs sm:text-sm text-[#2b1620]/60 mb-4">Tous les produits disponibles, à commander directement.</p>

      {/* Bandeau confiance, façon boutique en ligne */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="premium-card rounded-xl p-2.5 text-center">
          <Truck className="w-4 h-4 text-[#d6407a] mx-auto mb-1" />
          <span className="text-[11px] text-[#2b1620]/70 font-medium leading-tight block">Livraison à Abidjan</span>
        </div>
        <div className="premium-card rounded-xl p-2.5 text-center">
          <Wallet className="w-4 h-4 text-[#d6407a] mx-auto mb-1" />
          <span className="text-[11px] text-[#2b1620]/70 font-medium leading-tight block">Paiement à la livraison</span>
        </div>
        <a href="https://wa.me/2250757854307" target="_blank" rel="noopener noreferrer" className="premium-card rounded-xl p-2.5 text-center hover:-translate-y-0.5 transition">
          <MessageCircle className="w-4 h-4 text-[#d6407a] mx-auto mb-1" />
          <span className="text-[11px] text-[#2b1620]/70 font-medium leading-tight block">Service client WhatsApp</span>
        </a>
      </div>

      {loading ? (
        <p className="text-sm text-[#2b1620]/40 text-center py-10">Chargement...</p>
      ) : (
        <>
          {nouveautes.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-[#2b1620] mb-2.5">Nouveautés 🆕</h3>
              <div className="space-y-2.5">
                {nouveautes.map((p) => (
                  <ProductTile key={p.id} product={p} onOrder={() => setOrderingProduct(p)} />
                ))}
              </div>
            </div>
          )}

          {promos.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-[#2b1620] mb-2.5">Promos ⭐</h3>
              <div className="space-y-2.5">
                {promos.map((p) => (
                  <ProductTile key={p.id} product={p} onOrder={() => setOrderingProduct(p)} />
                ))}
              </div>
            </div>
          )}

          <h3 className="text-sm font-semibold text-[#2b1620] mb-2.5">Tous les produits</h3>

          <div className="relative mb-3">
            <Search className="w-4 h-4 text-[#2b1620]/30 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text" placeholder="Rechercher un produit ou une marque..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-[#2b1620]/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#2b1620] placeholder-[#2b1620]/30 focus:outline-none focus:border-[#d6407a]"
            />
          </div>

          <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition cursor-pointer ${
                  category === c ? "bg-[#d6407a] text-white" : "bg-white text-[#2b1620]/60 border border-[#2b1620]/10"
                }`}
              >
                {c === "all" ? "Tous" : CATEGORY_LABELS[c] || c}
              </button>
            ))}
          </div>

          {sorted.length === 0 ? (
            <p className="text-sm text-[#2b1620]/40 text-center py-10">Aucun produit trouvé.</p>
          ) : (
            <div className="space-y-2.5">
              {sorted.map((p) => (
                <ProductTile key={p.id} product={p} onOrder={() => setOrderingProduct(p)} />
              ))}
            </div>
          )}
        </>
      )}

      {orderingProduct && (
        <OrderModal product={orderingProduct} token={token} onClose={() => setOrderingProduct(null)} />
      )}
    </div>
  );
}
