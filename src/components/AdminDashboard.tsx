import React, { useState, useEffect, useCallback } from "react";
import { UserPlus, Users, Check, X, RefreshCw } from "lucide-react";

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
  const [loading, setLoading] = useState(false);

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState("free_trial");
  const [creating, setCreating] = useState(false);
  const [createdInfo, setCreatedInfo] = useState<{ phone: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [accRes, pendRes] = await Promise.all([
        fetch("/api/admin/accounts", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/pending-activations", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const accData = await accRes.json();
      const pendData = await pendRes.json();
      if (accData.success) setAccounts(accData.accounts);
      if (pendData.success) setPending(pendData.pending);
    } catch {
      // silencieux, l'utilisateur peut rafraîchir
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

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
