/**
 * Painel Multi-Entidade — Veículos, Animais e Equipamentos
 * Monitorização além de pessoas: o sistema detecta tudo no campus.
 */
import { useState, useEffect, useCallback } from 'react'
import { Car, PawPrint, Monitor, RefreshCw, ShieldAlert, CheckCircle } from 'lucide-react'

function OBar({ pct, color }) {
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-full mt-1.5">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(pct,100)}%`, background: color }}/>
    </div>
  )
}

// ── Veículos ────────────────────────────────────────────────────────────

function ParkingSection({ data }) {
  if (!data) return null
  const { zones, free_spots, total_spots, occupancy_percent } = data
  const pctColor = occupancy_percent >= 90 ? '#ef4444' : occupancy_percent >= 65 ? '#f59e0b' : '#22c55e'

  return (
    <section>
      <h3 className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
        <Car size={14} className="text-navy-700"/> Parques de Estacionamento
      </h3>

      <div className="card mb-3">
        <div className="flex items-center justify-between mb-2">
          <p className="font-bold text-navy-800">Disponibilidade Geral</p>
          <span className="text-2xl font-bold" style={{ color: pctColor }}>{free_spots}
            <span className="text-base font-normal text-slate-400"> vagas livres</span>
          </span>
        </div>
        <OBar pct={occupancy_percent} color={pctColor}/>
        <p className="text-[10px] text-slate-400 mt-1">{total_spots - free_spots}/{total_spots} lugares ocupados · {occupancy_percent.toFixed(0)}% cheio</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {zones.map(z => {
          const free  = z.capacity - z.current_count
          const color = z.occupancy_percent >= 90 ? '#ef4444' : z.occupancy_percent >= 65 ? '#f59e0b' : '#22c55e'
          return (
            <div key={z.id} className="card border border-slate-100 flex gap-4 items-center py-3 px-4">
              <div className="text-3xl">🅿️</div>
              <div className="flex-1">
                <p className="font-semibold text-slate-800 text-sm">{z.name}</p>
                <p className="text-xs mt-0.5" style={{ color }}>
                  <strong>{free}</strong> vagas livres de {z.capacity}
                </p>
                <OBar pct={z.occupancy_percent} color={color}/>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold" style={{ color }}>{z.occupancy_percent.toFixed(0)}%</p>
                <p className="text-[9px] text-slate-400">{z.current_count} veículos</p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── Animais ─────────────────────────────────────────────────────────────

const SAFETY = {
  clear:   { bg:'bg-emerald-50 border-emerald-200', icon:<CheckCircle size={16} className="text-emerald-500"/>, label:'Exterior Seguro',  text:'text-emerald-700' },
  monitor: { bg:'bg-amber-50 border-amber-200',     icon:<ShieldAlert size={16} className="text-amber-500"/>,  label:'Monitorizar',    text:'text-amber-700'   },
  caution: { bg:'bg-red-50 border-red-200',         icon:<ShieldAlert size={16} className="text-red-500"/>,    label:'Atenção',        text:'text-red-700'     },
}

function AnimalSection({ data }) {
  if (!data) return null
  const { zones, total_detected, recent_incidents, safety_status } = data
  const st = SAFETY[safety_status] ?? SAFETY.monitor

  return (
    <section>
      <h3 className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
        <PawPrint size={14} className="text-navy-700"/> Presença de Animais — Exterior do Campus
      </h3>

      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border mb-3 ${st.bg}`}>
        {st.icon}
        <div>
          <p className={`font-bold text-sm ${st.text}`}>{st.label} — {total_detected} animal(ais) detectado(s)</p>
          <p className="text-[10px] text-slate-500">Sensores PIR instalados no exterior monitorizam presença de animais 24h/7</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {zones.map(z => (
          <div key={z.id} className={`card border flex gap-3 items-center py-3 px-4 ${z.current_count > 3 ? 'border-amber-200 bg-amber-50' : 'border-slate-100'}`}>
            <span className="text-2xl shrink-0">{z.current_count > 3 ? '🐕' : z.current_count > 0 ? '🐈' : '✅'}</span>
            <div className="flex-1">
              <p className="font-semibold text-sm text-slate-800">{z.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {z.current_count === 0
                  ? 'Nenhum animal detectado'
                  : <><strong className="text-amber-600">{z.current_count}</strong> {z.entity_label}</>}
              </p>
              <OBar pct={z.occupancy_percent} color={z.current_count > 3 ? '#f59e0b' : '#22c55e'}/>
            </div>
          </div>
        ))}
      </div>

      {recent_incidents?.length > 0 && (
        <div className="card border border-slate-100">
          <p className="text-xs font-bold text-slate-400 mb-3">Registo de Incidentes Recentes</p>
          <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto scrollbar-thin">
            {recent_incidents.map(inc => (
              <div key={inc.id} className="flex items-start gap-2 text-xs text-slate-600 border-b border-slate-50 pb-1.5">
                <span className="shrink-0 text-amber-500 mt-0.5">🐾</span>
                <div>
                  <p>{inc.message}</p>
                  <p className="text-[9px] text-slate-300">{new Date(inc.timestamp+'Z').toLocaleString('pt-AO')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-400 mt-2 italic">
        ℹ️ Campus universitários em Angola frequentemente têm animais vadios. Este sistema ajuda a gerir a sua presença para a segurança dos estudantes.
      </p>
    </section>
  )
}

// ── Equipamentos ─────────────────────────────────────────────────────────

function EquipmentSection({ data }) {
  if (!data) return null
  const { zones, total_active, total_capacity } = data
  const pct = total_capacity ? Math.round(total_active / total_capacity * 100) : 0
  const color = pct >= 75 ? '#22c55e' : pct >= 40 ? '#3b82f6' : '#94a3b8'

  return (
    <section>
      <h3 className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
        <Monitor size={14} className="text-navy-700"/> Equipamentos Activos — Laboratórios
      </h3>

      <div className="card mb-3">
        <div className="flex items-center justify-between mb-1">
          <p className="font-bold text-navy-800">Computadores ligados</p>
          <p className="text-2xl font-bold" style={{ color }}>{total_active}
            <span className="text-sm font-normal text-slate-400">/{total_capacity}</span>
          </p>
        </div>
        <OBar pct={pct} color={color}/>
        <p className="text-[10px] text-slate-400 mt-1">{pct}% dos computadores activos · Útil para gestão energética</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {zones.map(z => {
          const zpct  = z.occupancy_percent
          const zcolor = zpct >= 70 ? '#22c55e' : zpct >= 30 ? '#3b82f6' : '#94a3b8'
          return (
            <div key={z.id} className="card border border-slate-100 flex gap-3 items-center py-3 px-4">
              <span className="text-2xl">🖥️</span>
              <div className="flex-1">
                <p className="font-semibold text-sm text-slate-800">{z.name}</p>
                <p className="text-xs mt-0.5" style={{ color: zcolor }}>
                  <strong>{z.current_count}</strong>/{z.capacity} computadores ligados
                </p>
                <OBar pct={zpct} color={zcolor}/>
              </div>
              <p className="text-base font-bold" style={{ color: zcolor }}>{zpct.toFixed(0)}%</p>
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-slate-400 mt-2">
        Sensor: contador de IPs activos na rede Wi-Fi do lab (SNMP/mDNS) ou sensor de consumo por tomada.
      </p>
    </section>
  )
}

// ── Painel principal ─────────────────────────────────────────────────────

export default function MultiEntityPanel() {
  const [vehicles,  setVehicles]  = useState(null)
  const [animals,   setAnimals]   = useState(null)
  const [equipment, setEquipment] = useState(null)
  const [loading,   setLoading]   = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [vR, aR, eR] = await Promise.all([
        fetch('/api/entities/vehicles'),
        fetch('/api/entities/animals'),
        fetch('/api/entities/equipment'),
      ])
      setVehicles(await vR.json())
      setAnimals(await aR.json())
      setEquipment(await eR.json())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 6000)
    return () => clearInterval(id)
  }, [fetchData])

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-slate-400 gap-2 text-sm">
      <RefreshCw size={16} className="animate-spin"/> A carregar dados multi-entidade…
    </div>
  )

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy-800">Presença Multi-Entidade</h2>
          <p className="text-xs text-slate-400 mt-0.5">Além de pessoas — veículos, animais e equipamentos também são monitorizados</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-1.5 text-xs text-navy-700 hover:text-navy-900">
          <RefreshCw size={12}/> Actualizar
        </button>
      </div>

      <ParkingSection  data={vehicles}/>
      <AnimalSection   data={animals}/>
      <EquipmentSection data={equipment}/>

      <p className="text-[10px] text-slate-300 text-center border-t border-slate-100 pt-3">
        Sistema de monitorização multi-entidade IoT · IPH/UMN · Lubango, Angola
      </p>
    </div>
  )
}
