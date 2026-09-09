import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";

export interface QuestionnaireAnswers {
  duree: string;
  demange: string;
  douloureux: string;
  aggrandie: string;
  nouveauProduit: string;
  blessureAvant: string;
}

interface QuestionnaireProps {
  onBack: () => void;
  onSubmit: (answers: QuestionnaireAnswers) => void;
  isLoading: boolean;
}

const QUESTIONS: { key: keyof QuestionnaireAnswers; label: string; options: string[] }[] = [
  { key: "duree", label: "Depuis combien de temps observez-vous cela ?", options: ["Moins d'1 semaine", "1 à 4 semaines", "1 à 6 mois", "Plus de 6 mois", "Je ne sais pas"] },
  { key: "demange", label: "La zone démange-t-elle ?", options: ["Oui", "Non"] },
  { key: "douloureux", label: "Est-elle douloureuse ?", options: ["Oui", "Non"] },
  { key: "aggrandie", label: "La zone s'est-elle agrandie récemment ?", options: ["Oui", "Non", "Je ne sais pas"] },
  { key: "nouveauProduit", label: "Avez-vous utilisé un nouveau produit récemment ?", options: ["Oui", "Non"] },
  { key: "blessureAvant", label: "Y a-t-il eu une blessure ou irritation avant l'apparition ?", options: ["Oui", "Non", "Je ne sais pas"] },
];

export default function Questionnaire({ onBack, onSubmit, isLoading }: QuestionnaireProps) {
  const [answers, setAnswers] = useState<Partial<QuestionnaireAnswers>>({});

  const allAnswered = QUESTIONS.every((q) => answers[q.key]);

  return (
    <div className="animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold text-[#d6407a] bg-white shadow-[0_4px_14px_-6px_rgba(214,64,122,0.4)] rounded-full px-3.5 py-2 mb-4 hover:-translate-y-0.5 transition cursor-pointer">
        <ArrowLeft className="w-4 h-4" /> Retour à la photo
      </button>

      <h2 className="text-xl sm:text-2xl font-display font-semibold text-[#2b1620] mb-1.5">Quelques questions rapides</h2>
      <p className="text-sm text-[#2b1620]/60 mb-6">Vos réponses aident à affiner l'analyse — la photo seule ne suffit pas toujours.</p>

      <div className="space-y-5">
        {QUESTIONS.map((q) => (
          <div key={q.key} className="premium-card rounded-2xl p-4">
            <p className="text-sm font-medium text-[#2b1620] mb-2.5">{q.label}</p>
            <div className="flex flex-wrap gap-2">
              {q.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setAnswers((a) => ({ ...a, [q.key]: opt }))}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full transition cursor-pointer ${
                    answers[q.key] === opt ? "bg-[#d6407a] text-white" : "bg-[#fdf1f5] text-[#2b1620]/70 hover:bg-[#2b1620]/[0.06]"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => allAnswered && onSubmit(answers as QuestionnaireAnswers)}
        disabled={!allAnswered || isLoading}
        className="w-full mt-6 flex items-center justify-center gap-2 bg-gradient-to-r from-[#d6407a] to-[#8a2a54] disabled:opacity-40 text-white font-semibold text-sm py-4 rounded-2xl transition cursor-pointer"
      >
        {isLoading ? "Analyse en cours..." : <><Sparkles className="w-4 h-4" /> Lancer l'analyse <ArrowRight className="w-4 h-4" /></>}
      </button>
    </div>
  );
}
