/**
 * Hook WebSocket — ATS-UMN Presence System
 * Reconexão automática com backoff exponencial.
 * Unidade 2 — Protocolos de Comunicação em Tempo Real (WebSocket/MQTT)
 */

import { useEffect, useRef, useState, useCallback } from 'react'

const _proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const WS_URL = `${_proto}//${window.location.host}/ws`
const MAX_RECONNECT_DELAY = 10000

export function useWebSocket({ onMessage }) {
  const wsRef = useRef(null)
  const retryRef = useRef(0)
  const retryTimer = useRef(null)
  const [connected, setConnected] = useState(false)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      retryRef.current = 0
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type !== 'ping') onMessage(data)
      } catch {/* ignorar mensagens malformadas */}
    }

    ws.onclose = () => {
      setConnected(false)
      // Backoff exponencial: 1s, 2s, 4s, 8s, 10s (máximo)
      const delay = Math.min(1000 * 2 ** retryRef.current, MAX_RECONNECT_DELAY)
      retryRef.current += 1
      retryTimer.current = setTimeout(connect, delay)
    }

    ws.onerror = () => ws.close()
  }, [onMessage])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(retryTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { connected }
}
