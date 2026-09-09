import React, { useState } from "react";
import { Phone, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";

interface LoginScreenProps {
  onLoginSuccess: (token: string, isAdmin: boolean) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [countryCode, setCountryCode] = useState("+225");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, countryCode, password }),
      });
      const data = await res.json();
      if (data.success) {
        onLoginSuccess(data.sessionToken, data.isAdmin === true);
      } else {
        setError(data.message || "Connexion impossible.");
      }
    } catch {
      setError("Erreur réseau. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5 font-sans relative overflow-hidden">
      {/* Halos organiques — profondeur réelle plutôt qu'un aplat uni */}
      <div className="glow-orb w-[420px] h-[420px] bg-[#e0578f]/25 -top-32 -left-24" />
      <div className="glow-orb w-[360px] h-[360px] bg-[#d6407a]/20 bottom-[-100px] right-[-80px]" />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          {/* Portrait réel en médaillon, ancré dans le sujet (peau, soin) plutôt qu'une icône abstraite */}
          <div className="relative inline-flex items-center justify-center w-24 h-24 mb-4">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#f2a3c4] to-[#8a2a54] blur-lg opacity-60" />
            <img
              src="https://images.unsplash.com/photo-1693004927824-f2623bbedc8b?w=300&q=80&auto=format&fit=crop"
              alt="SkinDiag"
              className="relative w-20 h-20 rounded-full object-cover border-2 border-[#2b1620]/20 shadow-xl"
            />
          </div>
          <h1 className="text-3xl font-display font-semibold text-[#2b1620] tracking-tight">SkinDiag</h1>
          <p className="text-sm text-[#2b1620]/55 mt-1.5">Votre peau, comprise et accompagnée</p>
        </div>

        <div className="premium-card rounded-[28px] p-7">

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-[#2b1620]/60 font-medium mb-1.5">Numéro de téléphone</label>
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="bg-white border border-[#2b1620]/10 rounded-xl px-2 py-3 text-sm text-[#2b1620] focus:outline-none focus:border-[#d6407a]"
              >
                <option value="+225">+225</option>
                <option value="+221">+221</option>
                <option value="+223">+223</option>
              </select>
              <div className="relative flex-1">
                <Phone className="w-4 h-4 text-[#2b1620]/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  placeholder="07 12 34 56"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full bg-white border border-[#2b1620]/10 rounded-xl pl-9 pr-3 py-3 text-sm text-[#2b1620] placeholder-[#2b1620]/30 focus:outline-none focus:border-[#d6407a]"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#2b1620]/60 font-medium mb-1.5">Mot de passe</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#2b1620]/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="Votre mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-[#2b1620]/10 rounded-xl pl-9 pr-10 py-3 text-sm text-[#2b1620] placeholder-[#2b1620]/30 focus:outline-none focus:border-[#d6407a]"
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2b1620]/40 hover:text-[#2b1620] cursor-pointer">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#d6407a] to-[#8a2a54] disabled:opacity-50 text-white font-semibold text-sm py-3.5 rounded-xl transition cursor-pointer"
          >
            {loading ? "Connexion..." : <>Se connecter <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>

        <p className="text-[11px] text-[#2b1620]/40 text-center mt-5">
          Pas de compte ? Contactez-nous pour en créer un.
        </p>
        </div>
      </div>
    </div>
  );
}
