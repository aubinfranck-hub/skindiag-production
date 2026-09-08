import React, { useState } from "react";
import { Scan, History, User, Sparkles, LogOut } from "lucide-react";
import ZoneSelector from "./components/ZoneSelector";
import PhotoCapture from "./components/PhotoCapture";
import ResultsView from "./components/ResultsView";
import LoginScreen from "./components/LoginScreen";
import { SkinZone, SkinAnalysisResult } from "./types";

type Tab = "diagnostic" | "historique" | "profil";
type Step = "zone" | "capture" | "resultat";

export default function App() {
  const [sessionToken, setSessionToken] = useState<string | null>(() => localStorage.getItem("skindiag_token"));
  const [activeTab, setActiveTab] = useState<Tab>("diagnostic");
  const [step, setStep] = useState<Step>("zone");
  const [zone, setZone] = useState<SkinZone>("visage");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SkinAnalysisResult | null>(null);
  const [history, setHistory] = useState<SkinAnalysisResult[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("skindiag_history") || "[]");
    } catch {
      return [];
    }
  });

  const handleLoginSuccess = (token: string, _isAdmin: boolean) => {
    localStorage.setItem("skindiag_token", token);
    setSessionToken(token);
  };

  const handleLogout = () => {
    localStorage.removeItem("skindiag_token");
    setSessionToken(null);
  };

  const handleAnalyze = async (base64: string, mimeType: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/skindiag/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ zone, image: base64, mimeType }),
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (data.success) {
        setResult(data.result);
        const newHistory = [data.result, ...history].slice(0, 20);
        setHistory(newHistory);
        localStorage.setItem("skindiag_history", JSON.stringify(newHistory));
        setStep("resultat");
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

  return (
    <div className="min-h-screen bg-[#140d0c] font-sans text-[#f5ede1] pb-24 lg:pb-0 lg:flex">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-72 lg:shrink-0 bg-black/30 border-r border-white/[0.06] min-h-screen p-6">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#b8762e] to-[#8f5a20] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-display text-lg font-semibold">SkinDiag</span>
        </div>
        <nav className="space-y-1.5">
          {[
            { id: "diagnostic" as Tab, label: "Analyser", icon: Scan },
            { id: "historique" as Tab, label: "Historique", icon: History },
            { id: "profil" as Tab, label: "Profil", icon: User },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition cursor-pointer ${
                activeTab === t.id ? "bg-[#b8762e]/15 text-[#e8a860]" : "text-[#f5ede1]/60 hover:bg-white/[0.03]"
              }`}
            >
              <t.icon className="w-4.5 h-4.5" /> {t.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#b8762e] to-[#8f5a20] flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="font-display text-base font-semibold">SkinDiag</span>
      </header>

      {/* Contenu principal */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-5 py-6 lg:py-10">
        {activeTab === "diagnostic" && (
          <>
            {step === "zone" && (
              <ZoneSelector onSelect={(z) => { setZone(z); setStep("capture"); }} />
            )}
            {step === "capture" && (
              <PhotoCapture zone={zone} onBack={() => setStep("zone")} onCapture={handleAnalyze} isLoading={isLoading} />
            )}
            {step === "resultat" && result && (
              <ResultsView result={result} onRestart={restart} />
            )}
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
                    <span className="text-lg font-bold text-[#b8762e]">{h.scoreGlobal}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
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
      <nav className="lg:hidden fixed bottom-4 left-4 right-4 bg-black/70 backdrop-blur-lg border border-white/10 rounded-2xl p-1.5 flex items-center justify-around">
        {[
          { id: "diagnostic" as Tab, label: "Analyser", icon: Scan },
          { id: "historique" as Tab, label: "Historique", icon: History },
          { id: "profil" as Tab, label: "Profil", icon: User },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition cursor-pointer ${
              activeTab === t.id ? "bg-white/[0.06] text-[#e8a860]" : "text-[#f5ede1]/50"
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
