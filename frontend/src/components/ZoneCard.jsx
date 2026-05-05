import { useRef, useEffect } from 'react'
import { BookOpen, Monitor, Coffee, Mic2, Briefcase, GraduationCap, Car, PawPrint, Cpu } from 'lucide-react'

const ZONE_ICON = {
  classroom:  <GraduationCap size={16}/>,
  laboratory: <Monitor size={16}/>,
  cafeteria:  <Coffee size={16}/>,
  library:    <BookOpen size={16}/>,
  auditorium: <Mic2 size={16}/>,
  office:     <Briefcase size={16}/>,
  parking:    <Car size={16}/>,
  outdoor:    <PawPrint size={16}/>,
  equipment:  <Cpu size={16}/>,
}

const ENTITY_BADGE = {
  person:    null,
  vehicle:   { label: '🚗 Veículo',    cls: 'bg-blue-100 text-blue-700' },
  animal:    { label: '🐾 Animal',      cls: 'bg-amber-100 text-amber-700' },
  equipment: { label: '🖥️ Equipamento', cls: 'bg-purple-100 text-purple-700' },
}

const STATUS = {
  low:    { color: '#22c55e', label: 'Baixa',  badge: 'bg-emerald-100 text-emerald-700' },
  medium: { color: '#f59e0b', label: 'Média',  badge: 'bg-amber-100 text-amber-700'    },
  high:   { color: '#ef4444', label: 'Alta',   badge: 'bg-red-100 text-red-700'        },
  full:   { color: '#991b1b', label: 'Lotado', badge: 'bg-red-600 text-white'          },
}

function CircularGauge({ percent, status }) {
  const r    = 34
  const circ = 2 * Math.PI * r
  const off  = circ - (Math.min(percent, 100) / 100) * circ
  const color = STATUS[status]?.color ?? '#22c55e'
  return (
    <svg width="88" height="88" viewBox="0 0 88 88">
      <circle cx="44" cy="44" r={r} fill="none" stroke="#e2e8f0" strokeWidth="7"/>
      <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="7"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off}
        transform="rotate(-90 44 44)"
        style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}/>
      <text x="44" y="40" textAnchor="middle" fontSize="13" fontWeight="700" fill={color}
        style={{ fontFamily:'Inter,sans-serif', transition:'fill 0.4s ease' }}>
        {Math.round(Math.min(percent,100))}%
      </text>
      <text x="44" y="53" textAnchor="middle" fontSize="7" fill="#94a3b8" style={{ fontFamily:'Inter,sans-serif' }}>
        ocup.
      </text>
    </svg>
  )
}

function EnvBadge({ zone }) {
  if (!zone.temperature && !zone.co2_ppm) return null
  const co2Color = !zone.co2_ppm ? '#94a3b8' : zone.co2_ppm > 1500 ? '#ef4444' : zone.co2_ppm > 1000 ? '#f59e0b' : '#22c55e'
  const tmpColor = !zone.temperature ? '#94a3b8' : zone.temperature > 30 ? '#ef4444' : zone.temperature > 26 ? '#f59e0b' : '#3b82f6'
  return (
    <div className="flex items-center gap-2 mt-1">
      {zone.temperature && (
        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-100" style={{ color: tmpColor }}>
          🌡️ {zone.temperature}°C
        </span>
      )}
      {zone.co2_ppm && (
        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-100" style={{ color: co2Color }}>
          💨 {zone.co2_ppm} ppm
        </span>
      )}
    </div>
  )
}

export default function ZoneCard({ zone }) {
  const cardRef  = useRef(null)
  const prevCount = useRef(zone.current_count)
  const st        = STATUS[zone.status] ?? STATUS.low
  const entityBadge = ENTITY_BADGE[zone.entity_type]

  useEffect(() => {
    if (prevCount.current !== zone.current_count && cardRef.current) {
      cardRef.current.classList.add('value-update')
      setTimeout(() => cardRef.current?.classList.remove('value-update'), 400)
    }
    prevCount.current = zone.current_count
  }, [zone.current_count])

  return (
    <div ref={cardRef} className="card flex flex-col gap-3 hover:shadow-md transition-shadow duration-200">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <span className="text-navy-800 mt-0.5 shrink-0">{ZONE_ICON[zone.zone_type]}</span>
          <div className="min-w-0">
            <p className="font-semibold text-navy-800 text-sm leading-snug truncate" title={zone.name}>{zone.name}</p>
            <p className="text-[10px] text-slate-400 truncate">
              {zone.building}{zone.floor > 0 ? ` · Piso ${zone.floor}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${st.badge} ${zone.status==='full'?'animate-pulse':''}`}>
            {st.label}
          </span>
          {entityBadge && (
            <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full ${entityBadge.cls}`}>
              {entityBadge.label}
            </span>
          )}
        </div>
      </div>

      {/* Gauge + contagem */}
      <div className="flex items-center gap-3">
        <CircularGauge percent={zone.occupancy_percent} status={zone.status}/>
        <div className="flex-1">
          <p className="text-3xl font-bold text-navy-800 leading-none">{zone.current_count}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">de {zone.capacity} {zone.entity_label ?? 'pessoas'}</p>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-full mt-2">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width:`${Math.min(zone.occupancy_percent,100)}%`, backgroundColor:st.color }}/>
          </div>
          <EnvBadge zone={zone}/>
        </div>
      </div>

      {/* Alertas ambientais */}
      {zone.env_alerts?.length > 0 && (
        <div className="text-[9px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1 leading-snug">
          ⚠️ {zone.env_alerts[0]}
        </div>
      )}

      {zone.last_updated && (
        <p className="text-[9px] text-slate-300 text-right mt-auto">
          {new Date(zone.last_updated + 'Z').toLocaleTimeString('pt-AO')}
        </p>
      )}
    </div>
  )
}
