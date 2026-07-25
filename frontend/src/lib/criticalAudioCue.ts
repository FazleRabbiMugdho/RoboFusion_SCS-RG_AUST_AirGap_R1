import { useUIStore } from "../store/uiStore";

let audioCtx: AudioContext | null = null;

export function playCriticalAlertCue(): void {
  // Check mute state first
  if (useUIStore.getState().isMuted) {
    return;
  }

  // Lazily instantiate AudioContext on demand
  if (!audioCtx) {
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtxClass) {
      audioCtx = new AudioCtxClass();
    }
  }

  if (!audioCtx) return;

  // Defensive check for suspended AudioContext state
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch((err) => {
      console.warn("[AudioCue] AudioContext resume failed/skipped:", err);
    });
  }

  const now = audioCtx.currentTime;

  // Dual-tone sequence:
  // Tone 1: 523.25 Hz (C5) for 120ms
  // Tone 2: 622.25 Hz (Eb5) for 120ms immediately after (total ~240ms)
  const tone1Freq = 523.25;
  const tone2Freq = 622.25;
  const toneDuration = 0.12;

  // Tone 1
  const osc1 = audioCtx.createOscillator();
  const gain1 = audioCtx.createGain();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(tone1Freq, now);

  gain1.gain.setValueAtTime(0, now);
  gain1.gain.linearRampToValueAtTime(0.15, now + 0.01);
  gain1.gain.linearRampToValueAtTime(0, now + toneDuration);

  osc1.connect(gain1);
  gain1.connect(audioCtx.destination);

  osc1.start(now);
  osc1.stop(now + toneDuration);

  // Tone 2
  const startTime2 = now + toneDuration;
  const osc2 = audioCtx.createOscillator();
  const gain2 = audioCtx.createGain();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(tone2Freq, startTime2);

  gain2.gain.setValueAtTime(0, startTime2);
  gain2.gain.linearRampToValueAtTime(0.15, startTime2 + 0.01);
  gain2.gain.linearRampToValueAtTime(0, startTime2 + toneDuration);

  osc2.connect(gain2);
  gain2.connect(audioCtx.destination);

  osc2.start(startTime2);
  osc2.stop(startTime2 + toneDuration);
}
