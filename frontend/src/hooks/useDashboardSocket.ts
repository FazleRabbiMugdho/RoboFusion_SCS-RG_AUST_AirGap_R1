import { useEffect, useRef, useCallback } from "react";
import { startTransition } from "react";
import { useAuthStore } from "../store/authStore";
import { useLiveZoneStore } from "../store/liveZoneStore";
import type { ZoneStateUpdateMessage } from "../types/ws-messages";

export const OFFLINE_AFTER_CONSECUTIVE_FAILURES = 6;
const FLUSH_INTERVAL_MS = 150;

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
  const applyZoneUpdatesBatch = useLiveZoneStore((state) => state.applyZoneUpdatesBatch);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const backoffMsRef = useRef<number>(1000);
  const consecutiveFailuresRef = useRef<number>(0);

  // Batching refs
  const pendingUpdatesRef = useRef<ZoneStateUpdateMessage[]>([]);
  const flushIntervalRef = useRef<number | null>(null);

  // Use refs for store callbacks to keep connect reference stable across re-renders
  const setConnectionStatusRef = useRef(setConnectionStatus);
  setConnectionStatusRef.current = setConnectionStatus;

  const applyZoneUpdatesBatchRef = useRef(applyZoneUpdatesBatch);
  applyZoneUpdatesBatchRef.current = applyZoneUpdatesBatch;

  const flushPendingUpdates = useCallback(() => {
    const batch = pendingUpdatesRef.current;
    if (batch.length === 0) return;
    pendingUpdatesRef.current = [];
    startTransition(() => {
      applyZoneUpdatesBatchRef.current(batch);
    });
  }, []);

  const connect = useCallback(() => {
    if (!token) {
      setConnectionStatusRef.current("offline");
      return;
    }

    // Cancel any existing backoff timeout to avoid duplicate connections
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close any previous socket cleanly and disown it before creating a new one
    if (socketRef.current) {
      const oldWs = socketRef.current;
      socketRef.current = null;
      oldWs.close();
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.port === "5173" ? "localhost:8000" : window.location.host;
    const wsUrl = `${protocol}//${host}/api/v1/ws/dashboard?token=${encodeURIComponent(token)}`;

    setConnectionStatusRef.current(
      consecutiveFailuresRef.current >= OFFLINE_AFTER_CONSECUTIVE_FAILURES
        ? "offline"
        : "connecting"
    );

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      // Ignore open events from superseded sockets
      if (socketRef.current !== ws) return;

      consecutiveFailuresRef.current = 0;
      backoffMsRef.current = 1000;
      setConnectionStatusRef.current("live");

      // Start flush interval
      if (flushIntervalRef.current === null) {
        flushIntervalRef.current = window.setInterval(flushPendingUpdates, FLUSH_INTERVAL_MS);
      }
    };

    ws.onmessage = (event) => {
      if (socketRef.current !== ws) return;

      try {
        const data = JSON.parse(event.data);
        if (data && data.type === "zone_state_update") {
          pendingUpdatesRef.current.push(data as ZoneStateUpdateMessage);
        }
      } catch (err) {
        console.error("WS message parse error:", err);
      }
    };

    ws.onerror = (err) => {
      if (socketRef.current !== ws) return;
      console.warn("WS error:", err);
    };

    ws.onclose = () => {
      // If this socket instance was superseded or closed by cleanup, ignore its onclose
      if (socketRef.current !== ws) {
        return;
      }

      consecutiveFailuresRef.current += 1;

      if (consecutiveFailuresRef.current >= OFFLINE_AFTER_CONSECUTIVE_FAILURES) {
        setConnectionStatusRef.current("offline");
      } else {
        setConnectionStatusRef.current("reconnecting");
      }

      // Clear flush interval
      if (flushIntervalRef.current !== null) {
        clearInterval(flushIntervalRef.current);
        flushIntervalRef.current = null;
      }

      const currentBackoff = backoffMsRef.current;
      backoffMsRef.current = Math.min(backoffMsRef.current * 2, 30000);

      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, currentBackoff);
    };
  }, [token]);

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
        const oldWs = socketRef.current;
        socketRef.current = null;
        oldWs.close();
      }
      setConnectionStatus("offline");
      if (flushIntervalRef.current !== null) {
        clearInterval(flushIntervalRef.current);
        flushIntervalRef.current = null;
      }
      return;
    }

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (flushIntervalRef.current !== null) {
        clearInterval(flushIntervalRef.current);
        flushIntervalRef.current = null;
      }
      if (socketRef.current) {
        const oldWs = socketRef.current;
        socketRef.current = null;
        oldWs.close();
      }
    };
  }, [token, connect, setConnectionStatus]);

  return { forceReconnect: handleForceReconnect };
}