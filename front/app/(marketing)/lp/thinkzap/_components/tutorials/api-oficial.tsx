import { RefreshCw } from 'lucide-react'
import type { ApiOficialScreen } from '../content'
import {
  ActiveLinesBadge,
  ConexoesPage,
  ConfigCard,
  LinesTable,
  LinhaPage,
  OFICIAL_HINT,
  ProviderOption,
  WEB_HINT,
  type LineRowData,
} from './shared/app-pages'
import {
  APP_PATH,
  DialogOver,
  FakeField,
  FakeSelect,
  Hotspot,
  HotspotButton,
  OutlineButton,
  PrimaryButton,
  type ScreenFrame,
  type ScreenProps,
  type TutorialView,
} from './shared/frame'
import { CrmDealPage } from './shared/crm'

/**
 * Tutorial "API oficial e templates". Espelha:
 * - nova linha: `conexoes/nova-linha-modal.tsx`, `conexao-row.tsx`
 * - conexão: `configuracoes/oficial/conexao-oficial-tab.tsx` (o popup da Meta,
 *   aberto pelo `@hubmessage/connect`, não é desenhado)
 * - templates: `configuracoes/oficial/templates-tab.tsx`, `templates-lista.tsx`,
 *   `template-form.tsx`
 * - envio: aba ThinkZap do CRM, `(widgets)/layouts/conversation-view.tsx` +
 *   `template-composer.tsx`
 * - textos: `messages/pt/thinkzap/conexoes/nova-linha.json`,
 *   `configuracoes/conexao-oficial.json`, `configuracoes/templates.json`
 *
 * Mudou uma dessas telas no app, mude aqui também.
 */
const APP: ScreenFrame = { kind: 'app', path: APP_PATH, menu: 'Conexões' }

export const API_OFICIAL_VIEW: TutorialView<ApiOficialScreen> = {
  frames: {
    lines: APP,
    'new-line': APP,
    'pending-line': APP,
    connect: APP,
    connected: APP,
    templates: APP,
    'template-form': APP,
    'template-pending': APP,
    'crm-send': { kind: 'bitrix', path: 'crm/deal/details/1042/', menu: 'CRM' },
  },
  screens: {
    lines: LinesScreen,
    'new-line': NewLineScreen,
    'pending-line': PendingLineScreen,
    connect: ConnectScreen,
    connected: ConnectedScreen,
    templates: TemplatesScreen,
    'template-form': TemplateFormScreen,
    'template-pending': TemplatePendingScreen,
    'crm-send': CrmSendScreen,
  },
}

const LINE_NAME = 'Linha 2'
const WABA = '104857392018475'
const TEMPLATE = 'confirmacao_pedido'
const TEMPLATE_BODY = 'Olá {{1}}, seu pedido foi confirmado.'

const WEB_ROW: LineRowData = {
  name: 'Linha 1',
  provider: 'web',
  subtitle: 'Plano mensal',
  status: 'Ativo',
}

function LinesPage({
  rows,
  newLine,
  hotspotRow,
}: {
  rows: LineRowData[]
  newLine?: ScreenProps
  hotspotRow?: ScreenProps & { index: number }
}) {
  return (
    <ConexoesPage>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ActiveLinesBadge count={`${rows.length}/${rows.length}`} />
        {newLine ? (
          <HotspotButton {...newLine} />
        ) : (
          <PrimaryButton>Nova linha</PrimaryButton>
        )}
      </div>
      <LinesTable rows={rows} hotspot={hotspotRow} />
    </ConexoesPage>
  )
}

function LinesScreen(props: ScreenProps) {
  return <LinesPage rows={[WEB_ROW]} newLine={props} />
}

function NewLineScreen({ action, onAdvance }: ScreenProps) {
  return (
    <DialogOver background={<LinesPage rows={[WEB_ROW]} />}>
      <p className="text-base font-medium">Criar nova linha</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Escolha o tipo de conector da linha nova. A cobrança é ajustada na sua
        assinatura atual.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <ProviderOption label="WhatsApp Web" hint={WEB_HINT} />
        <ProviderOption label="WhatsApp Oficial" hint={OFICIAL_HINT} selected />
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        <p className="text-sm font-medium">Escolher plano</p>
        <FakeSelect value="Oficial · mês" className="w-full" />
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <OutlineButton>Cancelar</OutlineButton>
        <HotspotButton action={action} onAdvance={onAdvance} />
      </div>
    </DialogOver>
  )
}

function PendingLineScreen({ action, onAdvance }: ScreenProps) {
  return (
    <LinesPage
      rows={[
        WEB_ROW,
        {
          name: LINE_NAME,
          provider: 'oficial',
          subtitle: 'Plano mensal',
          status: 'Aguardando conexão',
        },
      ]}
      hotspotRow={{ index: 1, action, onAdvance }}
    />
  )
}

