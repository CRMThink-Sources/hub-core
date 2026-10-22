import { ChartColumnIncreasing } from 'lucide-react'
import { HUB_APP_IDS, HUB_APPS } from './apps'

const RADIUS = 38

// Os apps em volta do centro, como os nós do logo: o primeiro no topo, sentido horário.
const NODES = HUB_APP_IDS.map((id, index) => {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / HUB_APP_IDS.length
  return {
    app: HUB_APPS[id],
    x: 50 + RADIUS * Math.cos(angle),
    y: 50 + RADIUS * Math.sin(angle),
  }
})

export function HubDiagram({ label }: { label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="relative mx-auto aspect-square w-full max-w-md"
    >
      <div className="absolute inset-[12%] rounded-full bg-linear-to-br from-violet-500/15 via-sky-400/10 to-cyan-300/15 blur-2xl" />

      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 size-full"
        aria-hidden
      >
        <defs>
          <linearGradient id="hub-line" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          stroke="url(#hub-line)"
          strokeOpacity="0.25"
          strokeWidth="0.4"
          strokeDasharray="1.5 1.5"
        />
        {NODES.map(node => (
          <line
            key={node.app.id}
            x1="50"
            y1="50"
            x2={node.x}
            y2={node.y}
            stroke="url(#hub-line)"
            strokeWidth="0.6"
            strokeLinecap="round"
          />
        ))}
      </svg>

      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
        <div className="relative flex size-20 items-center justify-center rounded-full bg-linear-to-br from-violet-600 to-cyan-400 shadow-lg shadow-sky-500/30 sm:size-24">
          <span className="absolute inset-0 rounded-full bg-sky-400/30 motion-safe:animate-ping [animation-duration:3s]" />
          <ChartColumnIncreasing className="relative size-9 text-white sm:size-11" />
        </div>
        <span className="mt-2 rounded-full bg-background/90 px-2.5 py-0.5 text-xs font-semibold text-foreground shadow-sm">
          Bitrix24
        </span>
      </div>

      {NODES.map(({ app, x, y }) => (
        <div
          key={app.id}
          className={`${app.themeClass} absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center bg-transparent`}
          style={{ left: `${x}%`, top: `${y}%` }}
        >
          <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-card text-primary shadow-md sm:size-14">
            <app.Icon className="size-6 sm:size-7" />
          </div>
          <span className="mt-1.5 whitespace-nowrap text-[11px] font-semibold text-foreground sm:text-xs">
            {app.name}
          </span>
        </div>
      ))}
    </div>
  )
}
