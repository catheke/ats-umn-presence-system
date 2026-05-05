import { useState, useCallback, useEffect } from 'react'
import { useWebSocket } from './hooks/useWebSocket'
import Dashboard from './components/Dashboard'

const STATUS_COLOR = {
  low:    { bg: 'bg-emerald-500', text: '#22c55e', label: 'Baixa' },
  medium: { bg: 'bg-amber-400',   text: '#f59e0b', label: 'Média' },
  high:   { bg: 'bg-red-500',     text: '#ef4444', label: 'Alta'  },
  full:   { bg: 'bg-red-700',     text: '#991b1b', label: 'Lotado'},
}

export { STATUS_COLOR }

export default function App() {
  const [zones, setZones]   = useState({})
  const [alerts, setAlerts] = useState([])
  const [stats, setStats]   = useState(null)

  // Carregar estado inicial via REST (fallback se WS demorar)
  useEffect(() => {
    fetch('/api/zones')
      .then(r => r.json())
      .then(data => {
        const map = {}
        data.forEach(z => { map[z.id] = z })
        setZones(map)
      })
      .catch(() => {})

    fetch('/api/stats').then(r => r.json()).then(setStats).catch(() => {})
    fetch('/api/alerts').then(r => r.json()).then(setAlerts).catch(() => {})
  }, [])

  const handleMessage = useCallback((msg) => {
    if (msg.type === 'initial_state') {
      const map = {}
      msg.zones.forEach(z => { map[z.id] = z })
      setZones(map)
      if (msg.alerts) setAlerts(msg.alerts.slice(0, 8))
      if (msg.stats)  setStats(msg.stats)
    }

    if (msg.type === 'zone_update') {
      setZones(prev => ({ ...prev, [msg.zone.id]: msg.zone }))
      // Recalcular stats no cliente para evitar round-trip extra ao servidor
      setStats(prev => {
        if (!prev) return prev
        return { ...prev, _tick: (prev._tick || 0) + 1 }
      })
    }

    if (msg.type === 'alert') {
      setAlerts(prev => [msg.alert, ...prev].slice(0, 8))
    }
  }, [])

  const { connected } = useWebSocket({ onMessage: handleMessage })

  // Recalcular stats localmente a partir das zonas em memória
  useEffect(() => {
    const list = Object.values(zones)
    if (!list.length) return
    const total_people   = list.reduce((s, z) => s + z.current_count, 0)
    const total_capacity = list.reduce((s, z) => s + z.capacity, 0)
    setStats({
      total_people,
      total_capacity,
      overall_occupancy: total_capacity ? +(total_people / total_capacity * 100).toFixed(1) : 0,
      full_zones:   list.filter(z => z.status === 'full').length,
      high_zones:   list.filter(z => z.status === 'high').length,
      total_zones:  list.length,
      active_alerts: list.filter(z => z.status === 'full' || z.status === 'high').length,
    })
  }, [zones])

  return (
    <Dashboard
      zones={zones}
      alerts={alerts}
      stats={stats}
      connected={connected}
      onDismissAlert={(id) => setAlerts(prev => prev.filter(a => a.id !== id))}
    />
  )
}
