import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, LineChart, Line, Legend,
} from 'recharts'
import { BarChart2, TrendingUp } from 'lucide-react'

const STATUS_COLOR = {
  low:    '#22c55e',
  medium: '#f59e0b',
  high:   '#ef4444',
  full:   '#991b1b',
}

function getBarColor(percent) {
  if (percent >= 100) return STATUS_COLOR.full
  if (percent >= 75)  return STATUS_COLOR.high
  if (percent >= 40)  return STATUS_COLOR.medium
  return STATUS_COLOR.low
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-bold text-navy-800 mb-1">{d?.fullName || label}</p>
      <p className="text-slate-600">Ocupação: <strong style={{ color: getBarColor(d?.pct) }}>{d?.pct?.toFixed(1)}%</strong></p>
      <p className="text-slate-500">{d?.count} / {d?.capacity} pessoas</p>
    </div>
  )
}

const HistoryTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="text-slate-500 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} className="font-medium" style={{ color: p.color }}>
          {p.name}: {p.value?.toFixed(1)}%
        </p>
      ))}
    </div>
  )
}

// Cores fixas para cada zona no gráfico de tendências
const ZONE_COLORS = {
  cafeteria:  '#6366f1',
  sala_14:    '#0ea5e9',
  sala_15:    '#8b5cf6',
  sala_21:    '#f43f5e',
  sala_23:    '#14b8a6',
  lab_info_1: '#f59e0b',
  lab_info_2: '#10b981',
  biblioteca: '#3b82f6',
  auditorio:  '#ec4899',
  secretaria: '#84cc16',
}

export default function OccupancyChart({ zones }) {
  const [mode, setMode] = useState('bar')        // 'bar' | 'trend'
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [selectedZones, setSelectedZones] = useState(['cafeteria', 'biblioteca', 'lab_info_1'])

  // Dados do gráfico de barras (situação atual)
  const barData = Object.values(zones).map(z => ({
    name:     z.name_short,
    fullName: z.name,
    pct:      z.occupancy_percent,
    count:    z.current_count,
    capacity: z.capacity,
  }))

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const res  = await fetch('/api/history')
      const data = await res.json()
      // Organizar dados de tendência: array de timestamps com valores de cada zona
      const byZone = data
      const allTs = new Set()
      Object.values(byZone).forEach(entries => entries.forEach(e => allTs.add(e.timestamp.slice(11, 19))))
      const timestamps = [...allTs].sort().slice(-30)

      const trendData = timestamps.map(ts => {
        const point = { ts }
        Object.entries(byZone).forEach(([zid, entries]) => {
          const match = entries.findLast?.(e => e.timestamp.slice(11, 19) <= ts) || entries[entries.length - 1]
          if (match) point[zid] = match.occupancy_percent
        })
        return point
      })
      setHistory(trendData)
    } catch { /* falha silenciosa */ }
    finally { setLoadingHistory(false) }
  }, [])

  useEffect(() => {
    if (mode === 'trend') fetchHistory()
  }, [mode, fetchHistory])

  const toggleZone = (id) => setSelectedZones(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  )

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-sm font-bold text-navy-800 uppercase tracking-wider flex items-center gap-2">
          <BarChart2 size={16} /> Análise de Ocupação
        </h2>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setMode('bar')}
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all ${mode === 'bar' ? 'bg-white text-navy-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <BarChart2 size={12} className="inline mr-1" />Atual
          </button>
          <button
            onClick={() => setMode('trend')}
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all ${mode === 'trend' ? 'bg-white text-navy-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <TrendingUp size={12} className="inline mr-1" />Tendência
          </button>
        </div>
      </div>

      {mode === 'bar' ? (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ top: 4, right: 8, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} angle={-30} textAnchor="end" height={45} />
              <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} unit="%" domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="4 2" label={{ value: '75%', fill: '#ef4444', fontSize: 9, position: 'right' }} />
              <ReferenceLine y={40} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: '40%', fill: '#f59e0b', fontSize: 9, position: 'right' }} />
              <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={getBarColor(entry.pct)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-slate-400 text-center mt-1">Ocupação actual por zona (%) · Limiares: 40% Médio | 75% Alto</p>
        </>
      ) : (
        <>
          {/* Selector de zonas */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {Object.keys(ZONE_COLORS).map(zid => {
              const z = zones[zid]
              if (!z) return null
              return (
                <button
                  key={zid}
                  onClick={() => toggleZone(zid)}
                  className={`text-[10px] px-2 py-1 rounded-md border font-medium transition-all ${selectedZones.includes(zid) ? 'text-white border-transparent' : 'bg-white text-slate-400 border-slate-200'}`}
                  style={selectedZones.includes(zid) ? { background: ZONE_COLORS[zid], borderColor: ZONE_COLORS[zid] } : {}}
                >
                  {z.name_short}
                </button>
              )
            })}
          </div>
          {loadingHistory ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">A carregar histórico…</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={history} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="ts" tick={{ fontSize: 8, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} unit="%" domain={[0, 100]} />
                <Tooltip content={<HistoryTooltip />} />
                <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="3 2" />
                {selectedZones.map(zid => (
                  <Line
                    key={zid}
                    type="monotone"
                    dataKey={zid}
                    name={zones[zid]?.name_short ?? zid}
                    stroke={ZONE_COLORS[zid]}
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
          <p className="text-[10px] text-slate-400 text-center mt-1">Tendência histórica de ocupação por zona (%)</p>
        </>
      )}
    </div>
  )
}
