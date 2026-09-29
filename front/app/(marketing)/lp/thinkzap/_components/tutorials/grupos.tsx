import { Check, CheckCircle2, Copy, Search, X } from 'lucide-react'
import type { GruposScreen } from '../content'
import { useLpContent, useTutorialScreens } from '../content/locale-context'
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
 * - textos: `messages/{pt,en}/thinkzap/configuracoes/grupos.json`,
 *   `criar-grupo.json`; a copy das telas fica em `content/{pt,en}/tutorials/grupos.ts`
 *
 * Mudou uma dessas telas no app, mude aqui também.
 */
const APP: ScreenFrame = { kind: 'app', path: APP_PATH, menu: 'conexoes' }

export const GRUPOS_VIEW: TutorialView<GruposScreen> = {
  frames: {
    'groups-tab': APP,
    'groups-list': APP,
    'group-form': APP,
    'group-ready': APP,
    'group-created': APP,
    'group-chat': { kind: 'bitrix', path: 'online/', menu: 'openChannels' },
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

const INVITE = 'https://chat.whatsapp.com/Kx7Qd2Lm9Pa'
const PEOPLE = [
  { name: 'Maria Clara', phone: '+55 11 98888-7777' },
  { name: 'Rafael Souza', phone: '+55 21 97777-6666' },
]

function GroupsPage({ children }: { children: React.ReactNode }) {
  const { common } = useTutorialScreens('grupos')

  return (
    <LinhaPage connected device={common.device} activeTab="grupos">
      {children}
    </LinhaPage>
  )
}

function GroupsTabScreen({ action, onAdvance }: ScreenProps) {
  const { common, groupsTab } = useTutorialScreens('grupos')
  const { shared } = useLpContent()

  return (
    <LinhaPage
      connected
      device={common.device}
      activeTab="conexao"
      tabHotspot={{ tab: 'grupos', action, onAdvance }}
    >
      <ConfigCard
        title={shared.lineTabs.conexao}
        description={groupsTab.description}
      >
        <p className="text-sm text-muted-foreground">{groupsTab.phoneLine}</p>
      </ConfigCard>
    </LinhaPage>
  )
}

function GroupsListScreen({ action, onAdvance }: ScreenProps) {
  const { groupsList } = useTutorialScreens('grupos')

  return (
    <GroupsPage>
      <ConfigCard
        title={groupsList.title}
        action={<HotspotButton action={action} onAdvance={onAdvance} />}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground [&>th]:py-2 [&>th]:font-semibold">
                <th>{groupsList.colName}</th>
                <th>{groupsList.colLastActivity}</th>
                <th className="text-right">{groupsList.colActions}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="[&>td]:py-2.5">
                <td className="font-medium">{groupsList.sampleGroup}</td>
                <td className="text-muted-foreground">
                  {groupsList.sampleLastActivity}
                </td>
                <td className="text-right text-xs text-primary">
                  {groupsList.rowActions}
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
  const { common, groupForm } = useTutorialScreens('grupos')

  return (
    <GroupsPage>
      <ConfigCard title={groupForm.title}>
        <div className="flex flex-col gap-3">
          <span className="w-fit text-sm text-primary">
            {groupForm.backToList}
          </span>
          <FakeField label={groupForm.nameLabel} value={common.groupName} />
          <p className="text-sm font-medium">{groupForm.participants}</p>
          {!added && (
            <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground">
                {groupForm.searchContact}
              </p>
              <p className="flex h-8 items-center gap-2 rounded-lg border border-input px-2.5 text-sm">
                <Search
                  aria-hidden
                  className="size-3.5 text-muted-foreground"
                />
                {groupForm.searchQuery}
              </p>
              <p className="text-xs text-muted-foreground">
                {groupForm.selectPhones}
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
                {groupForm.addedParticipants}
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
                {groupForm.autoInvite}
              </p>
            </div>
          )}
          <div className="flex justify-end">
            {create ? (
              <HotspotButton {...create} />
            ) : (
              <PrimaryButton className="opacity-50">
                {groupForm.create}
              </PrimaryButton>
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
  const { common, groupCreated } = useTutorialScreens('grupos')

  return (
    <GroupsPage>
      <ConfigCard title={common.groupName}>
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <CheckCircle2 aria-hidden className="size-10 text-primary" />
          <p className="text-base font-semibold">{groupCreated.success}</p>
          <div className="flex w-full max-w-sm flex-col gap-1.5 text-left">
            <p className="text-xs font-medium text-muted-foreground">
              {groupCreated.inviteLabel}
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
                {groupCreated.copyLink}
              </Hotspot>
            </div>
          </div>
          <div className="flex gap-2">
            <OutlineButton>{groupCreated.createAnother}</OutlineButton>
            <OutlineButton>{groupCreated.viewInList}</OutlineButton>
          </div>
        </div>
      </ConfigCard>
    </GroupsPage>
  )
}

function GroupChatScreen(props: ScreenProps) {
  const { common, groupChat } = useTutorialScreens('grupos')

  return (
    <OpenChannelChat
      {...props}
      chats={[
        { name: common.groupName, detail: groupChat.groupDetail },
        { name: 'Carlos Lima', detail: groupChat.otherChatDetail },
      ]}
      title={common.groupName}
      subtitle={groupChat.subtitle}
      messages={groupChat.messages.map(message => ({
        from: 'in' as const,
        ...message,
      }))}
      reply={groupChat.reply}
    />
  )
}
