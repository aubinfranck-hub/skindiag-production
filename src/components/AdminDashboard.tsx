import React, { useState, useEffect, useCallback } from "react";
import { UserPlus, Users, Check, X, RefreshCw, Truck, Package, Star } from "lucide-react";

interface Account {
  phone: string;
  createdAt: number;
  isAdmin: boolean;
  plan: string;
}

interface PendingActivation {
  phone: string;
  plan: string;
  amount: number;
  requestedAt: number;
}

interface Order {
  id: number;
  phone: string;
  product_name: string;
  price_fcfa: number;
  quantity: number;
  delivery_name: string;
  delivery_phone: string;
  delivery_address: string;
  status: string;
  created_at: number;
}

interface ProductRow {
  id: number;
  name: string;
  brand: string;
  category: string;
  price_fcfa: number;
  actifs: string[];
  inci_composition: string;
  is_sponsored: boolean;
  is_partner: boolean;
  availability_abidjan: boolean;
}

const ACTIFS_DISPONIBLES = ["vitamine_c", "niacinamide", "acide_hyaluronique", "ceramides", "glycerine", "acide_azelaique", "beurre_de_karite", "protection_solaire", "retinoides", "uree"];

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
};

const PLAN_LABELS: Record<string, string> = {
  free_trial: "Essai gratuit",
  free_expired: "Expiré",
  payg_day: "Pass Jour",
  monthly: "Mensuel",
  premium: "Premium",
};

