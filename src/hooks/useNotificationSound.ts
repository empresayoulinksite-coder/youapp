import { useEffect, useRef, useState } from "react";

/**
 * Hook reutilizável para tocar um "ding-ding" sintetizado via Web Audio API
 * e persistir a preferência de som do usuário no localStorage.
 */
export function useNotificationSound(storageKey: string = "notif-sound") {
  const [soundOn, setSoundOn] = useState(true);
  const soundOnRef = useRef(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    soundOnRef.current = soundOn;
    try {
      localStorage.setItem(storageKey, soundOn ? "1" : "0");
    } catch {}
  }, [soundOn, storageKey]);

  useEffect(() => {
    try {
      const v = localStorage.getItem(storageKey);
      if (v === "0") setSoundOn(false);
    } catch {}
  }, [storageKey]);

  // Desbloqueia áudio no primeiro clique (políticas de autoplay)
  useEffect(() => {
    const unlock = () => {
      try {
        const Ctx =
          (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return;
        if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
        audioCtxRef.current?.resume().catch(() => {});
      } catch {}
      window.removeEventListener("pointerdown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  function playDing() {
    if (!soundOnRef.current) return;
    try {
      const Ctx =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current!;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const now = ctx.currentTime;
      [0, 0.18].forEach((offset, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = i === 0 ? 880 : 1320;
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.25, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.4);
      });
    } catch {}
  }

  return { soundOn, setSoundOn, playDing };
}
