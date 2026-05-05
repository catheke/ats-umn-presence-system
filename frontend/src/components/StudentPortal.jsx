/**
 * Portal do Estudante — ATS-UMN Presence System
 * Interface de apoio à decisão diária dos estudantes do IPH/UMN.
 * Resolve problemas reais: onde estudar, quando comer, fila da secretaria, labs livres.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  Coffee, BookOpen, Monitor, Briefcase, Clock,
  Users, MapPin, Zap, ChevronRight, RefreshCw,
  TrendingDown, Bell,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

const STATUS_DOT = { low: 'bg-emerald-400', medium: 'bg-amber-400', high: 'bg-red-500', full: 'bg-red-700' }
const STATUS_TEXT = { low: 'text-emerald-600', medium: 'text-amber-600', high: 'text-red-600', full: 'text-red-800' }
const STATUS_BG   = { low: 'bg-emerald-50 border-emerald-200', medium: 'bg-amber-50 border-amber-200', high: 'bg-red-50 border-red-200', full: 'bg-red-100 border-red-400' }
const FORECAST_COLOR = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444', full: '#991b1b' }

function OccupancyBar({ percent, status }) {
  const colors = { low: 'bg-emerald-400', medium: 'bg-amber-400', high: 'bg-red-500', full: 'bg-red-700 animate-pulse' }
  return (
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden w-full">
      <div
        className={`h-full rounded-full transition-all duration-700 ${colors[status] ?? colors.low}`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  )
}

function ScoreBadge({ score }) {
  const color = score >= 70 ? 'bg-emerald-100 text-emerald-700' : score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${color}`}>
      {score >= 70 ? '✓ Recomendado' : score >= 40 ? 'Razoável' : 'Ocupado'}
    </span>
  )
}


// ---------------------------------------------------------------------------
// Secção: Humor do campus
// ---------------------------------------------------------------------------

function CampusMoodBanner({ mood }) {
  if (!mood) return null
  const bg = {
    busy: 'bg-red-50 border-red-200', moderate: 'bg-amber-50 border-amber-200',
    quiet: 'bg-emerald-50 border-emerald-200', empty: 'bg-blue-50 border-blue-200',
  }[mood.level] ?? 'bg-slate-50 border-slate-200'

  return (
    <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl border ${bg}`}>
      <span className="text-3xl">{mood.emoji}</span>
      <div>
        <p className="font-bold text-slate-800 text-sm">{mood.label}</p>
        <p className="text-slate-500 text-xs">{mood.description}</p>
      </div>
    </div>
  )
}


// ---------------------------------------------------------------------------
// Secção: Recomendações inteligentes
// ---------------------------------------------------------------------------

const REC_STYLE = {
  urgent: 'bg-red-50 border-red-200',
  tip:    'bg-amber-50 border-amber-200',
  info:   'bg-blue-50 border-blue-200',
}

function Recommendations({ recs }) {
  if (!recs?.length) return null
  return (
    <div>
      <SectionTitle icon={<Zap size={15} />} title="Recomendações para si" />
      <div className="flex flex-col gap-2">
        {recs.map((r, i) => (
          <div key={i} className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${REC_STYLE[r.priority] ?? REC_STYLE.info}`}>
            <span className="text-xl shrink-0">{r.icon}</span>
            <div>
              <p className="font-semibold text-slate-800">{r.title}</p>
              <p className="text-slate-500 text-xs mt-0.5">{r.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


// ---------------------------------------------------------------------------
// Secção: Refeitório inteligente
// ---------------------------------------------------------------------------

function ForecastTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-md p-2.5 text-xs">
      <p className="font-bold text-slate-700">{label}</p>
      <p className="text-slate-500">~{d?.count} pessoas ({d?.percent}%)</p>
    </div>
  )
}

function CafeteriaWidget({ cafeteria, forecast }) {
  if (!cafeteria) return null
  const { current_count, capacity, occupancy_percent, status, queue_wait_minutes, suggestion } = cafeteria

  const nowHour = new Date().getHours() + new Date().getMinutes() / 60
  const nowLabel = `${String(new Date().getHours()).padStart(2,'0')}:${new Date().getMinutes() < 30 ? '00' : '30'}`

  return (
    <div>
      <SectionTitle icon={<Coffee size={15} />} title="Refeitório Central" />
      <div className="card flex flex-col gap-4">
        {/* Estado actual */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-3xl font-bold text-navy-800">{current_count}
              <span className="text-base font-normal text-slate-400">/{capacity}</span>
            </p>
            <p className="text-xs text-slate-400 mt-0.5">pessoas agora</p>
          </div>
          <div className="text-right">
            {queue_wait_minutes > 0 ? (
              <>
                <div className="flex items-center gap-1 justify-end text-amber-600">
                  <Clock size={14} />
                  <span className="font-bold text-lg">{queue_wait_minutes} min</span>
                </div>
                <p className="text-xs text-slate-400">fila estimada</p>
              </>
            ) : (
              <div className="flex items-center gap-1 justify-end text-emerald-600">
                <Clock size={14} />
                <span className="font-bold text-sm">Sem fila</span>
              </div>
            )}
          </div>
        </div>

        <OccupancyBar percent={occupancy_percent} status={status} />

        <p className="text-xs text-slate-600 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
          💡 {suggestion}
        </p>

        {/* Previsão do dia */}
        {forecast?.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <TrendingDown size={11} /> Previsão de ocupação hoje
            </p>
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart data={forecast} margin={{ top: 0, right: 0, bottom: 0, left: -30 }}>
                <defs>
                  <linearGradient id="cafeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#94a3b8' }} interval={3} />
                <YAxis tick={{ fontSize: 8, fill: '#94a3b8' }} unit="%" domain={[0, 100]} />
                <Tooltip content={<ForecastTooltip />} />
                <ReferenceLine x={nowLabel} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3 2"
                  label={{ value: 'agora', fill: '#ef4444', fontSize: 8, position: 'top' }} />
                <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="2 2" strokeOpacity={0.4} />
                <Area type="monotone" dataKey="percent" stroke="#3b82f6" fill="url(#cafeGrad)"
                  strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-slate-300 text-center mt-1">Melhores horários: antes das 12h00 ou após as 14h00</p>
          </div>
        )}
      </div>
    </div>
  )
}


