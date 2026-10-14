import { CheckCircle2Icon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NovaImportacaoScreen } from '../content'
import { useLpContent, useTutorialScreens } from '../content/locale-context'
import { EmptyImports, ImportacoesPage } from './shared/app-pages'
import {
  APP_PATH,
  DialogOver,
  Hotspot,
  HotspotButton,
  OutlineButton,
  PrimaryButton,
  type ScreenFrame,
  type ScreenProps,
  type TutorialView,
} from './shared/frame'

const APP: ScreenFrame = {
  kind: 'app',
  path: `${APP_PATH}importacoes`,
  menu: 'importacoes',
}

export const NOVA_IMPORTACAO_VIEW: TutorialView<NovaImportacaoScreen> = {
  frames: { empty: APP, paste: APP, tabs: APP, selected: APP },
  screens: {
    empty: EmptyScreen,
    paste: PasteScreen,
    tabs: TabsScreen,
    selected: SelectedScreen,
  },
}

function EmptyScreen(props: ScreenProps) {
  return (
    <ImportacoesPage newImport={props}>
      <EmptyImports />
    </ImportacoesPage>
  )
}

function NewImportModal({
  validate,
  tabs,
  proceed,
}: {
  validate?: ScreenProps
  tabs?: { selected: boolean; hotspot?: ScreenProps }
  proceed?: ScreenProps
}) {
  const {
    modal,
    pastedUrl,
    tabs: sheetTabs,
  } = useTutorialScreens('nova-importacao')
  const { sample } = useLpContent().shared
  const validateClass =
    'inline-flex h-9 shrink-0 items-center rounded-md border border-border bg-background px-2.5 text-sm font-medium'

  return (
    <DialogOver
      background={
        <ImportacoesPage>
          <EmptyImports />
        </ImportacoesPage>
      }
    >
      <p className="text-base font-medium">{modal.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{modal.description}</p>

      <div className="mt-4 flex flex-col gap-2">
        <p className="text-sm font-medium">{modal.idLabel}</p>
        <div className="flex gap-2">
          <p className="flex h-9 min-w-0 flex-1 items-center truncate rounded-md border border-input px-2.5 text-sm">
            {pastedUrl}
          </p>
          {validate ? (
            <Hotspot {...validate} className={validateClass}>
              {modal.validate}
            </Hotspot>
          ) : (
            <span className={validateClass}>{modal.validate}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {modal.urlHint} docs.google.com/spreadsheets/d/
          <span className="rounded bg-primary/10 px-1 font-mono font-bold text-primary">
            ID
          </span>
          /edit
        </p>
      </div>

      {tabs && (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2Icon aria-hidden className="size-4" />
            {sample.spreadsheetName}
          </p>
          <p className="text-sm font-medium">{modal.selectTab}</p>
          <ul className="flex flex-col gap-1.5">
            {sheetTabs.map((tab, index) => {
              const selected = index === 0 && tabs.selected
              const shape = cn(
                'w-full rounded-lg border px-3 py-2 text-left',
                selected ? 'border-primary bg-accent' : 'border-border',
              )
              const content = (
                <>
                  <span className="block truncate text-sm">{tab.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {modal.rowsCols(tab.rows, tab.cols)}
                  </span>
                </>
              )
              return (
                <li key={tab.title}>
                  {index === 0 && tabs.hotspot ? (
                    <Hotspot {...tabs.hotspot} className={shape}>
                      {content}
                    </Hotspot>
                  ) : (
                    <span className={cn('block', shape)}>{content}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <OutlineButton>{modal.cancel}</OutlineButton>
        {proceed ? (
          <HotspotButton {...proceed}>{modal.proceed}</HotspotButton>
        ) : (
          <PrimaryButton className="opacity-50">{modal.proceed}</PrimaryButton>
        )}
      </div>
    </DialogOver>
  )
}

function PasteScreen(props: ScreenProps) {
  return <NewImportModal validate={props} />
}

function TabsScreen(props: ScreenProps) {
  return <NewImportModal tabs={{ selected: false, hotspot: props }} />
}

function SelectedScreen(props: ScreenProps) {
  return <NewImportModal tabs={{ selected: true }} proceed={props} />
}
