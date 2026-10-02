import React, { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Check } from "lucide-react";

type Method = "orange" | "wave" | "mtn" | "moov";

const METHODS: { id: Method; label: string }[] = [
  { id: "orange", label: "Orange Money" },
  { id: "wave", label: "Wave" },
  { id: "mtn", label: "MTN MoMo" },
  { id: "moov", label: "Moov Money" },
];

interface JekoPayProps {
  token: string;
  kind: "order" | "subscription";
  orderId?: number;
  plan?: string;
  amount: number;           // affichage seulement : le serveur impose le vrai montant
  onSuccess: () => void;
  // Affiché si le paiement en ligne n'est pas activé côté serveur (repli : Wave manuel).
  fallback: React.ReactNode;
}

const fmt = (n: number) => `${n.toLocaleString("fr-FR")} F`;

export default function JekoPay({ token, kind, orderId, plan, amount, onSuccess, fallback }: JekoPayProps) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [method, setMethod] = useState<Method>("wave");
  const [payerPhone, setPayerPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "creating" | "waiting" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    fetch("/api/payments/jeko/config")
      .then((r) => r.json())
      .then((d) => setEnabled(d.success && d.enabled === true))
      .catch(() => setEnabled(false));
    return () => window.clearInterval(pollRef.current);
  }, []);

  const poll = (reference: string) => {
    let attempts = 0;
    window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      attempts += 1;
      if (attempts > 60) { // ~5 min (toutes les 5 s)
        window.clearInterval(pollRef.current);
        setStatus("error");
        setError("Nous n'avons pas reçu la confirmation. Si vous avez payé, elle arrivera sous peu — sinon réessayez.");
        return;
      }
      try {
        const res = await fetch(`/api/payments/jeko/status/${encodeURIComponent(reference)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && data.status === "success") {
          window.clearInterval(pollRef.current);
          setStatus("success");
          onSuccess();
        } else if (data.success && data.status === "error") {
          window.clearInterval(pollRef.current);
          setStatus("error");
          setError("Le paiement a échoué ou a été annulé.");
        }
      } catch {
        // Erreur réseau ponctuelle : on retente au prochain passage.
      }
    }, 5000);
  };

  const handlePay = async () => {
    setStatus("creating");
    setError(null);
    try {
      const res = await fetch("/api/payments/jeko/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kind, orderId, plan, paymentMethod: method, payerPhone: payerPhone || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Paiement impossible.");
      if (data.redirectUrl) window.open(data.redirectUrl, "_blank", "noopener,noreferrer");
      setStatus("waiting");
      poll(data.reference);
    } catch (e: any) {
      setStatus("error");
      setError(e.message || "Erreur réseau.");
    }
  };

  if (enabled === null) {
    return <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-[#d6407a]" /></div>;
  }
  if (!enabled) return <>{fallback}</>;

  if (status === "success") {
    return (
      <div className="text-center py-4">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-2">
          <Check className="w-6 h-6 text-emerald-600" />
        </div>
        <p className="text-sm font-semibold text-[#2b1620]">Paiement confirmé</p>
      </div>
    );
  }

  const busy = status === "creating" || status === "waiting";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {METHODS.map((m) => (
          <button
            key={m.id} type="button" disabled={busy} onClick={() => setMethod(m.id)}
            className={`text-xs font-semibold py-2.5 rounded-xl border transition cursor-pointer disabled:opacity-50 ${
              method === m.id ? "border-[#d6407a] bg-[#d6407a]/10 text-[#d6407a]" : "border-[#2b1620]/10 text-[#2b1620]/60"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <input
        type="tel" disabled={busy} placeholder="Numéro qui paie (optionnel) 07 12 34 56" value={payerPhone}
        onChange={(e) => setPayerPhone(e.target.value)}
        className="w-full bg-[#fdf1f5] border border-[#2b1620]/10 rounded-xl px-3 py-2.5 text-sm text-[#2b1620] placeholder-[#2b1620]/30 focus:outline-none focus:border-[#d6407a]"
      />
      <button
        type="button" onClick={handlePay} disabled={busy}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#d6407a] to-[#8a2a54] disabled:opacity-60 text-white font-semibold text-sm py-3.5 rounded-xl transition cursor-pointer"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
        {status === "creating" ? "Création du paiement..." : status === "waiting" ? "En attente de confirmation..." : `Payer ${fmt(amount)}`}
      </button>
      {status === "waiting" && (
        <p className="text-[11px] text-[#2b1620]/50 text-center">
          Terminez le paiement sur la page de votre opérateur : cet écran se met à jour tout seul.
        </p>
      )}
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  );
}
