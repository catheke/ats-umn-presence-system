/**
 * Painel de Actuadores — ATS-UMN Presence System
 * Visualiza comandos enviados aos actuadores IoT de cada zona.
 * Em hardware real: ESP32 recebe via MQTT e acciona LED/buzzer/AC/porta.
 */
import { useState, useEffect, useCallback } from 'react'
import { Zap, Send, RefreshCw, Lightbulb, Wind, DoorOpen, Volume2, Cpu } from 'lucide-react'

const ACTUATOR_META = {
  led:          { icon: <Lightbulb size={14}/>, label: 'LED Indicador',    unit: '' },
  buzzer:       { icon: <Volume2 size={14}/>,   label: 'Buzzer',           unit: '' },
  relay_ac:     { icon: <Wind size={14}/>,      label: 'Ar Condicionado',  unit: '' },
  relay_light:  { icon: <Lightbulb size={14}/>, label: 'Iluminação',       unit: '' },
  door_lock:    { icon: <DoorOpen size={14}/>,  label: 'Porta Electrónica',unit: '' },
  ventilation:  { icon: <Wind size={14}/>,      label: 'Ventilação',       unit: '' },
}

const CMD_COLOR = {
  red:    'bg-red-100 text-red-700',    green:  'bg-emerald-100 text-emerald-700',
  yellow: 'bg-amber-100 text-amber-700',blue:   'bg-blue-100 text-blue-700',
  on:     'bg-emerald-100 text-emerald-700', off: 'bg-slate-100 text-slate-500',
  beep:   'bg-orange-100 text-orange-700',  alarm: 'bg-red-100 text-red-700',
  lock:   'bg-red-100 text-red-700',    unlock: 'bg-emerald-100 text-emerald-700',
}

const ZONES_LIST = [
  'cafeteria','sala_14','sala_15','sala_21','sala_23',
  'lab_info_1','lab_info_2','biblioteca','auditorio','secretaria',
]

function CommandBadge({ cmd }) {
  const cls = CMD_COLOR[cmd] ?? 'bg-slate-100 text-slate-600'
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{cmd}</span>
}

