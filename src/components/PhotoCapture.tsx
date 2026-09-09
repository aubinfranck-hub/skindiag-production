import React, { useRef, useState } from "react";
import { Camera, Upload, ArrowLeft, Sparkles } from "lucide-react";
import { SkinZone, ZONE_LABELS } from "../types";

interface PhotoCaptureProps {
  zone: SkinZone;
  onBack: () => void;
  onCapture: (base64: string, mimeType: string) => void;
  isLoading: boolean;
}

export default function PhotoCapture({ zone, onBack, onCapture, isLoading }: PhotoCaptureProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingBase64, setPendingBase64] = useState<{ data: string; mime: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (file.size > 15 * 1024 * 1024) {
      alert("Photo trop volumineuse (max 15 Mo).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(",")[1];
      setPreview(result);
      setPendingBase64({ data: base64Data, mime: file.type });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-[#f5ede1]/60 hover:text-[#f5ede1] mb-4 cursor-pointer">
        <ArrowLeft className="w-3.5 h-3.5" /> Changer de zone
      </button>

      <h2 className="text-2xl font-display font-semibold text-[#f5ede1] mb-1.5">Zone : {ZONE_LABELS[zone]}</h2>
      <p className="text-sm text-[#f5ede1]/60 mb-6">Prenez une photo nette, bien éclairée, de la zone à analyser.</p>

      <div className="premium-card rounded-3xl p-6 text-center">
        {preview ? (
          <img src={preview} alt="Aperçu" className="w-full max-h-80 object-contain rounded-2xl mb-4" />
        ) : (
          <div className="py-16 flex flex-col items-center gap-3 text-[#f5ede1]/40">
            <Camera className="w-12 h-12" />
            <span className="text-sm">Aucune photo pour l'instant</span>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-[#f5ede1] font-medium text-sm py-3.5 rounded-xl transition cursor-pointer"
          >
            <Camera className="w-4 h-4" /> Prendre une photo
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-[#f5ede1] font-medium text-sm py-3.5 rounded-xl transition cursor-pointer"
          >
            <Upload className="w-4 h-4" /> Importer une photo
          </button>
        </div>
      </div>

      <button
        onClick={() => pendingBase64 && onCapture(pendingBase64.data, pendingBase64.mime)}
        disabled={!pendingBase64 || isLoading}
        className="w-full mt-5 flex items-center justify-center gap-2 bg-gradient-to-r from-[#d6407a] to-[#8a2a54] disabled:opacity-40 text-white font-semibold text-sm py-4 rounded-2xl transition cursor-pointer"
      >
        {isLoading ? (
          <>Analyse en cours...</>
        ) : (
          <>
            <Sparkles className="w-4 h-4" /> Analyser cette photo
          </>
        )}
      </button>

      <p className="text-[11px] text-[#f5ede1]/40 text-center mt-4 leading-relaxed">
        SkinDiag fournit une analyse visuelle indicative, pas un diagnostic médical.
        Consultez un dermatologue pour toute préoccupation inhabituelle ou persistante.
      </p>
    </div>
  );
}
