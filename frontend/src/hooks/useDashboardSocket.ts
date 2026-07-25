import { useEffect, useRef } from "react";
import { useAuthStore } from "../store/authStore";
import { useLiveZoneStore } from "../store/liveZoneStore";
import type { ZoneStateUpdateMessage } from "../types/ws-messages";

export function useDashboardSocket() {
  const token = useAuthStore((state) => state.token);
  const setConnectionStatus = useLiveZoneStore((state) => state.setConnectionStatus);
  const applyZoneUpdate = useLiveZoneStore((state) => state.applyZoneUpdate);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const backoffMsRef = useRef<number>(1000);
  const isManuallyClosedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        isManuallyClosedRef.current = true;
        socketRef.current.close();
        socketRef.current = null;
      }
      setConnectionStatus("offline");
      return;
    }

    isManuallyClosedRef.current = false;
    backoffMsRef.current = 1000;

    function connect() {
      if (!token) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.port === "5173" ? "localhost:8000" : window.location.host;
      const wsUrl = `${protocol}//${host}/api/v1/ws/dashboard?token=${encodeURIComponent(token)}`;

      setConnectionStatus("connecting");
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus("live");
        backoffMsRef.current = 1000;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.type === "zone_state_update") {
            applyZoneUpdate(data as ZoneStateUpdateMessage);
          }
        } catch (err) {
          console.error("WS message parse error:", err);
        }
      };

      ws.onerror = (err) => {
        console.warn("WS error:", err);
      };

      ws.onclose = () => {
        if (isManuallyClosedRef.current) {
          setConnectionStatus("offline");
          return;
        }

        setConnectionStatus("reconnecting");
        const currentBackoff = backoffMsRef.current;
        backoffMsRef.current = Math.min(backoffMsRef.current * 2, 30000);

        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, currentBackoff);
      };
    }

    connect();

    return () => {
      isManuallyClosedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [token, setConnectionStatus, applyZoneUpdate]);
}
