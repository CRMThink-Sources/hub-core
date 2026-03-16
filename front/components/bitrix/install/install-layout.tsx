import { type ReactNode } from "react";

const SCREEN_CLASS =
  "min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40";

const CARD_CLASS =
  "w-full max-w-md rounded-2xl bg-white/90 backdrop-blur-sm shadow-xl shadow-slate-200/50 border border-slate-200/80 overflow-hidden";

interface InstallLayoutProps {
  children: ReactNode;
}

/** Wrapper de tela cheia para as views da instalação Bitrix24 */
export function InstallLayout({ children }: InstallLayoutProps) {
  return <div className={SCREEN_CLASS}>{children}</div>;
}

/** Card padrão da instalação (pode ser usado com ou sem header) */
export function InstallCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`${CARD_CLASS} ${className}`.trim()}>{children}</div>;
}

export { SCREEN_CLASS, CARD_CLASS };
