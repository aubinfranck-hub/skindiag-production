import React, { useRef, useState, useEffect } from "react";
import { Video, ArrowLeft, Sparkles, Square, Circle, Upload } from "lucide-react";
import { SkinZone, ZONE_LABELS } from "../types";

interface VideoCaptureProps {
  zone: SkinZone;
  onBack: () => void;
  onCapture: (base64: string, mimeType: string) => void;
  isLoading: boolean;
}

const MAX_DURATION_SEC = 8;

export default function VideoCapture({ zone, onBack, onCapture, isLoading }: VideoCaptureProps) {
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [pending, setPending] = useState<{ data: string; mime: string } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        await videoPreviewRef.current.play();
      }
    } catch {
      setCameraError("Impossible d'accéder à la caméra. Vérifiez les autorisations de votre navigateur.");
    }
  };

  const startRecording = async () => {
    if (!streamRef.current) await startCamera();
    if (!streamRef.current) return;

    chunksRef.current = [];
    setRecordedUrl(null);
    setPending(null);

    const recorder = new MediaRecorder(streamRef.current, { mimeType: "video/webm" });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setRecordedUrl(url);

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setPending({ data: result.split(",")[1], mime: "video/webm" });
      };
      reader.readAsDataURL(blob);

      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };

    recorder.start();
    setIsRecording(true);
    setDuration(0);
    intervalRef.current = setInterval(() => {
      setDuration((d) => {
        if (d + 1 >= MAX_DURATION_SEC) {
          stopRecording();
          return MAX_DURATION_SEC;
        }
        return d + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleImportedFile = (file: File) => {
    if (file.size > 35 * 1024 * 1024) {
      alert("Vidéo trop volumineuse (max 35 Mo). Filmez un clip plus court, ou réduisez la qualité.");
      return;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    const url = URL.createObjectURL(file);
    setRecordedUrl(url);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPending({ data: result.split(",")[1], mime: file.type || "video/mp4" });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold text-[#d6407a] bg-white shadow-[0_4px_14px_-6px_rgba(214,64,122,0.4)] rounded-full px-3.5 py-2 mb-4 hover:-translate-y-0.5 transition cursor-pointer">
        <ArrowLeft className="w-4 h-4" /> Changer de zone
      </button>

      <h2 className="text-2xl font-display font-semibold text-[#2b1620] mb-1.5">Zone : {ZONE_LABELS[zone]}</h2>
      <p className="text-sm text-[#2b1620]/60 mb-6">
        Filmez la zone sous un bon éclairage, {MAX_DURATION_SEC} secondes maximum. Bougez légèrement pour montrer le relief.
      </p>

      <div className="premium-card rounded-3xl p-6 text-center">
        {recordedUrl ? (
          <video src={recordedUrl} controls className="w-full max-h-80 rounded-2xl mb-4 bg-black" />
        ) : (
          <div className="relative rounded-2xl overflow-hidden bg-black mb-4" style={{ aspectRatio: "3/4" }}>
            <video ref={videoPreviewRef} muted playsInline className="w-full h-full object-cover" />
            {!streamRef.current && !isRecording && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[#2b1620]/40">
                <Video className="w-12 h-12" />
                <span className="text-sm">Caméra pas encore activée</span>
              </div>
            )}
            {isRecording && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-xs text-white font-mono">{duration}s / {MAX_DURATION_SEC}s</span>
              </div>
            )}
          </div>
        )}

        {cameraError && <p className="text-xs text-rose-400 mb-3">{cameraError}</p>}

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleImportedFile(e.target.files[0])}
        />

        {!recordedUrl && (
          <div className="space-y-2.5">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-full flex items-center justify-center gap-2 font-medium text-sm py-3.5 rounded-xl transition cursor-pointer ${
                isRecording ? "bg-rose-600 hover:bg-rose-700 text-white" : "bg-[#2b1620]/[0.04] hover:bg-[#2b1620]/[0.06] border border-[#2b1620]/10 text-[#2b1620]"
              }`}
            >
              {isRecording ? <><Square className="w-4 h-4" /> Arrêter l'enregistrement</> : <><Circle className="w-4 h-4 fill-rose-500 text-rose-500" /> Démarrer la caméra et filmer</>}
            </button>

            {!isRecording && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 bg-[#2b1620]/[0.04] hover:bg-[#2b1620]/[0.06] border border-[#2b1620]/10 text-[#2b1620] font-medium text-sm py-3.5 rounded-xl transition cursor-pointer"
              >
                <Upload className="w-4 h-4" /> Importer une vidéo existante
              </button>
            )}
          </div>
        )}

        {recordedUrl && (
          <button
            onClick={() => { setRecordedUrl(null); setPending(null); }}
            className="w-full text-xs text-[#2b1620]/60 hover:text-[#2b1620] py-2 cursor-pointer"
          >
            Changer de vidéo
          </button>
        )}
      </div>

      <button
        onClick={() => pending && onCapture(pending.data, pending.mime)}
        disabled={!pending || isLoading}
        className="w-full mt-5 flex items-center justify-center gap-2 bg-gradient-to-r from-[#d6407a] to-[#8a2a54] disabled:opacity-40 text-white font-semibold text-sm py-4 rounded-2xl transition cursor-pointer"
      >
        {isLoading ? "Analyse en cours..." : <><Sparkles className="w-4 h-4" /> Analyser cette vidéo</>}
      </button>

      <p className="text-[11px] text-[#2b1620]/40 text-center mt-4 leading-relaxed">
        SkinDiag fournit une analyse visuelle indicative, pas un diagnostic médical.
        Consultez un dermatologue pour toute préoccupation inhabituelle ou persistante.
      </p>
    </div>
  );
}
