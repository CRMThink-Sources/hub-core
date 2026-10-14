import Image from 'next/image'
import type {
  ScreenFrame as LpScreenFrame,
  TutorialView as LpTutorialView,
} from '../../../../_shared/frame'
import { APP_MENU_IDS, type AppMenuId } from '../../content'
import { useLpContent } from '../../content/locale-context'

export {
  DialogOver,
  FakeField,
  FakeSelect,
  FakeToggle,
  Hotspot,
  HOTSPOT_RING,
  HotspotButton,
  OutlineButton,
  PingDot,
  PrimaryButton,
  SkeletonCard,
  type Screen,
  type ScreenProps,
} from '../../../../_shared/frame'

export type ScreenFrame = LpScreenFrame<AppMenuId>

export type TutorialView<ScreenId extends string = string> = LpTutorialView<
  ScreenId,
  AppMenuId
>

export const APP_PATH = 'marketplace/app/thinkzap/'

const FLAGS = ['br', 'us', 'es'] as const

// Menor que no app (256px fixos) para dividir a janela com a tela.
export function AppAside({ active }: { active: AppMenuId }) {
  const { appMenu, poweredBy, beta } = useLpContent().frame

  return (
    <aside
      aria-hidden
      className="hidden w-48 shrink-0 flex-col border-r border-[#e5e7eb] bg-[#F9F9FB] px-3 pt-3 md:flex"
    >
      <div className="flex flex-col items-center gap-2 px-4 pb-4 pt-2">
        <Image
          src="/images/thinkzap/logo-aside.svg"
          alt=""
          width={120}
          height={34}
          className="h-auto w-full"
        />
        <span className="text-[9px] font-medium leading-none text-[#6b7280]">
          {poweredBy}
        </span>
        <span className="flex gap-1.5">
          {FLAGS.map(code => (
            <Image
              key={code}
              src={`/images/i18n-icon/4x3/${code}.svg`}
              alt=""
              width={16}
              height={16}
              className="size-4 rounded-xs"
            />
          ))}
        </span>
      </div>
      <nav className="mt-2 flex flex-1 flex-col gap-1 text-[11px] text-black">
        {APP_MENU_IDS.map(item => (
          <span
            key={item}
            className={`rounded-lg px-2.5 py-2 ${item === active ? 'bg-[#d9fce6] font-bold' : ''}`}
          >
            {appMenu[item]}
          </span>
        ))}
      </nav>
      <div className="flex justify-center py-3">
        <span className="rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-[#3b82f6]">
          {beta}
        </span>
      </div>
    </aside>
  )
}