// ---------------------------------------------------------------------------
// Secção: Onde estudar
// ---------------------------------------------------------------------------

const TYPE_ICON = {
  library:   <BookOpen size={14} />,
  classroom: <MapPin size={14} />,
}
const TYPE_LABEL = {
  library:   'Biblioteca',
  classroom: 'Sala de aula',
}

function StudySpotFinder({ spots }) {
  if (!spots?.length) return null
  return (
    <div>
      <SectionTitle icon={<BookOpen size={15} />} title="Onde estudar agora?" />
      <div className="flex flex-col gap-2">
        {spots.map((s, i) => (
          <div key={s.id} className={`card flex items-start gap-3 py-3 px-4 border ${STATUS_BG[s.status] ?? 'bg-white border-slate-100'}`}>
            <div className={`flex items-center justify-center w-8 h-8 rounded-lg bg-white shrink-0 shadow-sm ${STATUS_TEXT[s.status]}`}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : TYPE_ICON[s.type]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="font-semibold text-slate-800 text-sm">{s.name}</p>
                <ScoreBadge score={s.score} />
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {TYPE_LABEL[s.type]} · <strong className={STATUS_TEXT[s.status]}>{s.free_seats} lugares livres</strong>
              </p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {s.tags?.map(t => (
                  <span key={t} className="text-[9px] bg-white border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full">{t}</span>
                ))}
              </div>
              <OccupancyBar percent={s.occupancy_percent} status={s.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


// ---------------------------------------------------------------------------
// Secção: Laboratórios
// ---------------------------------------------------------------------------

function LabsSection({ labs }) {
  if (!labs?.length) return null
  return (
    <div>
      <SectionTitle icon={<Monitor size={15} />} title="Laboratórios de Informática" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {labs.map(lab => (
          <div key={lab.id} className={`card border py-3 px-4 ${STATUS_BG[lab.status] ?? 'bg-white border-slate-100'}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-sm text-slate-800">{lab.name_short}</p>
              <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${lab.available ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${lab.available ? 'bg-emerald-500' : 'bg-red-500'}`} />
                {lab.available ? 'Disponível' : 'Ocupado'}
              </span>
            </div>
            <OccupancyBar percent={lab.occupancy_percent} status={lab.status} />
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="text-slate-400 flex items-center gap-1"><Users size={11} />{lab.free_seats} postos livres</span>
              <span className={`font-medium ${STATUS_TEXT[lab.status]}`}>{lab.occupancy_percent.toFixed(0)}%</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5 italic">{lab.suggestion}</p>
          </div>
        ))}
      </div>
    </div>
  )
}


// ---------------------------------------------------------------------------
// Secção: Secretaria
// ---------------------------------------------------------------------------

function SecretariaWidget({ secretaria }) {
  if (!secretaria) return null
  const { current_count, capacity, occupancy_percent, status, wait_minutes, is_open, schedule, suggestion } = secretaria

  return (
    <div>
      <SectionTitle icon={<Briefcase size={15} />} title="Secretaria Académica" />
      <div className={`card border flex gap-4 items-start ${STATUS_BG[is_open ? status : 'low'] ?? 'bg-white border-slate-100'}`}>
        <div className={`flex items-center justify-center w-12 h-12 rounded-xl shrink-0 text-xl ${is_open ? 'bg-white shadow-sm' : 'bg-slate-100'}`}>
          {is_open ? '📋' : '🔒'}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${is_open ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
              {is_open ? 'Aberta' : 'Encerrada'}
            </span>
            <span className="text-xs text-slate-400">{schedule}</span>
          </div>
          {is_open && (
            <>
              <p className="text-sm text-slate-700">
                <strong className={STATUS_TEXT[status]}>{current_count}</strong>/{capacity} pessoas ·{' '}
                {wait_minutes > 0
                  ? <span className="text-amber-600 font-medium">~{wait_minutes} min de espera</span>
                  : <span className="text-emerald-600 font-medium">Sem espera</span>
                }
              </p>
              <OccupancyBar percent={occupancy_percent} status={status} />
            </>
          )}
          <p className="text-xs text-slate-500 mt-2 italic">💡 {suggestion}</p>
        </div>
      </div>
    </div>
  )
}


// ---------------------------------------------------------------------------
// Componente utilitário: título de secção
// ---------------------------------------------------------------------------

function SectionTitle({ icon, title }) {
  return (
    <h3 className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
      <span className="text-navy-700">{icon}</span> {title}
    </h3>
  )
}


// ---------------------------------------------------------------------------
// Portal principal
// ---------------------------------------------------------------------------

export default function StudentPortal({ zones }) {
  const [data, setData]         = useState(null)
  const [forecast, setForecast] = useState([])
  const [loading, setLoading]   = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, forecastRes] = await Promise.all([
        fetch('/api/student/status'),
        fetch('/api/student/cafeteria-forecast'),
      ])
      setData(await statusRes.json())
      setForecast(await forecastRes.json())
      setLastUpdated(new Date())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchData()
    // Refrescar a cada 8 segundos para manter dados actuais
    const id = setInterval(fetchData, 8000)
    return () => clearInterval(id)
  }, [fetchData])

  // Re-fetch quando os dados das zonas mudam via WebSocket
  useEffect(() => {
    if (Object.keys(zones).length > 0) fetchData()
  }, [zones, fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 text-sm gap-3">
        <RefreshCw size={18} className="animate-spin" /> A carregar portal do estudante…
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-16 text-slate-400 text-sm">
        Não foi possível carregar os dados. Verifique a ligação ao servidor.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Cabeçalho do portal */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-navy-800">Portal do Estudante</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            IPH · Universidade Mandume ya Ndemufayo · Lubango, Angola
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          {lastUpdated && (
            <span>Actualizado às {lastUpdated.toLocaleTimeString('pt-AO', {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>
          )}
          <button onClick={fetchData} className="flex items-center gap-1 text-navy-700 hover:text-navy-900 transition-colors">
            <RefreshCw size={12} /> Actualizar
          </button>
        </div>
      </div>

      {/* Humor do campus */}
      <CampusMoodBanner mood={data.campus_mood} />

      {/* Recomendações */}
      <Recommendations recs={data.recommendations} />

      {/* Layout de 2 colunas em ecrãs maiores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-6">
          <CafeteriaWidget cafeteria={data.cafeteria} forecast={forecast} />
          <SecretariaWidget secretaria={data.secretaria} />
        </div>
        <div className="flex flex-col gap-6">
          <StudySpotFinder spots={data.study_spots} />
          <LabsSection labs={data.labs} />
        </div>
      </div>

      {/* Rodapé informativo */}
      <div className="text-center text-xs text-slate-300 py-2 border-t border-slate-100">
        <p>Dados actualizados em tempo real via sensores IoT · ATS-UMN Presence System</p>
        <p>Os tempos de espera são estimativas baseadas na ocupação actual</p>
      </div>

    </div>
  )
}