export default function AdminDashboard({ token }: { token: string }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [pending, setPending] = useState<PendingActivation[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState("free_trial");
  const [creating, setCreating] = useState(false);
  const [createdInfo, setCreatedInfo] = useState<{ phone: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [prodName, setProdName] = useState("");
  const [prodBrand, setProdBrand] = useState("");
  const [prodCategory, setProdCategory] = useState("serum");
  const [prodPrice, setProdPrice] = useState("");
  const [prodActifs, setProdActifs] = useState<string[]>([]);
  const [prodInci, setProdInci] = useState("");
  const [prodVideoUrl, setProdVideoUrl] = useState("");
  const [prodSponsored, setProdSponsored] = useState(false);
  const [prodPartner, setProdPartner] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [accRes, pendRes, ordersRes, productsRes] = await Promise.all([
        fetch("/api/admin/accounts", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/pending-activations", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/orders", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/skindiag/products"),
      ]);
      const accData = await accRes.json();
      const pendData = await pendRes.json();
      const ordersData = await ordersRes.json();
      const productsData = await productsRes.json();
      if (accData.success) setAccounts(accData.accounts);
      if (pendData.success) setPending(pendData.pending);
      if (ordersData.success) setOrders(ordersData.orders);
      if (productsData.success) setProducts(productsData.products);
    } catch {
      // silencieux, l'utilisateur peut rafraîchir
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const toggleSponsor = async (p: ProductRow, field: "is_sponsored" | "is_partner") => {
    try {
      await fetch(`/api/admin/products/${p.id}/sponsor`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          is_sponsored: field === "is_sponsored" ? !p.is_sponsored : p.is_sponsored,
          is_partner: field === "is_partner" ? !p.is_partner : p.is_partner,
        }),
      });
      load();
    } catch {
      // silencieux
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProduct(true);
    setProductError(null);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: prodName, brand: prodBrand, category: prodCategory,
          price_fcfa: Number(prodPrice), actifs: prodActifs, inci_composition: prodInci,
          video_url: prodVideoUrl,
          is_sponsored: prodSponsored, is_partner: prodPartner,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setProdName(""); setProdBrand(""); setProdPrice(""); setProdActifs([]); setProdInci(""); setProdVideoUrl("");
        setProdSponsored(false); setProdPartner(false);
        load();
      } else {
        setProductError(data.message || "Échec de l'enregistrement.");
      }
    } catch {
      setProductError("Erreur réseau.");
    } finally {
      setSavingProduct(false);
    }
  };

  const updateOrderStatus = async (orderId: number, status: string) => {
    try {
      await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      load();
    } catch {
      // silencieux
    }
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let pwd = "";
    for (let i = 0; i < 8; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    return pwd;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const generatedPwd = password || generatePassword();
    try {
      const res = await fetch("/api/admin/create-account", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone, password: generatedPwd, plan }),
      });
      const data = await res.json();
      if (data.success) {
        setCreatedInfo({ phone, password: generatedPwd });
        setPhone(""); setPassword("");
        load();
      } else {
        setError(data.message || "Échec de la création.");
      }
    } catch {
      setError("Erreur réseau.");
    } finally {
      setCreating(false);
    }
  };

  const handleActivate = async (p: string) => {
    try {
      await fetch(`/api/admin/activate-plan/${encodeURIComponent(p)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      load();
    } catch {
      // silencieux
    }
  };

  return (
    <div className="animate-fade-in space-y-5">
      <h2 className="text-2xl font-display font-semibold text-[#2b1620] mb-1">Administration</h2>

      {/* Création de compte */}
      <div className="premium-card rounded-2xl p-5">
        <h3 className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-[#2b1620]/50 font-semibold mb-3">
          <UserPlus className="w-3.5 h-3.5" /> Créer un compte
        </h3>
        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <input
            type="tel" required placeholder="+225 07 12 34 56"
            value={phone} onChange={(e) => setPhone(e.target.value)}
            className="bg-white border border-[#2b1620]/10 rounded-xl px-3 py-2.5 text-xs text-[#2b1620] placeholder-[#2b1620]/30 focus:outline-none focus:border-[#d6407a] font-mono"
          />
          <select
            value={plan} onChange={(e) => setPlan(e.target.value)}
            className="bg-white border border-[#2b1620]/10 rounded-xl px-3 py-2.5 text-xs text-[#2b1620] focus:outline-none focus:border-[#d6407a]"
          >
            <option value="free_trial">Essai gratuit</option>
            <option value="payg_day">Pass Jour</option>
            <option value="monthly">Mensuel</option>
            <option value="premium">Premium</option>
          </select>
          <button
            type="submit" disabled={creating}
            className="sm:col-span-2 bg-gradient-to-r from-[#d6407a] to-[#8a2a54] disabled:opacity-50 text-white font-semibold text-xs py-2.5 rounded-xl transition cursor-pointer"
          >
            {creating ? "Création..." : "Créer le compte (mot de passe généré)"}
          </button>
        </form>
        {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
        {createdInfo && (
          <div className="mt-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5">
            <p className="text-[11px] text-emerald-300 font-bold uppercase mb-1">Compte créé — communiquez ceci :</p>
            <p className="text-xs text-[#2b1620]">Numéro : <strong className="font-mono">{createdInfo.phone}</strong></p>
            <p className="text-xs text-[#2b1620]">Mot de passe : <strong className="font-mono text-base">{createdInfo.password}</strong></p>
          </div>
        )}
      </div>

      {/* Activations en attente */}
      <div className="premium-card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs uppercase tracking-wider text-[#2b1620]/50 font-semibold">Paiements en attente ({pending.length})</h3>
          <button onClick={load} className="text-[#2b1620]/40 hover:text-[#2b1620] cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
        {pending.length === 0 ? (
          <p className="text-xs text-[#2b1620]/40">Aucune demande en attente.</p>
        ) : (
          <div className="space-y-2">
            {pending.map((p) => (
              <div key={p.phone} className="flex items-center justify-between bg-[#fdf1f5] rounded-xl p-3">
                <div>
                  <span className="text-xs font-mono text-[#2b1620]">{p.phone}</span>
                  <p className="text-[10px] text-[#2b1620]/50">{PLAN_LABELS[p.plan]} · {p.amount.toLocaleString("fr-FR")}F</p>
                </div>
                <button
                  onClick={() => handleActivate(p.phone)}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" /> Activer
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Produits & sponsoring */}
      <div className="premium-card rounded-2xl p-5">
        <h3 className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-[#2b1620]/50 font-semibold mb-3">
          <Package className="w-3.5 h-3.5" /> Ajouter un produit
        </h3>
        <form onSubmit={handleCreateProduct} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <input required placeholder="Nom du produit" value={prodName} onChange={(e) => setProdName(e.target.value)}
            className="sm:col-span-2 bg-[#fdf1f5] border border-[#2b1620]/10 rounded-xl px-3 py-2.5 text-xs text-[#2b1620] focus:outline-none focus:border-[#d6407a]" />
          <input required placeholder="Marque" value={prodBrand} onChange={(e) => setProdBrand(e.target.value)}
            className="bg-[#fdf1f5] border border-[#2b1620]/10 rounded-xl px-3 py-2.5 text-xs text-[#2b1620] focus:outline-none focus:border-[#d6407a]" />
          <input required type="number" placeholder="Prix (FCFA)" value={prodPrice} onChange={(e) => setProdPrice(e.target.value)}
            className="bg-[#fdf1f5] border border-[#2b1620]/10 rounded-xl px-3 py-2.5 text-xs text-[#2b1620] focus:outline-none focus:border-[#d6407a]" />
          <select value={prodCategory} onChange={(e) => setProdCategory(e.target.value)}
            className="sm:col-span-2 bg-[#fdf1f5] border border-[#2b1620]/10 rounded-xl px-3 py-2.5 text-xs text-[#2b1620] focus:outline-none focus:border-[#d6407a]">
            <option value="cleanser">Nettoyant</option>
            <option value="serum">Sérum</option>
            <option value="moisturizer">Crème hydratante</option>
            <option value="sunscreen">Protection solaire</option>
          </select>
          <textarea placeholder="Composition INCI complète" value={prodInci} onChange={(e) => setProdInci(e.target.value)} rows={2}
            className="sm:col-span-2 bg-[#fdf1f5] border border-[#2b1620]/10 rounded-xl px-3 py-2.5 text-xs text-[#2b1620] focus:outline-none focus:border-[#d6407a] resize-none" />
          <input placeholder="URL vidéo de présentation (optionnel, mp4)" value={prodVideoUrl} onChange={(e) => setProdVideoUrl(e.target.value)}
            className="sm:col-span-2 bg-[#fdf1f5] border border-[#2b1620]/10 rounded-xl px-3 py-2.5 text-xs text-[#2b1620] focus:outline-none focus:border-[#d6407a]" />

          <div className="sm:col-span-2">
            <p className="text-[10px] text-[#2b1620]/50 font-medium mb-1.5">Actifs contenus (utilisés pour le matching)</p>
            <div className="flex flex-wrap gap-1.5">
              {ACTIFS_DISPONIBLES.map((a) => (
                <button key={a} type="button"
                  onClick={() => setProdActifs((cur) => cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a])}
                  className={`text-[10px] font-medium px-2.5 py-1 rounded-full transition cursor-pointer ${
                    prodActifs.includes(a) ? "bg-[#d6407a] text-white" : "bg-white text-[#2b1620]/60 border border-[#2b1620]/10"
                  }`}>
                  {a.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-[#2b1620]/70 cursor-pointer">
            <input type="checkbox" checked={prodSponsored} onChange={(e) => setProdSponsored(e.target.checked)} /> Sponsorisé ⭐
          </label>
          <label className="flex items-center gap-2 text-xs text-[#2b1620]/70 cursor-pointer">
            <input type="checkbox" checked={prodPartner} onChange={(e) => setProdPartner(e.target.checked)} /> Partenaire
          </label>

          <button type="submit" disabled={savingProduct}
            className="sm:col-span-2 bg-gradient-to-r from-[#d6407a] to-[#8a2a54] disabled:opacity-50 text-white font-semibold text-xs py-2.5 rounded-xl transition cursor-pointer">
            {savingProduct ? "Enregistrement..." : "Enregistrer le produit"}
          </button>
        </form>
        {productError && <p className="text-xs text-rose-500 mt-2">{productError}</p>}

        <div className="mt-4 pt-4 border-t border-[#2b1620]/[0.06] space-y-2">
          {products.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 bg-[#fdf1f5] rounded-xl p-3">
              <div className="min-w-0">
                <span className="text-xs font-semibold text-[#2b1620] block truncate">{p.name}</span>
                <span className="text-[10px] text-[#2b1620]/50">{p.brand} · {p.price_fcfa.toLocaleString("fr-FR")}F · {p.actifs.join(", ") || "aucun actif renseigné"}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => toggleSponsor(p, "is_sponsored")}
                  className={`text-[10px] font-bold px-2 py-1 rounded-full cursor-pointer flex items-center gap-1 ${p.is_sponsored ? "bg-[#d6407a] text-white" : "bg-white text-[#2b1620]/40 border border-[#2b1620]/10"}`}>
                  <Star className="w-2.5 h-2.5" /> {p.is_sponsored ? "Sponsorisé" : "Activer"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Commandes */}
      <div className="premium-card rounded-2xl p-5">
        <h3 className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-[#2b1620]/50 font-semibold mb-3">
          <Truck className="w-3.5 h-3.5" /> Commandes ({orders.length})
        </h3>
        {orders.length === 0 ? (
          <p className="text-xs text-[#2b1620]/40">Aucune commande pour l'instant.</p>
        ) : (
          <div className="space-y-2.5">
            {orders.map((o) => (
              <div key={o.id} className="bg-[#fdf1f5] rounded-xl p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-sm font-semibold text-[#2b1620] block">{o.product_name} × {o.quantity}</span>
                    <span className="text-[11px] text-[#2b1620]/50">{o.delivery_name} · {o.delivery_phone}</span>
                    <p className="text-[11px] text-[#2b1620]/50 mt-0.5">{o.delivery_address}</p>
                  </div>
                  <span className="text-sm font-bold text-[#d6407a] shrink-0">{(o.price_fcfa * o.quantity).toLocaleString("fr-FR")} F</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                  {["pending", "confirmed", "shipped", "delivered", "cancelled"].map((s) => (
                    <button
                      key={s}
                      onClick={() => updateOrderStatus(o.id, s)}
                      className={`text-[10px] font-semibold px-2.5 py-1 rounded-full transition cursor-pointer ${
                        o.status === s ? "bg-[#d6407a] text-white" : "bg-white text-[#2b1620]/50 hover:bg-[#2b1620]/[0.04]"
                      }`}
                    >
                      {ORDER_STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Liste des comptes */}
      <div className="premium-card rounded-2xl p-5">
        <h3 className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-[#2b1620]/50 font-semibold mb-3">
          <Users className="w-3.5 h-3.5" /> Tous les comptes ({accounts.length})
        </h3>
        <div className="space-y-1.5">
          {accounts.map((a) => (
            <div key={a.phone} className="flex items-center justify-between text-xs py-2 border-b border-white/5">
              <span className="font-mono text-[#2b1620]">{a.phone}</span>
              <div className="flex items-center gap-2">
                {a.isAdmin && <span className="text-[9px] font-bold uppercase bg-[#d6407a]/20 text-[#d6407a] px-1.5 py-0.5 rounded">Admin</span>}
                <span className="text-[#2b1620]/50">{PLAN_LABELS[a.plan] || a.plan}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
