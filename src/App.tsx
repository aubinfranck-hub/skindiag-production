import React, { useState, useEffect, useCallback } from "react";
import { Scan, History, User, LogOut, CreditCard, ShieldCheck, ShoppingBag, ArrowRight, Sparkles, Truck, HeartHandshake } from "lucide-react";
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
  const [showHome, setShowHome] = useState(true);
  const [step, setStep] = useState<Step>("category");
  const [categoryId, setCategoryId] = useState<string>("visage_cou");
  const [zone, setZone] = useState<SkinZone>("visage");
  const [captureMode, setCaptureMode] = useState<"photo" | "video">("photo");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SkinAnalysisResult | null>(null);
  const [viewingHistoryItem, setViewingHistoryItem] = useState<SkinAnalysisResult | null>(null);
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
  const [qualityIssue, setQualityIssue] = useState<string | null>(null);
  const [isCheckingQuality, setIsCheckingQuality] = useState(false);

  const handleLoginSuccess = (token: string) => {
    localStorage.setItem("skindiag_token", token);
    setSessionToken(token);
  };

  // La capture vérifie D'ABORD la qualité de la photo/vidéo, avant même le questionnaire —
  // inutile de poser 6 questions si la photo devra être reprise.
  const handleCaptured = async (base64: string, mimeType: string) => {
    setPendingImage({ data: base64, mime: mimeType });
    setQualityIssue(null);
    setIsCheckingQuality(true);
    // Le service peut être en veille (redémarrage à froid) et prendre du temps à répondre —
    // on limite l'attente à 25s puis on continue sans bloquer l'utilisateur indéfiniment.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    try {
      const res = await fetch("/api/skindiag/check-quality", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ image: base64, mimeType }),
        signal: controller.signal,
      });
      if (res.status === 401) { handleLogout(); return; }
      const data = await res.json();
      if (data.success && data.qualiteImage?.decision === "C_insuffisante") {
        setQualityIssue(data.qualiteImage.message);
        return;
      }
      // A_excellente ou B_exploitable_imparfaite (ou vérification indisponible) : on continue
      setStep("questionnaire");
    } catch {
      // Erreur réseau OU délai dépassé (ex: service en train de redémarrer) : on ne bloque
      // pas l'utilisateur, la vérification complète se refera de toute façon à l'analyse finale.
      setStep("questionnaire");
    } finally {
      clearTimeout(timeoutId);
      setIsCheckingQuality(false);
    }
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
    setShowHome(true);
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
          <img src="/icon-192.png" alt="SkinDiag" className="w-16 h-16 object-contain" /><span className="font-display font-bold text-2xl text-[#9e1450]">SkinDiag</span>
        </div>
        <nav className="space-y-1.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setActiveTab(t.id); setViewingHistoryItem(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition cursor-pointer ${
                activeTab === t.id ? "bg-[#d6407a]/15 text-[#d6407a]" : "text-[#2b1620]/60 hover:bg-[#2b1620]/[0.03]"
              }`}
            >
              <t.icon className="w-4.5 h-4.5" /> {t.label}
            </button>
          ))}
        </nav>
      </aside>

      <header className="lg:hidden relative z-10 flex items-center justify-between px-5 pt-3 pb-2 bg-white/85 backdrop-blur-sm border-b border-[#ead6df]">
        <button onClick={() => { setActiveTab("diagnostic"); setStep("category"); setShowHome(true); }} className="flex items-center gap-2.5 text-left" aria-label="Accueil SkinDiag">
          <img src="/icon-192.png" alt="Logo SkinDiag" className="w-12 h-12 object-contain" />
          <span className="flex flex-col"><span className="text-2xl leading-tight font-display font-bold text-[#9e1450]">SkinDiag</span><span className="text-[10px] text-[#684858]">Diagnostic peau & boutique soins</span></span>
        </button>
        <button onClick={() => setActiveTab("boutique")} className="rounded-full bg-[#fbe6ef] p-3 text-[#b20b56]" aria-label="Ouvrir la boutique"><ShoppingBag className="w-5 h-5" /></button>
      </header>
      {/* Contenu principal */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-5 py-4 lg:py-10">
        {quotaMessage && activeTab === "abonnement" && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-5 text-sm text-amber-300">
            {quotaMessage}
          </div>
        )}

        {activeTab === "diagnostic" && (
          <>
            {step === "category" && showHome && (
              <section className="animate-fade-in space-y-5" aria-label="Bienvenue sur SkinDiag">
                <div className="rounded-[2rem] bg-gradient-to-br from-[#fff1f6] via-[#fff8fb] to-[#f5d9e6] p-6 sm:p-8 border border-[#eac8d6]">
                  <span className="inline-flex items-center gap-2 text-[#aa245b] text-xs font-bold uppercase tracking-widest"><Sparkles className="w-4 h-4" /> SkinDiag · Beauté et soins</span>
                  <h1 className="text-3xl sm:text-4xl font-display font-bold text-[#361021] leading-tight mt-4">Votre peau mérite des soins adaptés.</h1>
                  <p className="text-sm sm:text-base text-[#684858] mt-3">Analysez votre peau pour obtenir des conseils personnalisés, ou découvrez directement notre boutique.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setShowHome(false)} className="rounded-3xl bg-[#fbe6ef] border border-[#eebcd1] p-4 sm:p-5 text-left min-h-48 flex flex-col items-start shadow-sm hover:shadow-md transition">
                    <span className="rounded-2xl bg-white/80 p-3 text-[#c01460]"><Scan className="w-7 h-7" /></span>
                    <span className="text-lg font-bold text-[#401326] mt-4 leading-tight">Analyser ma peau</span>
                    <span className="text-xs text-[#765566] mt-2">Photo, analyse indicative et conseils personnalisés</span>
                    <ArrowRight className="w-5 h-5 text-[#c01460] mt-auto" />
                  </button>
                  <button onClick={() => setActiveTab("boutique")} className="rounded-3xl bg-gradient-to-br from-[#dc1766] to-[#a8064c] p-4 sm:p-5 text-left min-h-48 flex flex-col items-start text-white shadow-lg hover:shadow-xl transition">
                    <span className="rounded-2xl bg-white/20 p-3"><ShoppingBag className="w-7 h-7" /></span>
                    <span className="text-lg font-bold mt-4 leading-tight">Boutique soins & beauté</span>
                    <span className="text-xs text-white/85 mt-2">Soins adultes et bébé, sans scanner obligatoire</span>
                    <ArrowRight className="w-5 h-5 mt-auto" />
                  </button>
                </div>
                <div className="grid grid-cols-3 divide-x divide-[#e8cbd7] rounded-2xl border border-[#f0dbe4] bg-white/80 py-4">
                  <div className="flex flex-col items-center text-center px-2 gap-1"><Truck className="w-5 h-5 text-[#bb1c60]" /><span className="text-[11px] font-medium">Livraison Abidjan</span></div>
                  <div className="flex flex-col items-center text-center px-2 gap-1"><CreditCard className="w-5 h-5 text-[#bb1c60]" /><span className="text-[11px] font-medium">Paiement Jeko</span></div>
                  <div className="flex flex-col items-center text-center px-2 gap-1"><HeartHandshake className="w-5 h-5 text-[#bb1c60]" /><span className="text-[11px] font-medium">Conseils SkinDiag</span></div>
                </div>
                <button onClick={() => setActiveTab("boutique")} className="w-full rounded-2xl border border-[#e6c6d5] bg-white p-4 flex items-center justify-between text-[#702443] font-semibold text-sm">Découvrir les produits Uriage <ArrowRight className="w-4 h-4" /></button>
                <p className="text-xs text-[#775b68]">L’analyse est indicative et ne remplace pas un avis dermatologique.</p>
              </section>
            )}
            {step === "category" && !showHome && <button onClick={() => setShowHome(true)} className="mb-4 text-sm font-medium text-[#b81961]">← Retour à l’accueil</button>}
            {step === "category" && !showHome && (
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
              <PhotoCapture zone={zone} onBack={() => setStep("mode")} onCapture={handleCaptured} isLoading={isCheckingQuality} qualityIssue={qualityIssue} />
            )}
            {step === "capture" && captureMode === "video" && (
              <VideoCapture zone={zone} onBack={() => setStep("mode")} onCapture={handleCaptured} isLoading={isCheckingQuality} qualityIssue={qualityIssue} />
            )}
            {step === "questionnaire" && (
              <Questionnaire onBack={() => setStep("capture")} onSubmit={handleAnalyze} isLoading={isLoading} />
            )}
            {step === "resultat" && result && sessionToken && <ResultsView result={result} token={sessionToken} onRestart={restart} />}
          </>
        )}

        {activeTab === "historique" && !viewingHistoryItem && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-display font-semibold mb-6">Historique</h2>
            {history.length === 0 ? (
              <p className="text-sm text-[#2b1620]/50">Aucune analyse pour l'instant.</p>
            ) : (
              <div className="space-y-3">
                {history.map((h: any, i) => (
                  <button
                    key={i}
                    onClick={() => setViewingHistoryItem(h)}
                    className="w-full premium-card rounded-2xl p-4 flex items-center justify-between text-left hover:-translate-y-0.5 transition cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium block">{h.zoneAnalysee}</span>
                      <p className="text-xs text-[#2b1620]/50 truncate">{h.typeDePeau} · {h.observation ? h.observation.slice(0, 50) + (h.observation.length > 50 ? "…" : "") : ""}</p>
                      {h.createdAt && (
                        <p className="text-[10px] text-[#2b1620]/35 mt-1">
                          {new Date(h.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                    <span className="text-lg font-bold text-[#d6407a] shrink-0 ml-3">{h.scoreGlobal}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "historique" && viewingHistoryItem && sessionToken && (
          <ResultsView result={viewingHistoryItem} token={sessionToken} onRestart={() => setViewingHistoryItem(null)} restartLabel="Retour à l'historique" />
        )}

        {activeTab === "boutique" && sessionToken && <Shop token={sessionToken} />}

        {activeTab === "abonnement" && sessionToken && (
          <SubscriptionPanel
            token={sessionToken}
            currentPlan={userStatus?.plan || "free_trial"}
            used={userStatus?.used || 0}
            limit={userStatus?.limit ?? 3}
            onRequestSent={() => { setQuotaMessage(null); loadStatus(sessionToken); }}
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
            onClick={() => { setActiveTab(t.id); setViewingHistoryItem(null); }}
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