function ZoneActuatorCard({ zoneId, zoneName }) {
  const [state, setState] = useState({})

  const fetch = useCallback(async () => {
    try {
      const r = await window.fetch(`/api/actuators/state/${zoneId}`)
      setState(await r.json())
    } catch { /* silent */ }
  }, [zoneId])

  useEffect(() => { fetch(); const id = setInterval(fetch, 5000); return () => clearInterval(id) }, [fetch])

  const actuators = Object.entries(state)
  if (!actuators.length) return null

  return (
    <div className="card border border-slate-100">
      <p className="font-semibold text-navy-800 text-sm mb-3 truncate">{zoneName}</p>
      <div className="flex flex-wrap gap-2">
        {actuators.map(([act, cmd]) => {
          const meta = ACTUATOR_META[act] ?? { icon: <Cpu size={12}/>, label: act }
          return (
            <div key={act} className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
              <span className="text-slate-500">{meta.icon}</span>
              <span className="text-[10px] text-slate-500">{meta.label}</span>
              <CommandBadge cmd={cmd}/>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CommandLog({ log }) {
  if (!log.length) return <p className="text-xs text-slate-400 text-center py-8">Sem comandos ainda.</p>
  return (
    <div className="flex flex-col divide-y divide-slate-50 max-h-96 overflow-y-auto scrollbar-thin">
      {log.map((cmd, i) => {
        const meta = ACTUATOR_META[cmd.actuator] ?? { icon: <Zap size={12}/>, label: cmd.actuator }
        return (
          <div key={i} className="flex items-start gap-3 py-2.5 text-xs">
            <span className="text-slate-400 shrink-0 mt-0.5">{meta.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-slate-700">{cmd.zone_id}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500">{meta.label}</span>
                <CommandBadge cmd={cmd.command}/>
              </div>
              {cmd.reason && <p className="text-slate-400 text-[10px] mt-0.5 truncate">{cmd.reason}</p>}
            </div>
            <span className="text-[9px] text-slate-300 shrink-0">
              {new Date(cmd.timestamp + 'Z').toLocaleTimeString('pt-AO')}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function ManualCommand() {
  const [zoneId,   setZoneId]   = useState('sala_14')
  const [actuator, setActuator] = useState('led')
  const [command,  setCommand]  = useState('green')
  const [sending,  setSending]  = useState(false)
  const [result,   setResult]   = useState(null)

  const send = async () => {
    setSending(true); setResult(null)
    try {
      const r = await fetch('/api/actuators/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_id: zoneId, actuator, command, reason: 'Comando manual via dashboard' }),
      })
      const d = await r.json()
      setResult(d.status === 'ok' ? '✅ Comando enviado!' : '❌ Erro ao enviar')
    } catch { setResult('❌ Sem ligação ao servidor') }
    finally { setSending(false); setTimeout(() => setResult(null), 4000) }
  }

  return (
    <div className="card border border-blue-100 bg-blue-50/40">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Send size={13}/> Comando Manual
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <div>
          <label className="text-[10px] text-slate-500 mb-1 block">Zona</label>
          <select value={zoneId} onChange={e => setZoneId(e.target.value)}
            className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
            {ZONES_LIST.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 mb-1 block">Actuador</label>
          <select value={actuator} onChange={e => setActuator(e.target.value)}
            className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
            {Object.entries(ACTUATOR_META).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 mb-1 block">Comando</label>
          <input value={command} onChange={e => setCommand(e.target.value)}
            className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
            placeholder="on / off / red / green…"/>
        </div>
        <div className="flex items-end">
          <button onClick={send} disabled={sending}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-medium bg-navy-800 text-white px-3 py-1.5 rounded-lg hover:bg-navy-900 disabled:opacity-50 transition-colors">
            <Send size={12}/>{sending ? 'A enviar…' : 'Enviar'}
          </button>
        </div>
      </div>
      {result && <p className="text-xs text-center font-medium text-slate-700 mt-1">{result}</p>}
      <p className="text-[10px] text-slate-400 mt-2">
        Em hardware real: publicado em <code className="bg-white px-1 rounded">campus/IPH/{'<zona>'}/actuator/{'<actuador>'}</code> via MQTT
      </p>
    </div>
  )
}

export default function ActuatorsPanel() {
  const [log,     setLog]     = useState([])
  const [loading, setLoading] = useState(true)

  const fetchLog = useCallback(async () => {
    try {
      const r = await fetch('/api/actuators/log')
      setLog(await r.json())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchLog()
    const id = setInterval(fetchLog, 5000)
    return () => clearInterval(id)
  }, [fetchLog])

  const ZONE_NAMES = {
    cafeteria:'Refeitório', sala_14:'Sala 1.4', sala_15:'Sala 1.5',
    sala_21:'Sala 2.1', sala_23:'Sala 2.3', lab_info_1:'Lab Info I',
    lab_info_2:'Lab Info II', biblioteca:'Biblioteca', auditorio:'Auditório', secretaria:'Secretaria',
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy-800">Actuadores IoT</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            LED · Buzzer · Ar Condicionado · Iluminação · Ventilação · Porta Electrónica
          </p>
        </div>
        <button onClick={fetchLog} className="flex items-center gap-1.5 text-xs text-navy-700 hover:text-navy-900">
          <RefreshCw size={12}/> Actualizar
        </button>
      </div>

      {/* Legenda de actuadores */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {Object.entries(ACTUATOR_META).map(([key, meta]) => (
          <div key={key} className="card py-2.5 px-3 flex items-center gap-2 border border-slate-100">
            <span className="text-navy-700">{meta.icon}</span>
            <span className="text-[10px] text-slate-600 font-medium">{meta.label}</span>
          </div>
        ))}
      </div>

      {/* Estado actual por zona */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Estado Actual por Zona</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ZONES_LIST.map(id => (
            <ZoneActuatorCard key={id} zoneId={id} zoneName={ZONE_NAMES[id] ?? id}/>
          ))}
        </div>
      </div>

      {/* Comando manual */}
      <ManualCommand/>

      {/* Log de comandos */}
      <div className="card">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Zap size={13}/> Log de Comandos ({log.length} registos)
        </p>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-400 gap-2 text-sm">
            <RefreshCw size={14} className="animate-spin"/> A carregar…
          </div>
        ) : <CommandLog log={log}/>}
      </div>

      {/* Nota sobre MQTT */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 text-xs text-blue-800">
        <p className="font-bold mb-1">🔌 Integração com Hardware Real (ESP32)</p>
        <p className="text-blue-600">
          Cada comando é publicado no tópico MQTT correspondente. O ESP32 subscreve
          <code className="bg-white mx-1 px-1 rounded">campus/IPH/&lt;zona&gt;/actuator/&lt;tipo&gt;</code>
          e acciona o componente físico (LED RGB, buzzer, relay de AC, electroímã da porta).
          O firmware completo está em <code className="bg-white mx-1 px-1 rounded">firmware/esp32_sensor/esp32_sensor.ino</code>.
        </p>
      </div>

      <p className="text-[10px] text-slate-300 text-center border-t border-slate-100 pt-3">
        Actuadores IoT · MQTT 3.1.1 · ATS-UMN Presence System v2.0 · IPH/UMN · Lubango, Angola
      </p>
    </div>
  )
}
