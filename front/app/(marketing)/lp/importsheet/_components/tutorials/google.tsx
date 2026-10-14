import { Check } from 'lucide-react'
import type { GoogleScreen } from '../content'
import { useLpContent, useTutorialScreens } from '../content/locale-context'
import { ConfiguracoesPage, GoogleCard } from './shared/app-pages'
import {
  APP_PATH,
  DialogOver,
  Hotspot,
  OutlineButton,
  type ScreenFrame,
  type ScreenProps,
  type TutorialView,
} from './shared/frame'

const SETTINGS: ScreenFrame = {
  kind: 'app',
  path: `${APP_PATH}configuracoes`,
  menu: 'configuracoes',
}

export const GOOGLE_VIEW: TutorialView<GoogleScreen> = {
  frames: {
    settings: SETTINGS,
    consent: SETTINGS,
    connected: SETTINGS,
  },
  screens: {
    settings: SettingsScreen,
    consent: ConsentScreen,
    connected: ConnectedScreen,
  },
}

function SettingsScreen(props: ScreenProps) {
  return (
    <ConfiguracoesPage>
      <GoogleCard connected={false} hotspot={props} />
    </ConfiguracoesPage>
  )
}

function GoogleWordmark() {
  const letters: [string, string][] = [
    ['G', 'text-[#4285F4]'],
    ['o', 'text-[#EA4335]'],
    ['o', 'text-[#FBBC05]'],
    ['g', 'text-[#4285F4]'],
    ['l', 'text-[#34A853]'],
    ['e', 'text-[#EA4335]'],
  ]
  return (
    <span aria-hidden className="text-lg font-semibold tracking-tight">
      {letters.map(([letter, color], index) => (
        <span key={index} className={color}>
          {letter}
        </span>
      ))}
    </span>
  )
}

function ConsentScreen({ action, onAdvance }: ScreenProps) {
  const { consent } = useTutorialScreens('google')
  const { sample } = useLpContent().shared

  return (
    <DialogOver
      background={
        <ConfiguracoesPage>
          <GoogleCard connected={false} />
        </ConfiguracoesPage>
      }
    >
      <div className="flex items-center gap-2 border-b border-border pb-3 text-xs text-muted-foreground">
        <GoogleWordmark />
        <span>{consent.signIn}</span>
      </div>
      <p className="mt-4 text-base font-medium">{consent.heading}</p>
      <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-border px-2 py-0.5 text-xs">
        <span className="flex size-4 items-center justify-center rounded-full bg-primary/15 text-[9px] font-semibold text-primary">
          {sample.googleEmail[0].toUpperCase()}
        </span>
        {sample.googleEmail}
      </p>
      <p className="mt-4 text-sm">{consent.allow}</p>
      <ul className="mt-2 space-y-2">
        {consent.scopes.map(scope => (
          <li key={scope} className="flex gap-2 text-sm text-muted-foreground">
            <Check
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-[#4285F4]"
            />
            {scope}
          </li>
        ))}
      </ul>
      <div className="mt-5 flex justify-end gap-2">
        <OutlineButton>{consent.cancel}</OutlineButton>
        <Hotspot
          action={action}
          onAdvance={onAdvance}
          className="inline-flex h-9 items-center rounded-full bg-[#1a73e8] px-4 text-sm font-medium text-white"
        >
          {consent.proceed}
        </Hotspot>
      </div>
    </DialogOver>
  )
}

function ConnectedScreen(props: ScreenProps) {
  return (
    <ConfiguracoesPage successBanner>
      <GoogleCard connected hotspot={props} />
    </ConfiguracoesPage>
  )
}
