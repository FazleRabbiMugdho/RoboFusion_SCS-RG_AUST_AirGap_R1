import { useEffect, useRef } from "react";
import { useLiveZoneStore } from "../store/liveZoneStore";
import { useUIStore } from "../store/uiStore";
import { playCriticalAlertCue } from "../lib/criticalAudioCue";
import { ToastStack } from "./ToastStack";

export function CriticalAlertMotionLayer() {
  const criticalTransitions = useLiveZoneStore((state) => state.criticalTransitions);
  const lastProcessedEventIdRef = useRef<number>(-1);

  useEffect(() => {
    if (criticalTransitions.length === 0) return;

    let maxEventId = lastProcessedEventIdRef.current;

    criticalTransitions.forEach((entry) => {
      if (entry.eventId > lastProcessedEventIdRef.current) {
        console.debug(
          `[Critical Alert Motion] Processed eventId: ${entry.eventId} for zone ${entry.zoneName} (${entry.zoneId})`
        );

        // Synchronized audio cue (respects isMuted)
        playCriticalAlertCue();

        // Add toast to global stack
        useUIStore.getState().addToast({
          zoneId: entry.zoneId,
          zoneName: entry.zoneName,
          timestamp: entry.timestamp,
        });

        if (entry.eventId > maxEventId) {
          maxEventId = entry.eventId;
        }
      }
    });

    lastProcessedEventIdRef.current = maxEventId;
  }, [criticalTransitions]);

  return <ToastStack />;
}