function ConnectScreen({ action, onAdvance }: ScreenProps) {
  return (
    <LinhaPage
      name={LINE_NAME}
      provider="oficial"
      connected={false}
      activeTab="Conexão"
    >
      <ConfigCard
        title="Conexão"
        description="Conecte o número desta linha à sua conta da Meta."
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Ao conectar, a Meta abre a autenticação da sua conta do WhatsApp
            Business. Ao final, o número fica ligado a esta linha e os templates
            passam a funcionar.
          </p>
          <HotspotButton action={action} onAdvance={onAdvance} />
        </div>
      </ConfigCard>
    </LinhaPage>
  )
}

function ConnectedScreen({ action, onAdvance }: ScreenProps) {
  return (
    <LinhaPage
      name={LINE_NAME}
      provider="oficial"
      connected
      activeTab="Conexão"
      tabHotspot={{ tab: 'Templates', action, onAdvance }}
    >
      <p className="w-fit rounded-md bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
        Número conectado.
      </p>
      <ConfigCard
        title="Conexão"
        description="Esta linha está conectada ao WhatsApp Oficial."
      >
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Conta do WhatsApp Business (WABA)
            </p>
            <p className="mt-0.5 font-mono text-sm text-foreground">{WABA}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Para trocar o número desta linha, fale com o suporte.
          </p>
        </div>
      </ConfigCard>
    </LinhaPage>
  )
}

/** Aba Templates: descrição, Sincronizar e Novo template no cabeçalho. */
function TemplatesTab({
  newTemplate,
  sync,
  children,
}: {
  newTemplate?: ScreenProps
  sync?: ScreenProps
  children: React.ReactNode
}) {
  return (
    <LinhaPage
      name={LINE_NAME}
      provider="oficial"
      connected
      activeTab="Templates"
    >
      <ConfigCard
        title="Templates"
        description="Modelos de mensagem aprovados pela Meta para iniciar conversas fora da janela de 24h."
        action={
          <span className="flex gap-2">
            {sync ? (
              <Hotspot
                {...sync}
                className="inline-flex h-9 w-fit items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-sm font-medium shadow-xs hover:bg-muted"
              >
                <RefreshCw aria-hidden className="size-3.5" />
                Sincronizar
              </Hotspot>
            ) : (
              <OutlineButton>
                <RefreshCw aria-hidden className="size-3.5" />
                Sincronizar
              </OutlineButton>
            )}
            {newTemplate ? (
              <HotspotButton {...newTemplate} />
            ) : (
              <PrimaryButton>Novo template</PrimaryButton>
            )}
          </span>
        }
      >
        {children}
      </ConfigCard>
    </LinhaPage>
  )
}

function TemplatesScreen(props: ScreenProps) {
  return (
    <TemplatesTab newTemplate={props}>
      <p className="py-4 text-center text-sm text-muted-foreground">
        Nenhum template cadastrado ainda.
      </p>
    </TemplatesTab>
  )
}

function TemplateFormScreen({ action, onAdvance }: ScreenProps) {
  return (
    <TemplatesTab>
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <FakeField label="Nome do template" value={TEMPLATE} />
          <FakeField label="Categoria" value="Utilidade" />
          <FakeField label="Idioma" value="pt_BR" />
        </div>
        <FakeField label="Corpo da mensagem" value={TEMPLATE_BODY} multiline />
        <FakeField label="Exemplo para {{1}}" value="Maria" />
        <FakeField label="Rodapé (opcional)" value="Loja Acme" />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <OutlineButton>Cancelar</OutlineButton>
          <HotspotButton action={action} onAdvance={onAdvance} />
        </div>
      </div>
    </TemplatesTab>
  )
}

function TemplatePendingScreen(props: ScreenProps) {
  return (
    <TemplatesTab sync={props}>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{TEMPLATE}</p>
          <p className="text-xs text-muted-foreground">Utilidade · pt_BR</p>
        </div>
        <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
          Pendente
        </span>
      </div>
    </TemplatesTab>
  )
}

function CrmSendScreen({ action, onAdvance }: ScreenProps) {
  return (
    <CrmDealPage tab="ThinkZap">
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">Linha</p>
            <FakeSelect value={`${LINE_NAME} - Oficial`} className="w-full" />
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">Destino</p>
            <FakeSelect value="+55 11 98888-7777" className="w-full" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-2 text-sm font-medium">
            Template
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              Aprovado
            </span>
          </p>
          <FakeSelect value={TEMPLATE} className="w-full" />
        </div>
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          Olá <strong>Maria</strong>, seu pedido foi confirmado.
        </p>
        <FakeField label="{{1}}" value="Maria" />
        <HotspotButton
          action={action}
          onAdvance={onAdvance}
          className="self-end"
        />
      </div>
    </CrmDealPage>
  )
}
