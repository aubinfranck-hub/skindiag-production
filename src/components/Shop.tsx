import React, { useState, useEffect } from "react";
import { ShoppingBag, Star, Search } from "lucide-react";
import { Product, ACTIF_LABELS } from "../types";
import OrderModal from "./OrderModal";

const CATEGORY_LABELS: Record<string, string> = {
  cleanser: "Nettoyants",
  serum: "Sérums",
  moisturizer: "Crèmes hydratantes",
  sunscreen: "Protection solaire",
};

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

  const filtered = products.filter((p) => {
    const matchesCategory = category === "all" || p.category === category;
    const matchesSearch = search.trim() === "" || p.name.toLowerCase().includes(search.toLowerCase()) || p.brand.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Sponsorisés d'abord (mais uniquement un tri d'affichage, jamais un filtre — tout reste visible)
  const sorted = [...filtered].sort((a, b) => Number(b.is_sponsored) - Number(a.is_sponsored));

  return (
    <div className="animate-fade-in">
      <h2 className="text-xl sm:text-2xl font-display font-semibold text-[#2b1620] mb-1">Boutique</h2>
      <p className="text-xs sm:text-sm text-[#2b1620]/60 mb-4">Tous les produits disponibles, à commander directement.</p>

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

      {loading ? (
        <p className="text-sm text-[#2b1620]/40 text-center py-10">Chargement...</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-[#2b1620]/40 text-center py-10">Aucun produit trouvé.</p>
      ) : (
        <div className="space-y-2.5">
          {sorted.map((p) => (
            <div key={p.id} className={`rounded-2xl p-3.5 ${p.is_sponsored ? "bg-white border-2 border-[#d6407a]/30" : "premium-card"}`}>
              <div className="flex items-start gap-3">
                {p.image_url && (
                  <img src={p.image_url} alt={p.name} className="w-16 h-16 rounded-xl object-cover shrink-0 bg-white" />
                )}
                <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {p.is_sponsored && <Star className="w-3.5 h-3.5 text-[#d6407a] fill-[#d6407a] shrink-0" />}
                    <span className="text-sm font-semibold text-[#2b1620] truncate">{p.name}</span>
                  </div>
                  <span className="text-[11px] text-[#2b1620]/50">{p.brand} · {CATEGORY_LABELS[p.category] || p.category}</span>
                  {p.actifs?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {p.actifs.map((a) => (
                        <span key={a} className="text-[9px] bg-[#fdf1f5] border border-[#d6407a]/20 text-[#d6407a] px-1.5 py-0.5 rounded-full">
                          {ACTIF_LABELS[a] || a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-sm font-bold text-[#d6407a] shrink-0">{p.price_fcfa.toLocaleString("fr-FR")} F</span>
                </div>
              </div>
              <button
                onClick={() => setOrderingProduct(p)}
                className="w-full mt-2.5 flex items-center justify-center gap-1.5 bg-[#2b1620]/[0.04] hover:bg-[#2b1620]/[0.07] text-[#2b1620] text-xs font-semibold py-2 rounded-lg transition cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5" /> Commander
              </button>
            </div>
          ))}
        </div>
      )}

      {orderingProduct && (
        <OrderModal product={orderingProduct} token={token} onClose={() => setOrderingProduct(null)} />
      )}
    </div>
  );
}
