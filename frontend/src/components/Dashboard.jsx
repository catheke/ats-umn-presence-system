import { useState } from 'react'
import { LayoutDashboard, GraduationCap, Leaf, BarChart2, Layers, Zap } from 'lucide-react'
import Header          from './Header'
import AlertBanner     from './AlertBanner'
import ZoneCard        from './ZoneCard'
import CampusMap       from './CampusMap'
import OccupancyChart  from './OccupancyChart'
import StudentPortal   from './StudentPortal'
import EnvironmentPanel from './EnvironmentPanel'
import AnalyticsPanel  from './AnalyticsPanel'
import MultiEntityPanel from './MultiEntityPanel'
import ActuatorsPanel  from './ActuatorsPanel'

const ZONE_ORDER = [
  'cafeteria','biblioteca','auditorio',
  'sala_14','sala_15','sala_21','sala_23',
  'lab_info_1','lab_info_2','secretaria',
]

const TABS = [
  { id:'admin',     label:'Painel Geral',        icon:<LayoutDashboard size={14}/> },
  { id:'student',   label:'Portal do Estudante',  icon:<GraduationCap size={14}/>,  badge:'★' },
  { id:'entities',  label:'Multi-Entidade',       icon:<Layers size={14}/> },
  { id:'env',       label:'Ambiente',             icon:<Leaf size={14}/> },
  { id:'actuators', label:'Actuadores',           icon:<Zap size={14}/> },
  { id:'analytics', label:'Analytics',            icon:<BarChart2 size={14}/> },
]

export default function Dashboard({ zones, alerts, stats, connected, onDismissAlert }) {
  const [activeTab, setActiveTab] = useState('admin')
  const sortedZones = ZONE_ORDER.filter(id => zones[id]).map(id => zones[id])

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header connected={connected} stats={stats}/>

      {/* Navegação */}
      <div className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6">
          <nav className="flex gap-0.5 pt-2 overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl border-b-2
                  transition-all duration-150 whitespace-nowrap shrink-0
                  ${activeTab === tab.id
                    ? 'border-navy-800 text-navy-800 bg-blue-50/60'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-6 py-6">
        <AlertBanner alerts={alerts} onDismiss={onDismissAlert}/>

        {activeTab === 'student'   && <StudentPortal zones={zones}/>}
        {activeTab === 'entities'  && <MultiEntityPanel/>}
        {activeTab === 'env'       && <EnvironmentPanel/>}
        {activeTab === 'actuators' && <ActuatorsPanel/>}
        {activeTab === 'analytics' && <AnalyticsPanel/>}
        {activeTab === 'admin'     && (
          sortedZones.length === 0
            ? <NoData connected={connected}/>
            : <div className="flex flex-col gap-6">
                <CampusMap zones={zones}/>
                <section>
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                    Zonas Monitorizadas — {sortedZones.length} activas
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {sortedZones.map(z => <ZoneCard key={z.id} zone={z}/>)}
                  </div>
                </section>
                <OccupancyChart zones={zones}/>
                <footer className="text-center text-xs text-slate-400 py-4 border-t border-slate-100">
                  <p className="font-semibold text-slate-500">ATS-UMN Presence System v2.0</p>
                  <p>Instituto Politécnico da Huíla · Universidade Mandume ya Ndemufayo · Lubango, Angola</p>
                  <p className="mt-1">Pessoas · Veículos · Animais · Equipamentos · Ambiente · Actuadores · Supabase</p>
                </footer>
              </div>
        )}
      </main>
    </div>
  )
}

function NoData({ connected }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-6xl mb-4">📡</div>
      <h2 className="text-xl font-bold text-navy-800 mb-2">
        {connected ? 'A aguardar dados dos sensores…' : 'A ligar ao servidor…'}
      </h2>
      <p className="text-slate-400 text-sm max-w-sm">
        {connected
          ? 'O dashboard actualiza automaticamente quando o simulador enviar leituras.'
          : 'Verifique se o backend está activo em localhost:8000.'}
      </p>
    </div>
  )
}
