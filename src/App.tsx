import React, { useState, useEffect, useCallback } from "react";
import { Scan, History, User, Sparkles, LogOut, CreditCard, ShieldCheck } from "lucide-react";
import ZoneSelector from "./components/ZoneSelector";
import ModeChoice from "./components/ModeChoice";
import PhotoCapture from "./components/PhotoCapture";
import VideoCapture from "./components/VideoCapture";
import ResultsView from "./components/ResultsView";
import LoginScreen from "./components/LoginScreen";
import SubscriptionPanel from "./components/SubscriptionPanel";
import AdminDashboard from "./components/AdminDashboard";
import { SkinZone, SkinAnalysisResult } from "./types";

type Tab = "diagnostic" | "historique" | "abonnement" | "admin" | "profil";
type Step = "zone" | "mode" | "capture" | "resultat";

interface UserStatus {
  isAdmin: boolean;
  plan: string;
  limit: number;
  used: number;
}

export default function App() {
  const [sessionToken, setSessionToken] = useState<string | null>(() => localStorage.getItem("skindiag_token"));
  const [activeTab, setActiveTab] = useState<Tab>("diagnostic");
  const [step, setStep] = useState<Step>("zone");
  const [zone, setZone] = useState<SkinZone>("visage");
  const [captureMode, setCaptureMode] = useState<"photo" | "video">("photo");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SkinAnalysisResult | null>(null);
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [quotaMessage, setQuotaMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<SkinAnalysisResult[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("skindiag_history") || "[]");
    } catch {
      return [];
    }
  });

  const handleLogout = useCallback(() => {
    localStorage.removeItem("skindiag_token");
    setSessionToken(null);
    setUserStatus(null);
  }, []);

  const loadStatus = useCallback(async (token: string) => {
    try {
      const res = await fetch("/api/user/status", { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { handleLogout(); return; }
      const data = await res.json();
      if (data.success) {
        setUserStatus({ isAdmin: data.isAdmin, plan: data.plan, limit: data.limit, used: data.used });
      }
    } catch {
      // silencieux, l'utilisateur peut continuer, on réessaiera
    }
  }, [handleLogout]);

  const loadHistory = useCallback(async (token: string) => {
    try {
      const res = await fetch("/api/skindiag/history", { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { handleLogout(); return; }
      const data = await res.json();
      if (data.success) {
        setHistory(data.history);
        localStorage.setItem("skindiag_history", JSON.stringify(data.history));
      }
    } catch {
      // silencieux : on garde l'historique local déjà chargé en attendant
    }
  }, [handleLogout]);

  useEffect(() => {
    if (sessionToken) {
      loadStatus(sessionToken);
      loadHistory(sessionToken);
    }
  }, [sessionToken, loadStatus, loadHistory]);

  const handleLoginSuccess = (token: string) => {
    localStorage.setItem("skindiag_token", token);
    setSessionToken(token);
  };

  const handleAnalyze = async (base64: string, mimeType: string) => {
    setIsLoading(true);
    setQuotaMessage(null);
    try {
      const res = await fetch("/api/skindiag/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ zone, image: base64, mimeType }),
      });
      if (res.status === 401) { handleLogout(); return; }
      const data = await res.json();
      if (res.status === 403) {
        setQuotaMessage(data.message);
        setActiveTab("abonnement");
        return;
      }
      if (data.success) {
        setResult(data.result);
        setStep("resultat");
        if (sessionToken) {
          loadStatus(sessionToken);
          loadHistory(sessionToken);
        }
      } else {
        alert(data.message || "L'analyse a échoué. Réessayez.");
      }
    } catch {
      alert("Erreur réseau. Vérifiez votre connexion et réessayez.");
    } finally {
      setIsLoading(false);
    }
  };

  const restart = () => {
    setResult(null);
    setStep("zone");
  };

  if (!sessionToken) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const tabs = [
    { id: "diagnostic" as Tab, label: "Analyser", icon: Scan },
    { id: "historique" as Tab, label: "Historique", icon: History },
    { id: "abonnement" as Tab, label: "Abonnement", icon: CreditCard },
    ...(userStatus?.isAdmin ? [{ id: "admin" as Tab, label: "Admin", icon: ShieldCheck }] : []),
    { id: "profil" as Tab, label: "Profil", icon: User },
  ];

  return (
    <div className="min-h-screen font-sans text-[#f5ede1] pb-24 lg:pb-0 lg:flex relative">
      {/* Halos organiques fixes, cohérents avec l'écran de connexion */}
      <div className="glow-orb w-[380px] h-[380px] bg-[#e0578f]/15 -top-40 right-[-100px] fixed" />
      <div className="glow-orb w-[320px] h-[320px] bg-[#d6407a]/12 bottom-[-80px] left-[-80px] fixed" />
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-72 lg:shrink-0 bg-black/30 border-r border-white/[0.06] min-h-screen p-6">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#d6407a] to-[#8a2a54] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-display text-lg font-semibold">SkinDiag</span>
        </div>
        <nav className="space-y-1.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition cursor-pointer ${
                activeTab === t.id ? "bg-[#d6407a]/15 text-[#f28fb0]" : "text-[#f5ede1]/60 hover:bg-white/[0.03]"
              }`}
            >
              <t.icon className="w-4.5 h-4.5" /> {t.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#d6407a] to-[#8a2a54] flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="font-display text-base font-semibold">SkinDiag</span>
      </header>

      {/* Contenu principal */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-5 py-6 lg:py-10">
        {quotaMessage && activeTab === "abonnement" && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-5 text-sm text-amber-300">
            {quotaMessage}
          </div>
        )}

        {activeTab === "diagnostic" && (
          <>
            {step === "zone" && <ZoneSelector onSelect={(z) => { setZone(z); setStep("mode"); }} />}
            {step === "mode" && (
              <ModeChoice
                zone={zone}
                onBack={() => setStep("zone")}
                onChoose={(m) => { setCaptureMode(m); setStep("capture"); }}
              />
            )}
            {step === "capture" && captureMode === "photo" && (
              <PhotoCapture zone={zone} onBack={() => setStep("mode")} onCapture={handleAnalyze} isLoading={isLoading} />
            )}
            {step === "capture" && captureMode === "video" && (
              <VideoCapture zone={zone} onBack={() => setStep("mode")} onCapture={handleAnalyze} isLoading={isLoading} />
            )}
            {step === "resultat" && result && <ResultsView result={result} onRestart={restart} />}
          </>
        )}

        {activeTab === "historique" && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-display font-semibold mb-6">Historique</h2>
            {history.length === 0 ? (
              <p className="text-sm text-[#f5ede1]/50">Aucune analyse pour l'instant.</p>
            ) : (
              <div className="space-y-3">
                {history.map((h, i) => (
                  <div key={i} className="premium-card rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">{h.zoneAnalysee}</span>
                      <p className="text-xs text-[#f5ede1]/50">{h.typeDePeau}</p>
                    </div>
                    <span className="text-lg font-bold text-[#d6407a]">{h.scoreGlobal}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "abonnement" && sessionToken && (
          <SubscriptionPanel
            token={sessionToken}
            currentPlan={userStatus?.plan || "free_trial"}
            used={userStatus?.used || 0}
            limit={userStatus?.limit ?? 3}
            onRequestSent={() => setQuotaMessage(null)}
          />
        )}

        {activeTab === "admin" && sessionToken && userStatus?.isAdmin && (
          <AdminDashboard token={sessionToken} />
        )}

        {activeTab === "profil" && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-display font-semibold mb-6">Profil</h2>
            <div className="premium-card rounded-2xl p-5 text-sm text-[#f5ede1]/70 leading-relaxed">
              SkinDiag fournit une analyse visuelle indicative de la peau, spécialement pensée pour les
              peaux noires et foncées. Cette analyse ne constitue pas un diagnostic médical et ne remplace
              pas la consultation d'un dermatologue.
            </div>
            <button
              onClick={handleLogout}
              className="w-full mt-4 flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 font-medium text-sm py-3 rounded-xl transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> Se déconnecter
            </button>
          </div>
        )}
      </main>

      {/* Nav mobile */}
      <nav className="lg:hidden fixed bottom-4 left-4 right-4 bg-black/70 backdrop-blur-lg border border-white/10 rounded-2xl p-1.5 flex items-center justify-around overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition cursor-pointer ${
              activeTab === t.id ? "bg-white/[0.06] text-[#f28fb0]" : "text-[#f5ede1]/50"
            }`}
          >
            <t.icon className="w-5 h-5" />
            <span className="text-[9px] font-semibold uppercase tracking-wider">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
