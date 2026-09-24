import { Check, CheckCircle2, Copy, Search, X } from 'lucide-react'
import type { GruposScreen } from '../content'
import { ConfigCard, LinhaPage } from './shared/app-pages'
import {
  APP_PATH,
  FakeField,
  Hotspot,
  HotspotButton,
  OutlineButton,
  PrimaryButton,
  type ScreenFrame,
  type ScreenProps,
  type TutorialView,
} from './shared/frame'
import { OpenChannelChat } from './shared/open-channel-chat'

/**
 * Tutorial "Grupos do WhatsApp" (só linhas WhatsApp Web). Espelha:
 * - `configuracoes/grupos-tab.tsx` (views lista / criar / detalhe),
 *   `grupos-lista.tsx`, `criar-grupo-tab.tsx`, `participantes-picker.tsx`,
 *   `grupo-criado-sucesso.tsx`
 * - chat: cada grupo vira uma conversa no canal aberto, com o autor em negrito
 *   (`process-z-api-inbound-message.use-case.ts`)
 * - textos: `messages/pt/thinkzap/configuracoes/grupos.json`, `criar-grupo.json`
 *
 * Mudou uma dessas telas no app, mude aqui também.
 */
const APP: ScreenFrame = { kind: 'app', path: APP_PATH, menu: 'Conexões' }

export const GRUPOS_VIEW: TutorialView<GruposScreen> = {
  frames: {
    'groups-tab': APP,
    'groups-list': APP,
    'group-form': APP,
    'group-ready': APP,
    'group-created': APP,
    'group-chat': { kind: 'bitrix', path: 'online/', menu: 'Canais abertos' },
  },
  screens: {
    'groups-tab': GroupsTabScreen,
    'groups-list': GroupsListScreen,
    'group-form': GroupFormScreen,
    'group-ready': GroupReadyScreen,
    'group-created': GroupCreatedScreen,
    'group-chat': GroupChatScreen,
  },
}

const DEVICE = 'Aparelho conectado: Joana Silva'
const GROUP = 'Clientes VIP'
const INVITE = 'https://chat.whatsapp.com/Kx7Qd2Lm9Pa'
const PEOPLE = [
  { name: 'Maria Clara', phone: '+55 11 98888-7777' },
  { name: 'Rafael Souza', phone: '+55 21 97777-6666' },
]

function GroupsPage({ children }: { children: React.ReactNode }) {
  return (
    <LinhaPage connected device={DEVICE} activeTab="Grupos">
      {children}
    </LinhaPage>
  )
}

function GroupsTabScreen({ action, onAdvance }: ScreenProps) {
  return (
    <LinhaPage
      connected
      device={DEVICE}
      activeTab="Conexão"
      tabHotspot={{ tab: 'Grupos', action, onAdvance }}
    >
      <ConfigCard
        title="Conexão"
        description="Esta linha está conectada ao WhatsApp."
      >
        <p className="text-sm text-muted-foreground">
          Telefone +55 11 99999-8888 · iPhone · Business
        </p>
      </ConfigCard>
    </LinhaPage>
  )
}

function GroupsListScreen({ action, onAdvance }: ScreenProps) {
  return (
    <GroupsPage>
      <ConfigCard
        title="Grupos do WhatsApp"
        action={<HotspotButton action={action} onAdvance={onAdvance} />}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground [&>th]:py-2 [&>th]:font-semibold">
                <th>Nome</th>
                <th>Última interação</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              <tr className="[&>td]:py-2.5">
                <td className="font-medium">Equipe de vendas</td>
                <td className="text-muted-foreground">ontem</td>
                <td className="text-right text-xs text-primary">
                  Editar · Sair
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ConfigCard>
    </GroupsPage>
  )
}

