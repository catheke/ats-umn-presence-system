import { useState, useEffect } from 'react'
import { Wifi, WifiOff, Users, AlertTriangle, Activity } from 'lucide-react'

export default function Header({ connected, stats }) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const timeStr = time.toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = time.toLocaleDateString('pt-AO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <header className="bg-navy-800 text-white shadow-lg">
      <div className="max-w-screen-2xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">

          {/* Logo + Título */}
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/10 backdrop-blur text-2xl select-none">
              🏛️
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight tracking-tight">
                Sistema de Monitorização de Presença
              </h1>
              <p className="text-blue-200 text-xs font-medium">
                Instituto Politécnico da Huíla · Universidade Mandume ya Ndemufayo · Lubango, Angola
              </p>
            </div>
          </div>

          {/* Stats rápidas */}
          {stats && (
            <div className="flex items-center gap-5">
              <StatChip icon={<Users size={14} />} label="Total de pessoas" value={stats.total_people} />
              <StatChip
                icon={<Activity size={14} />}
                label="Ocupação global"
                value={`${stats.overall_occupancy}%`}
                accent={stats.overall_occupancy >= 75 ? 'text-red-300' : stats.overall_occupancy >= 40 ? 'text-amber-300' : 'text-emerald-300'}
              />
              {stats.full_zones > 0 && (
                <StatChip
                  icon={<AlertTriangle size={14} />}
                  label="Zonas lotadas"
                  value={stats.full_zones}
                  accent="text-red-300"
                />
              )}
            </div>
          )}

          {/* Relógio + Status WS */}
          <div className="flex items-center gap-4 text-right">
            <div>
              <div className="text-xl font-mono font-bold">{timeStr}</div>
              <div className="text-blue-300 text-xs capitalize">{dateStr}</div>
            </div>
            <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${connected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
              {connected
                ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" /><Wifi size={12} /> Online</>
                : <><WifiOff size={12} /> Offline</>
              }
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

function StatChip({ icon, label, value, accent = 'text-white' }) {
  return (
    <div className="flex flex-col items-center bg-white/10 rounded-xl px-4 py-2 min-w-[80px]">
      <div className="flex items-center gap-1 text-blue-200 text-[10px] uppercase tracking-wider mb-0.5">
        {icon} {label}
      </div>
      <span className={`text-lg font-bold ${accent}`}>{value}</span>
    </div>
  )
}
