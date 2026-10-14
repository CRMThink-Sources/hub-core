// `bg-background`/`text-foreground` ficam aqui: os tokens do tema só resolvem dentro dele.
export default function ClicksignLpLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="theme-clicksign min-h-screen bg-background text-foreground">
      {children}
    </div>
  )
}
