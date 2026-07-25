import { useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "../store/authStore";
import { useLiveZoneStore } from "../store/liveZoneStore";
import type { ZoneStateUpdateMessage } from "../types/ws-messages";

export const OFFLINE_AFTER_CONSECUTIVE_FAILURES = 6;

// Module-level reference to allow exported forceReconnect() to trigger reconnection
let globalForceReconnect: (() => void) | null = null;

export function forceReconnect(): void {
  if (globalForceReconnect) {
    globalForceReconnect();
  }
}

export function useDashboardSocket() {
  const token = useAuthStore((state) => state.token);
  const setConnectionStatus = useLiveZoneStore((state) => state.setConnectionStatus);
  const applyZoneUpdate = useLiveZoneStore((state) => state.applyZoneUpdate);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const backoffMsRef = useRef<number>(1000);
  const consecutiveFailuresRef = useRef<number>(0);
  const isManuallyClosedRef = useRef<boolean>(false);

  const connect = useCallback(() => {
    if (!token) {
      setConnectionStatus("offline");
      return;
    }

    // Cancel any existing backoff timeout to avoid duplicate connections
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close any active socket cleanly before opening a new one
    if (socketRef.current) {
      isManuallyClosedRef.current = true;
      socketRef.current.close();
      socketRef.current = null;
    }

    isManuallyClosedRef.current = false;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.port === "5173" ? "localhost:8000" : window.location.host;
    const wsUrl = `${protocol}//${host}/api/v1/ws/dashboard?token=${encodeURIComponent(token)}`;

    setConnectionStatus(
      consecutiveFailuresRef.current >= OFFLINE_AFTER_CONSECUTIVE_FAILURES
        ? "offline"
        : "connecting"
    );

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      consecutiveFailuresRef.current = 0;
      backoffMsRef.current = 1000;
      setConnectionStatus("live");
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
        return;
      }

      consecutiveFailuresRef.current += 1;

      if (consecutiveFailuresRef.current >= OFFLINE_AFTER_CONSECUTIVE_FAILURES) {
        setConnectionStatus("offline");
      } else {
        setConnectionStatus("reconnecting");
      }

      const currentBackoff = backoffMsRef.current;
      backoffMsRef.current = Math.min(backoffMsRef.current * 2, 30000);

      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, currentBackoff);
    };
  }, [token, setConnectionStatus, applyZoneUpdate]);

  const handleForceReconnect = useCallback(() => {
    consecutiveFailuresRef.current = 0;
    backoffMsRef.current = 1000;
    connect();
  }, [connect]);

  useEffect(() => {
    globalForceReconnect = handleForceReconnect;
    return () => {
      globalForceReconnect = null;
    };
  }, [handleForceReconnect]);

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
  }, [token, connect, setConnectionStatus]);

  return { forceReconnect: handleForceReconnect };
}
