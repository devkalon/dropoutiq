import clsx from 'clsx'
import { AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react'

const CONFIG = {
  Critical: {
    classes: 'bg-danger-dim text-danger border border-danger/30',
    Icon: AlertCircle,
  },
  High: {
    classes: 'bg-warn-dim text-warn border border-warn/30',
    Icon: AlertTriangle,
  },
  Medium: {
    classes: 'bg-yellow-900/30 text-yellow-400 border border-yellow-400/20',
    Icon: Info,
  },
  Low: {
    classes: 'bg-safe-dim text-safe border border-safe/30',
    Icon: CheckCircle,
  },
}

export default function RiskBadge({ level }) {
  const cfg = CONFIG[level] || CONFIG.Low
  const Icon = cfg.Icon
  return (
    <span className={clsx('risk-badge', cfg.classes)}>
      <Icon size={12} />
      {level}
    </span>
  )
}