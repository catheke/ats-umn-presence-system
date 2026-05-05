import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ResponsiveContainer, PieChart, Pie, Legend,
} from 'recharts'
import { TrendingUp, Zap, Car, PawPrint, Monitor, RefreshCw, Award } from 'lucide-react'

const GRADE_STYLE = {
  A: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  B: 'bg-blue-100 text-blue-700 border-blue-200',
  C: 'bg-amber-100 text-amber-700 border-amber-200',
  D: 'bg-red-100 text-red-700 border-red-200',
}

const ENTITY_PIE_COLORS = ['#3b82f6', '#f59e0b', '#22c55e', '#a78bfa']

function StatCard({ icon, label, value, sub, accent = 'text-navy-800' }) {
  return (
    <div className="card flex items-center gap-4">
      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-navy-50 text-navy-700 shrink-0">{icon}</div>
      <div>
        <p className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</p>
        <p className={`text-2xl font-bold ${accent}`}>{value}</p>
        {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function UtilizationChart({ data }) {
  return (
    <div className="card">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
        Taxa de Utilização por Zona (% do tempo acima de 40%)
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 28, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
          <XAxis dataKey="name_short" tick={{ fontSize: 9, fill: '#94a3b8' }} angle={-30} textAnchor="end" height={50}/>
          <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} unit="%"/>
          <Tooltip
            formatter={(v, n, p) => [`${v}%`, 'Utilização']}
            labelFormatter={l => data.find(d => d.name_short === l)?.zone_name ?? l}
          />
          <Bar dataKey="utilization_rate" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {data.map((d, i) => (
              <Cell key={i} fill={
                d.utilization_rate >= 70 ? '#22c55e' :
                d.utilization_rate >= 50 ? '#3b82f6' :
                d.utilization_rate >= 30 ? '#f59e0b' : '#ef4444'
              }/>
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function EfficiencyTable({ data }) {
  return (
    <div className="card overflow-hidden">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
        Eficiência de Utilização — Classificação por Zona
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100">
              {['Zona','Tipo','Cap.','Méd. Ocup.','Pico','Utiliz.','Nota'].map(h => (
                <th key={h} className="text-left text-slate-400 font-medium pb-2 pr-4 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={d.zone_id} className={`border-b border-slate-50 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                <td className="py-2 pr-4 font-medium text-slate-700 whitespace-nowrap">{d.name_short}</td>
                <td className="pr-4 text-slate-400 capitalize">{d.zone_type}</td>
                <td className="pr-4 text-slate-600">{d.capacity}</td>
                <td className="pr-4 font-medium" style={{ color: d.avg_occupancy >= 40 ? '#22c55e' : '#f59e0b' }}>{d.avg_occupancy}%</td>
                <td className="pr-4 text-slate-600">{d.peak_occupancy}%</td>
                <td className="pr-4 font-bold" style={{ color: d.utilization_rate >= 50 ? '#22c55e' : '#ef4444' }}>{d.utilization_rate}%</td>
                <td>
                  <span className={`px-2 py-0.5 rounded-full border font-bold text-[10px] ${GRADE_STYLE[d.efficiency_grade]}`}>
                    {d.efficiency_grade}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-slate-300 mt-3">Nota A: &gt;70% do tempo utilizada · B: 50-70% · C: 30-50% · D: &lt;30%</p>
    </div>
  )
}

function EnergyPanel({ energy }) {
  if (!energy) return null
  const { wasted_zones, total_wasted_kw, daily_estimate_kwh, cost_estimate_aoa, recommendation } = energy
  return (
    <div className="card">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Zap size={13}/> Eficiência Energética
      </p>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-red-600">{total_wasted_kw} kW</p>
          <p className="text-[10px] text-red-400">desperdício actual</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-amber-600">{daily_estimate_kwh} kWh</p>
          <p className="text-[10px] text-amber-400">estimativa/dia</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-slate-700">{Number(cost_estimate_aoa).toLocaleString()} AOA</p>
          <p className="text-[10px] text-slate-400">custo diário est.</p>
        </div>
      </div>

      {wasted_zones.length > 0 && (
        <div className="mb-3">
          <p className="text-[11px] font-semibold text-slate-500 mb-2">Zonas a desperdiçar energia agora:</p>
          <div className="flex flex-wrap gap-1.5">
            {wasted_zones.map(z => (
              <span key={z.zone} className="flex items-center gap-1 text-[10px] bg-red-50 border border-red-200 text-red-600 px-2 py-1 rounded-lg">
                <Zap size={9}/> {z.zone} ({z.kw} kW)
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-start gap-2 text-xs text-slate-600 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
        <span className="text-blue-500 shrink-0">💡</span>
        {recommendation}
      </div>
    </div>
  )
}

function EntityPie({ overview }) {
  if (!overview) return null
  const data = [
    { name: 'Pessoas',     value: overview.zones_count?.people    ?? 0 },
    { name: 'Veículos',    value: overview.zones_count?.vehicles   ?? 0 },
    { name: 'Animais',     value: overview.zones_count?.animals    ?? 0 },
    { name: 'Equipamentos',value: overview.zones_count?.equipment  ?? 0 },
  ].filter(d => d.value > 0)

  return (
    <div className="card">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Entidades Monitoradas</p>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width={140} height={140}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={35} outerRadius={60}
              dataKey="value" paddingAngle={3}>
              {data.map((_, i) => <Cell key={i} fill={ENTITY_PIE_COLORS[i % ENTITY_PIE_COLORS.length]}/>)}
            </Pie>
            <Tooltip/>
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-col gap-2">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ENTITY_PIE_COLORS[i % ENTITY_PIE_COLORS.length] }}/>
              <span className="text-slate-600">{d.name}:</span>
              <span className="font-bold text-slate-800">{d.value} zonas</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function AnalyticsPanel() {
  const [util, setUtil]       = useState([])
  const [energy, setEnergy]   = useState(null)
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [uRes, eRes, oRes] = await Promise.all([
        fetch('/api/analytics/utilization'),
        fetch('/api/analytics/energy'),
        fetch('/api/analytics/overview'),
      ])
      setUtil(await uRes.json())
      setEnergy(await eRes.json())
      setOverview(await oRes.json())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 10000)
    return () => clearInterval(id)
  }, [fetchData])

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-slate-400 gap-2 text-sm">
      <RefreshCw size={16} className="animate-spin"/> A calcular analytics…
    </div>
  )

  const topZone = util[0]
  const lowZone = util[util.length - 1]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy-800">Analytics & Eficiência</h2>
          <p className="text-xs text-slate-400 mt-0.5">Utilização de espaços · Energia · Insights multi-entidade</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-1.5 text-xs text-navy-700 hover:text-navy-900">
          <RefreshCw size={12}/> Actualizar
        </button>
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<TrendingUp size={18}/>}  label="Utilização do campus"  value={`${overview?.campus_utilization ?? 0}%`}/>
        <StatCard icon={<Car size={18}/>}          label="Veículos no campus"    value={overview?.total_vehicles ?? 0}        sub="parques A e B"/>
        <StatCard icon={<PawPrint size={18}/>}     label="Animais detectados"    value={overview?.total_animals ?? 0}         sub="exterior do campus"/>
        <StatCard icon={<Monitor size={18}/>}      label="PCs activos nos labs"
          value={(overview?.zones_count ? '–' : '–')} sub="Lab I + Lab II"/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <EntityPie overview={overview}/>

        {/* Destaque — melhor e pior zona */}
        <div className="flex flex-col gap-3 col-span-1 lg:col-span-2">
          {topZone && (
            <div className="card border border-emerald-200 bg-emerald-50 flex items-center gap-4">
              <Award size={32} className="text-emerald-500 shrink-0"/>
              <div>
                <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Zona mais utilizada</p>
                <p className="font-bold text-navy-800">{topZone.zone_name}</p>
                <p className="text-xs text-emerald-700">Taxa: {topZone.utilization_rate}% · Pico: {topZone.peak_occupancy}% · Nota <strong>{topZone.efficiency_grade}</strong></p>
              </div>
            </div>
          )}
          {lowZone && lowZone.zone_id !== topZone?.zone_id && (
            <div className="card border border-red-200 bg-red-50 flex items-center gap-4">
              <TrendingUp size={32} className="text-red-400 shrink-0 rotate-180"/>
              <div>
                <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Zona menos utilizada</p>
                <p className="font-bold text-navy-800">{lowZone.zone_name}</p>
                <p className="text-xs text-red-600">Taxa: {lowZone.utilization_rate}% · Considerar redistribuição de horários</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <UtilizationChart data={util}/>
      <EnergyPanel energy={energy}/>
      <EfficiencyTable data={util}/>

      <p className="text-[10px] text-slate-300 text-center border-t border-slate-100 pt-3">
        Analytics calculados em tempo real com base no histórico de leituras IoT · ATS-UMN Presence System v2.0
      </p>
    </div>
  )
}
