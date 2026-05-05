import { useEffect } from 'react'
import { X, AlertTriangle, AlertOctagon, Info } from 'lucide-react'

const SEVERITY_STYLE = {
  danger:  { bg: 'bg-red-50 border-red-300',    icon: <AlertOctagon size={16} className="text-red-600 shrink-0" />,    text: 'text-red-800' },
  warning: { bg: 'bg-amber-50 border-amber-300', icon: <AlertTriangle size={16} className="text-amber-600 shrink-0" />, text: 'text-amber-800' },
  info:    { bg: 'bg-blue-50 border-blue-300',   icon: <Info size={16} className="text-blue-600 shrink-0" />,           text: 'text-blue-800' },
}

function Alert({ alert, onDismiss }) {
  const style = SEVERITY_STYLE[alert.severity] || SEVERITY_STYLE.info
  const time  = new Date(alert.timestamp).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  // Auto-dismiss alertas de aviso após 12 s
  useEffect(() => {
    if (alert.severity !== 'danger') {
      const id = setTimeout(() => onDismiss(alert.id), 12000)
      return () => clearTimeout(id)
    }
  }, [alert.id, alert.severity, onDismiss])

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${style.bg} ${style.text} animate-[fadeIn_0.3s_ease]`}>
      {style.icon}
      <span className="flex-1">{alert.message}</span>
      <span className="shrink-0 text-xs opacity-60 mt-0.5">{time}</span>
      <button
        onClick={() => onDismiss(alert.id)}
        className="shrink-0 opacity-50 hover:opacity-100 transition-opacity ml-1"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export default function AlertBanner({ alerts, onDismiss }) {
  if (!alerts || alerts.length === 0) return null

  return (
    <div className="flex flex-col gap-2 mb-5">
      {alerts.map(a => (
        <Alert key={a.id} alert={a} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
