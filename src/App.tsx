import React, { useState, useEffect, useCallback } from "react";
import { Scan, History, User, LogOut, CreditCard, ShieldCheck, ShoppingBag } from "lucide-react";
import CategorySelector from "./components/CategorySelector";
import SplashScreen from "./components/SplashScreen";
import ZoneSelector from "./components/ZoneSelector";
import ModeChoice from "./components/ModeChoice";
import PhotoCapture from "./components/PhotoCapture";
import VideoCapture from "./components/VideoCapture";
import Questionnaire, { QuestionnaireAnswers } from "./components/Questionnaire";
import ResultsView from "./components/ResultsView";
import LoginScreen from "./components/LoginScreen";
import SubscriptionPanel from "./components/SubscriptionPanel";
import Shop from "./components/Shop";
import AdminDashboard from "./components/AdminDashboard";
import { SkinZone, SkinAnalysisResult } from "./types";

type Tab = "diagnostic" | "historique" | "boutique" | "abonnement" | "admin" | "profil";
type Step = "category" | "zone" | "mode" | "capture" | "questionnaire" | "resultat";

interface UserStatus {
  isAdmin: boolean;
  plan: string;
  limit: number;
  used: number;
}

export default function App() {
  const [sessionToken, setSessionToken] = useState<string | null>(() => localStorage.getItem("skindiag_token"));
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("diagnostic");
  const [step, setStep] = useState<Step>("category");
  const [categoryId, setCategoryId] = useState<string>("visage_cou");
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

  const [pendingImage, setPendingImage] = useState<{ data: string; mime: string } | null>(null);

  const handleLoginSuccess = (token: string) => {
    localStorage.setItem("skindiag_token", token);
    setSessionToken(token);
  };

  // La capture (photo/vidéo) ne lance plus l'analyse directement : elle passe d'abord
  // par le questionnaire, pour croiser image + symptômes déclarés (plus fiable qu'une photo seule).
  const handleCaptured = (base64: string, mimeType: string) => {
    setPendingImage({ data: base64, mime: mimeType });
    setStep("questionnaire");
  };

  const handleAnalyze = async (answers: QuestionnaireAnswers) => {
    if (!pendingImage) return;
    setIsLoading(true);
    setQuotaMessage(null);
    try {
      const res = await fetch("/api/skindiag/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ zone, image: pendingImage.data, mimeType: pendingImage.mime, questionnaire: answers }),
      });
      if (res.status === 401) { handleLogout(); return; }
      const data = await res.json();
      if (res.status === 403) {
        setQuotaMessage(data.message);
        setActiveTab("abonnement");
        return;
      }
      if (data.success) {
        if (data.qualityRejected) {
          alert(data.qualiteImage?.message || "La qualité de la photo ne permet pas une analyse fiable. Reprenez la photo.");
          setStep("capture");
          return;
        }
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
    setPendingImage(null);
    setStep("category");
  };

  if (showSplash) {
    return <SplashScreen onFinished={() => setShowSplash(false)} />;
  }

  if (!sessionToken) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const tabs = [
    { id: "diagnostic" as Tab, label: "Analyser", icon: Scan },
    { id: "historique" as Tab, label: "Historique", icon: History },
    { id: "boutique" as Tab, label: "Boutique", icon: ShoppingBag },
    { id: "abonnement" as Tab, label: "Abonnement", icon: CreditCard },
    ...(userStatus?.isAdmin ? [{ id: "admin" as Tab, label: "Admin", icon: ShieldCheck }] : []),
    { id: "profil" as Tab, label: "Profil", icon: User },
  ];

  return (
    <div className="min-h-screen font-sans text-[#2b1620] pb-28 lg:pb-0 lg:flex relative">
      {/* Halos organiques fixes, cohérents avec l'écran de connexion */}
      <div className="glow-orb w-[380px] h-[380px] bg-[#e0578f]/15 -top-40 right-[-100px] fixed" />
      <div className="glow-orb w-[320px] h-[320px] bg-[#d6407a]/12 bottom-[-80px] left-[-80px] fixed" />
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-72 lg:shrink-0 bg-white/70 backdrop-blur-sm border-r border-[#2b1620]/[0.07] min-h-screen p-6">
        <div className="flex items-center gap-3 mb-10">
          <img src="/icon-192.png" alt="SkinDiag" className="w-16 h-16 object-contain" />
        </div>
        <nav className="space-y-1.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition cursor-pointer ${
                activeTab === t.id ? "bg-[#d6407a]/15 text-[#d6407a]" : "text-[#2b1620]/60 hover:bg-[#2b1620]/[0.03]"
              }`}
            >
              <t.icon className="w-4.5 h-4.5" /> {t.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Contenu principal */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-5 py-4 lg:py-10">
        {quotaMessage && activeTab === "abonnement" && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-5 text-sm text-amber-300">
            {quotaMessage}
          </div>
        )}

        {activeTab === "diagnostic" && (
          <>
            {step === "category" && (
              <CategorySelector
                onSelectCategory={(id) => { setCategoryId(id); setStep("zone"); }}
                onSelectAutre={() => { setZone("autre"); setStep("mode"); }}
              />
            )}
            {step === "zone" && (
              <ZoneSelector categoryId={categoryId} onBack={() => setStep("category")} onSelect={(z) => { setZone(z); setStep("mode"); }} />
            )}
            {step === "mode" && (
              <ModeChoice
                zone={zone}
                onBack={() => setStep("zone")}
                onChoose={(m) => { setCaptureMode(m); setStep("capture"); }}
              />
            )}
            {step === "capture" && captureMode === "photo" && (
              <PhotoCapture zone={zone} onBack={() => setStep("mode")} onCapture={handleCaptured} isLoading={false} />
            )}
            {step === "capture" && captureMode === "video" && (
              <VideoCapture zone={zone} onBack={() => setStep("mode")} onCapture={handleCaptured} isLoading={false} />
            )}
            {step === "questionnaire" && (
              <Questionnaire onBack={() => setStep("capture")} onSubmit={handleAnalyze} isLoading={isLoading} />
            )}
            {step === "resultat" && result && sessionToken && <ResultsView result={result} token={sessionToken} onRestart={restart} />}
          </>
        )}

        {activeTab === "historique" && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-display font-semibold mb-6">Historique</h2>
            {history.length === 0 ? (
              <p className="text-sm text-[#2b1620]/50">Aucune analyse pour l'instant.</p>
            ) : (
              <div className="space-y-3">
                {history.map((h, i) => (
                  <div key={i} className="premium-card rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">{h.zoneAnalysee}</span>
                      <p className="text-xs text-[#2b1620]/50">{h.typeDePeau}</p>
                    </div>
                    <span className="text-lg font-bold text-[#d6407a]">{h.scoreGlobal}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "boutique" && sessionToken && <Shop token={sessionToken} />}

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
            <div className="premium-card rounded-2xl p-5 text-sm text-[#2b1620]/70 leading-relaxed">
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
      <nav className="lg:hidden fixed bottom-4 left-4 right-4 bg-white/90 backdrop-blur-lg border border-[#2b1620]/10 rounded-2xl p-1.5 flex items-center justify-around shadow-[0_8px_30px_-10px_rgba(214,64,122,0.35)]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 min-w-0 overflow-hidden flex flex-col items-center gap-1 py-2 px-0.5 rounded-xl transition cursor-pointer ${
              activeTab === t.id ? "bg-[#2b1620]/[0.04] text-[#d6407a]" : "text-[#2b1620]/50"
            }`}
          >
            <t.icon className="w-5 h-5 shrink-0" />
            <span className="text-[8px] font-semibold uppercase leading-tight whitespace-nowrap">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
