import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface SplashScreenProps {
  onFinished: () => void;
}

export default function SplashScreen({ onFinished }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        const next = p + Math.random() * 18 + 8;
        if (next >= 100) {
          clearInterval(interval);
          setTimeout(onFinished, 350);
          return 100;
        }
        return next;
      });
    }, 220);
    return () => clearInterval(interval);
  }, [onFinished]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 relative overflow-hidden">
      <div className="glow-orb w-[420px] h-[420px] bg-[#e0578f]/25 -top-32 -left-24" />
      <div className="glow-orb w-[360px] h-[360px] bg-[#d6407a]/20 bottom-[-100px] right-[-80px]" />

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center"
      >
        {/* Halo de pulsation derrière le logo */}
        <motion.div
          className="absolute inset-0 rounded-full bg-[#d6407a]/10 pointer-events-none"
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.15, 0.5] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Logo, grand et centré, léger mouvement continu */}
        <motion.img
          src="/icon-512.png"
          alt="SkinDiag"
          className="w-full h-full object-contain drop-shadow-[0_15px_40px_rgba(214,64,122,0.3)] relative"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      <div className="relative z-10 w-full max-w-xs mt-6">
        <div className="h-1.5 bg-[#2b1620]/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[#e0578f] to-[#8a2a54] rounded-full"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <p className="text-center text-[11px] text-[#2b1620]/50 mt-2.5 tracking-wide">
          Démarrage de l'application...
        </p>
      </div>
    </div>
  );
}
