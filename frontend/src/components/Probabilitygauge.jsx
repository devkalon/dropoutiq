import { useMemo } from 'react'

export default function ProbabilityGauge({ probability }) {
  const pct = Math.round(probability * 100)

  const color = useMemo(() => {
    if (pct >= 75) return { stroke: '#E05252', glow: '0 0 20px rgba(224,82,82,0.4)' }
    if (pct >= 55) return { stroke: '#E8A030', glow: '0 0 20px rgba(232,160,48,0.35)' }
    if (pct >= 35) return { stroke: '#E8D730', glow: '0 0 20px rgba(232,215,48,0.3)' }
    return { stroke: '#3DBE7A', glow: '0 0 20px rgba(61,190,122,0.35)' }
  }, [pct])

  // Arc math: 220° sweep
  const R = 72
  const cx = 96, cy = 96
  const startAngle = -200
  const sweepAngle = 220
  const endAngle = startAngle + sweepAngle * (pct / 100)

  const toRad = (deg) => (deg * Math.PI) / 180
  const arcPath = (start, end, r) => {
    const s = { x: cx + r * Math.cos(toRad(start)), y: cy + r * Math.sin(toRad(start)) }
    const e = { x: cx + r * Math.cos(toRad(end)),   y: cy + r * Math.sin(toRad(end)) }
    const large = end - start > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
  }

  return (
    <div className="flex flex-col items-center">
      <svg width="192" height="150" viewBox="0 0 192 150">
        {/* Track */}
        <path
          d={arcPath(-200, -200 + 220, R)}
          fill="none"
          stroke="#2E3350"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Fill */}
        {pct > 0 && (
          <path
            d={arcPath(-200, endAngle, R)}
            fill="none"
            stroke={color.stroke}
            strokeWidth="10"
            strokeLinecap="round"
            style={{ filter: color.glow, transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
        )}
        {/* Center text */}
        <text
          x={cx} y={cy - 4}
          textAnchor="middle"
          className="font-display"
          fill={color.stroke}
          fontSize="28"
          fontWeight="700"
          fontFamily="Syne"
        >
          {pct}%
        </text>
        <text
          x={cx} y={cy + 18}
          textAnchor="middle"
          fill="#8B93B0"
          fontSize="11"
          fontFamily="DM Sans"
        >
          Dropout Risk
        </text>
      </svg>
    </div>
  )
}