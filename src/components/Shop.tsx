import React, { useState, useEffect } from "react";
import { ShoppingBag, Star, Search, Truck, MessageCircle, Wallet, Play } from "lucide-react";
import { Product, ACTIF_LABELS } from "../types";
import OrderModal from "./OrderModal";
import ProductDetail from "./ProductDetail";

const CATEGORY_LABELS: Record<string, string> = {
  cleanser: "Nettoyants",
  serum: "Sérums",
  moisturizer: "Crèmes hydratantes",
  sunscreen: "Protection solaire",
  baby: "Soins bébé",
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

function ProductTile({ product, onOrder, onOpenDetail }: { product: Product; onOrder: () => void; onOpenDetail: () => void }) {
  const hasPromo = product.original_price_fcfa && product.original_price_fcfa > product.price_fcfa;
  return (
    <div className={`rounded-3xl p-2.5 sm:p-3 shadow-sm transition hover:shadow-md ${product.is_sponsored ? "bg-white border-2 border-[#d6407a]/30" : "premium-card"}`}>
      <div className="flex flex-col gap-2">
        {product.image_url ? (
          <button onClick={onOpenDetail} className="relative block w-full aspect-[3/4] sm:aspect-square rounded-2xl overflow-hidden shrink-0 cursor-pointer bg-[#fff5f8]">
            <img src={product.image_url} alt={product.name} loading="lazy" decoding="async" className="w-full h-full object-contain p-0.5 sm:p-1" />
            <span className="absolute bottom-1.5 left-1.5 right-1.5 rounded-xl bg-[#c60056] px-1.5 py-2 text-center text-xs sm:text-sm font-extrabold text-white shadow-md">{product.price_fcfa.toLocaleString("fr-FR")} F TTC</span>
            {product.video_url && (
              <span className="absolute inset-0 bg-black/25 flex items-center justify-center">
                <Play className="w-4 h-4 text-white fill-white" />
              </span>
            )}
          </button>
        ) : <div className="w-full aspect-[3/4] sm:aspect-square rounded-2xl bg-[#fff5f8] flex items-center justify-center text-xs text-[#7d6170]">Photo en préparation</div>}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {product.is_sponsored && <Star className="w-3 h-3 text-[#d6407a] fill-[#d6407a] shrink-0" />}
                {product.is_new && <span className="text-[11px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full shrink-0">NOUVEAU</span>}
                <span className="text-sm sm:text-base font-bold text-[#2b1620] leading-snug line-clamp-2">{product.name}</span>
              </div>
              <span className="text-xs text-[#2b1620]/60">{product.brand} · {CATEGORY_LABELS[product.category] || product.category}</span>
              {product.rating_count > 0 && <StarRating avg={product.rating_avg} count={product.rating_count} />}
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
      <p className="mt-2 text-xs text-[#6c5360] line-clamp-2">{product.brand} · {CATEGORY_LABELS[product.category] || product.category} · {product.actifs?.length ? `Actifs : ${product.actifs.map(a => ACTIF_LABELS[a] || a).join(", ")}` : "Voir la fiche pour les détails du produit."}</p>
      <button
        onClick={onOrder}
        className="w-full mt-3 flex items-center justify-center gap-2 bg-[#d6407a] hover:bg-[#b82d65] text-white text-sm font-semibold py-3 rounded-xl transition cursor-pointer min-h-11"
      >
        <ShoppingBag className="w-3.5 h-3.5" /> Commander
      </button>
    </div>
  );
}

export default function Shop({ token }: { token: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [orderingProduct, setOrderingProduct] = useState<Product | null>(null);
  const [viewingDetail, setViewingDetail] = useState<Product | null>(null);

  useEffect(() => {
    fetch("/api/skindiag/products")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setProducts(data.products.filter((p: Product) => !/m[eé]la/i.test(`${p.name} ${p.brand}`)));
      })
      .catch(() => setLoadError(true))
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
      <div className="rounded-3xl bg-gradient-to-br from-[#2b1620] to-[#8e315c] text-white p-5 sm:p-7 mb-5 shadow-lg"><span className="text-xs tracking-[0.2em] uppercase text-white/70">SkinDiag sélection</span><h2 className="text-2xl sm:text-3xl font-display font-bold mt-2">Votre rituel beauté, en confiance.</h2><p className="text-sm text-white/80 mt-2">Soins visage, corps et bébé. Découvrez nos produits et commandez simplement depuis votre téléphone.</p></div>
      <p className="text-xs sm:text-sm text-[#2b1620]/60 mb-4">Achetez directement, sans scanner la peau. L’analyse reste disponible pour des conseils personnalisés.</p>

      {/* Bandeau confiance, façon boutique en ligne */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="premium-card rounded-xl p-2.5 text-center">
          <Truck className="w-4 h-4 text-[#d6407a] mx-auto mb-1" />
          <span className="text-[11px] text-[#2b1620]/70 font-medium leading-tight block">Livraison à Abidjan</span>
        </div>
        <div className="premium-card rounded-xl p-2.5 text-center">
          <Wallet className="w-4 h-4 text-[#d6407a] mx-auto mb-1" />
          <span className="text-[11px] text-[#2b1620]/70 font-medium leading-tight block">Paiement Jeko</span>
        </div>
        <a href="https://wa.me/2250757854307" target="_blank" rel="noopener noreferrer" className="premium-card rounded-xl p-2.5 text-center hover:-translate-y-0.5 transition">
          <MessageCircle className="w-4 h-4 text-[#128c7e] mx-auto mb-1" />
          <span className="text-[11px] text-[#128c7e] font-medium leading-tight block">WhatsApp : 07 57 85 43 07</span>
        </a>
      </div>

      {loadError && <p role="alert" className="mb-4 text-sm text-rose-700">Impossible de charger le catalogue. Réessayez dans quelques instants.</p>}
      {loading ? (
        <p className="text-sm text-[#2b1620]/40 text-center py-10">Chargement...</p>
      ) : (
        <>
          {nouveautes.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-[#2b1620] mb-2.5">Nouveautés 🆕</h3>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {nouveautes.map((p) => (
                  <ProductTile key={p.id} product={p} onOrder={() => setOrderingProduct(p)} onOpenDetail={() => setViewingDetail(p)} />
                ))}
              </div>
            </div>
          )}

          {promos.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-[#2b1620] mb-2.5">Promos ⭐</h3>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {promos.map((p) => (
                  <ProductTile key={p.id} product={p} onOrder={() => setOrderingProduct(p)} onOpenDetail={() => setViewingDetail(p)} />
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
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {sorted.map((p) => (
                <ProductTile key={p.id} product={p} onOrder={() => setOrderingProduct(p)} onOpenDetail={() => setViewingDetail(p)} />
              ))}
            </div>
          )}
        </>
      )}

      {orderingProduct && (
        <OrderModal product={orderingProduct} token={token} onClose={() => setOrderingProduct(null)} />
      )}

      {viewingDetail && (
        <ProductDetail
          product={viewingDetail}
          onClose={() => setViewingDetail(null)}
          onOrder={() => { setOrderingProduct(viewingDetail); setViewingDetail(null); }}
        />
      )}
    </div>
  );
}