function GroupForm({
  added,
  addSelected,
  create,
}: {
  added: boolean
  addSelected?: ScreenProps
  create?: ScreenProps
}) {
  return (
    <GroupsPage>
      <ConfigCard title="Novo grupo">
        <div className="flex flex-col gap-3">
          <span className="w-fit text-sm text-primary">
            ← Voltar para lista
          </span>
          <FakeField label="Nome do grupo" value={GROUP} />
          <p className="text-sm font-medium">Participantes</p>
          {!added && (
            <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Buscar contato no Bitrix
              </p>
              <p className="flex h-8 items-center gap-2 rounded-lg border border-input px-2.5 text-sm">
                <Search
                  aria-hidden
                  className="size-3.5 text-muted-foreground"
                />
                Maria
              </p>
              <p className="text-xs text-muted-foreground">
                Selecione o(s) telefone(s)
              </p>
              {PEOPLE.map(person => (
                <p
                  key={person.phone}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="flex size-4 items-center justify-center rounded bg-primary text-primary-foreground">
                    <Check aria-hidden className="size-3" />
                  </span>
                  {person.name}
                  <span className="text-muted-foreground">{person.phone}</span>
                </p>
              ))}
              {addSelected && (
                <HotspotButton {...addSelected} className="h-8 text-xs" />
              )}
            </div>
          )}
          {added && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                Participantes adicionados
              </p>
              {PEOPLE.map(person => (
                <p
                  key={person.phone}
                  className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-1.5 text-sm"
                >
                  <span className="truncate">
                    {person.name}{' '}
                    <span className="text-muted-foreground">
                      {person.phone}
                    </span>
                  </span>
                  <X
                    aria-hidden
                    className="size-3.5 shrink-0 text-muted-foreground"
                  />
                </p>
              ))}
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="mt-px flex size-4 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground">
                  <Check aria-hidden className="size-3" />
                </span>
                Enviar convite privado para participantes que não puderem ser
                adicionados diretamente
              </p>
            </div>
          )}
          <div className="flex justify-end">
            {create ? (
              <HotspotButton {...create} />
            ) : (
              <PrimaryButton className="opacity-50">Criar grupo</PrimaryButton>
            )}
          </div>
        </div>
      </ConfigCard>
    </GroupsPage>
  )
}

function GroupFormScreen(props: ScreenProps) {
  return <GroupForm added={false} addSelected={props} />
}

function GroupReadyScreen(props: ScreenProps) {
  return <GroupForm added create={props} />
}

function GroupCreatedScreen({ action, onAdvance }: ScreenProps) {
  return (
    <GroupsPage>
      <ConfigCard title={GROUP}>
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <CheckCircle2 aria-hidden className="size-10 text-primary" />
          <p className="text-base font-semibold">Grupo criado com sucesso!</p>
          <div className="flex w-full max-w-sm flex-col gap-1.5 text-left">
            <p className="text-xs font-medium text-muted-foreground">
              Link de convite
            </p>
            <div className="flex items-center gap-2">
              <p className="h-9 min-w-0 flex-1 truncate rounded-lg border border-input px-2.5 py-2 text-xs">
                {INVITE}
              </p>
              <Hotspot
                action={action}
                onAdvance={onAdvance}
                className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground"
              >
                <Copy aria-hidden className="size-3.5" />
                Copiar link
              </Hotspot>
            </div>
          </div>
          <div className="flex gap-2">
            <OutlineButton>Criar outro grupo</OutlineButton>
            <OutlineButton>Ver na lista</OutlineButton>
          </div>
        </div>
      </ConfigCard>
    </GroupsPage>
  )
}

function GroupChatScreen(props: ScreenProps) {
  return (
    <OpenChannelChat
      {...props}
      chats={[
        { name: GROUP, detail: 'Grupo WhatsApp · Vendas' },
        { name: 'Carlos Lima', detail: 'WhatsApp · Vendas' },
      ]}
      title={GROUP}
      subtitle="Grupo do WhatsApp · Canal Vendas"
      messages={[
        {
          from: 'in',
          author: 'Maria Clara',
          text: 'Oi, pessoal! Quando sai a nova coleção?',
        },
        {
          from: 'in',
          author: 'Rafael Souza',
          text: 'Também quero saber 👀',
        },
      ]}
      reply="Na segunda-feira! Vocês recebem o catálogo aqui primeiro."
    />
  )
}
