import { useState, useEffect, useCallback } from 'react'
import { Thermometer, Droplets, Wind, Volume2, RefreshCw, AlertTriangle } from 'lucide-react'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts'

const AQI_STYLE = {
  Excelente: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  Boa:       { bg: 'bg-green-50 border-green-200',     text: 'text-green-700',   dot: 'bg-green-400'   },
  Moderada:  { bg: 'bg-yellow-50 border-yellow-200',   text: 'text-yellow-700',  dot: 'bg-yellow-400'  },
  Má:        { bg: 'bg-orange-50 border-orange-300',   text: 'text-orange-700',  dot: 'bg-orange-500'  },
  Crítica:   { bg: 'bg-red-50 border-red-300',         text: 'text-red-700',     dot: 'bg-red-500 animate-pulse' },
}

function GaugeMini({ value, min, max, unit, label, icon, warn, danger }) {
  const pct   = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
  const color = value >= danger ? '#ef4444' : value >= warn ? '#f59e0b' : '#22c55e'
  const r = 28, circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#e2e8f0" strokeWidth="6"/>
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          transform="rotate(-90 36 36)"
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }}/>
        <text x="36" y="32" textAnchor="middle" fontSize="12" fontWeight="700" fill={color}>{value ?? '–'}</text>
        <text x="36" y="44" textAnchor="middle" fontSize="7"  fill="#94a3b8">{unit}</text>
      </svg>
      <div className="flex items-center gap-1 text-slate-500 text-[10px]">{icon}{label}</div>
    </div>
  )
}

function ZoneEnvCard({ zone }) {
  const hasData = zone.temperature !== null
  const aqi     = AQI_STYLE[zone.aqi_label] ?? AQI_STYLE['Boa']

  return (
    <div className={`card border ${hasData && zone.env_alerts?.length ? 'border-amber-300 bg-amber-50' : 'border-slate-100'}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-bold text-navy-800 text-sm">{zone.zone_name}</p>
          <p className="text-[10px] text-slate-400">{zone.zone_type}</p>
        </div>
        {zone.aqi_label && (
          <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${aqi.bg} ${aqi.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${aqi.dot}`}/>
            Ar: {zone.aqi_label}
          </span>
        )}
      </div>

      {hasData ? (
        <div className="grid grid-cols-4 gap-2">
          <GaugeMini value={zone.temperature} min={10} max={40} unit="°C"   label="Temp."  warn={28} danger={33} icon={<Thermometer size={10}/>}/>
          <GaugeMini value={zone.humidity}    min={20} max={95} unit="%"    label="Humid." warn={80} danger={90} icon={<Droplets size={10}/>}/>
          <GaugeMini value={zone.co2_ppm}     min={400} max={2000} unit="ppm" label="CO₂"  warn={1000} danger={1500} icon={<Wind size={10}/>}/>
          <GaugeMini value={zone.noise_db}    min={15} max={100} unit="dB"  label="Ruído" warn={55} danger={75} icon={<Volume2 size={10}/>}/>
        </div>
      ) : (
        <p className="text-xs text-slate-300 text-center py-4">Aguardando dados do sensor…</p>
      )}

      {zone.env_alerts?.length > 0 && (
        <div className="mt-3 flex flex-col gap-1">
          {zone.env_alerts.map((a, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-amber-700 bg-amber-100 rounded-lg px-3 py-1.5">
              <AlertTriangle size={12} className="shrink-0 mt-0.5"/>
              {a}
            </div>
          ))}
        </div>
      )}
      {zone.last_updated && (
        <p className="text-[9px] text-slate-300 mt-2 text-right">
          {new Date(zone.last_updated + 'Z').toLocaleTimeString('pt-AO')}
        </p>
      )}
    </div>
  )
}

function RadarSummary({ zones }) {
  if (!zones.length) return null
  const data = zones.slice(0, 6).map(z => ({
    subject: z.name_short || z.zone_name?.split('—')[0].trim() || z.zone_id,
    CO2:   z.co2_ppm  ? Math.min(100, Math.round((z.co2_ppm  - 400) / 16))   : 0,
    Temp:  z.temperature ? Math.min(100, Math.round((z.temperature - 10) / 0.3)): 0,
    Ruído: z.noise_db    ? Math.min(100, Math.round(z.noise_db))               : 0,
  }))

  return (
    <div className="card">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Radar Ambiental — Comparação de Zonas</p>
      <ResponsiveContainer width="100%" height={220}>
        <RadarChart data={data}>
          <PolarGrid stroke="#e2e8f0"/>
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: '#94a3b8' }}/>
          <Radar name="CO₂"  dataKey="CO2"  stroke="#ef4444" fill="#ef4444" fillOpacity={0.15}/>
          <Radar name="Temp" dataKey="Temp" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15}/>
          <Radar name="Ruído"dataKey="Ruído"stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15}/>
          <Tooltip/>
        </RadarChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-4 text-[10px] text-slate-500 mt-1">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"/>CO₂</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>Temperatura</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block"/>Ruído</span>
      </div>
    </div>
  )
}

export default function EnvironmentPanel() {
  const [data, setData]     = useState({ zones: [], zones_with_alerts: 0 })
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const r = await fetch('/api/entities/environment')
      setData(await r.json())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 6000)
    return () => clearInterval(id)
  }, [fetchData])

  const zonesWithAlerts = data.zones?.filter(z => z.env_alerts?.length) ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy-800">Monitorização Ambiental</h2>
          <p className="text-xs text-slate-400 mt-0.5">Temperatura · CO₂ · Humidade · Ruído — por zona do campus IPH</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-1.5 text-xs text-navy-700 hover:text-navy-900">
          <RefreshCw size={12}/> Actualizar
        </button>
      </div>

      {zonesWithAlerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {zonesWithAlerts.map(z => z.env_alerts.map((a, i) => (
            <div key={`${z.zone_id}-${i}`} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
              <AlertTriangle size={16} className="shrink-0 text-amber-500"/>
              <span>{a} — <strong>{z.zone_name}</strong></span>
            </div>
          )))}
        </div>
      )}

      {/* Legenda de referência */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: <Thermometer size={14}/>, label: 'Temperatura', ref: '18–26 °C ideal', color: 'text-orange-500' },
          { icon: <Droplets size={14}/>,    label: 'Humidade',    ref: '40–70 % ideal',  color: 'text-blue-500' },
          { icon: <Wind size={14}/>,        label: 'CO₂',         ref: '< 800 ppm ideal',color: 'text-emerald-600' },
          { icon: <Volume2 size={14}/>,     label: 'Ruído',       ref: '< 55 dB ideal',  color: 'text-purple-500' },
        ].map(m => (
          <div key={m.label} className="card flex items-center gap-2 py-2.5 px-3">
            <span className={m.color}>{m.icon}</span>
            <div>
              <p className="text-xs font-semibold text-slate-700">{m.label}</p>
              <p className="text-[10px] text-slate-400">{m.ref}</p>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2 text-sm">
          <RefreshCw size={16} className="animate-spin"/> A carregar…
        </div>
      ) : (
        <>
          <RadarSummary zones={data.zones ?? []}/>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {(data.zones ?? []).map(z => <ZoneEnvCard key={z.zone_id} zone={z}/>)}
          </div>
        </>
      )}

      <p className="text-[10px] text-slate-300 text-center border-t border-slate-100 pt-3">
        Lubango, Huíla · Altitude ~1700 m · Clima temperado de altitude · Sensores IoT (ESP32/DHT22 + MQ-135 + Micrófone MEMS)
      </p>
    </div>
  )
}
