# Design

## Context

Veja `proposal.md` (Why). Estado atual relevante:

- `configuracoes/page.tsx` controla as abas por estado local (`activeTab`), não por sub-rota — de propósito, para não remontar a casca. Trocar de aba **desmonta** o conteúdo da aba anterior, então edições da aba Ajustes se perdem hoje sem aviso.
- `AjustesTab` lê `api.getSettings()` (nome, canal vinculado, toggles, `entitlement`), guarda `inicial` para o diff, e já calcula `nomeMudou`/`togglesMudaram`/`podeSalvar` e envia só o que mudou. O botão Salvar é renderizado dentro do `ConfigCard` Comportamento.
- `SmsProviderCard` recebe `itemId` e `bloqueada`, busca `api.getSmsProvider()` e, quando `perTemplate`, delega para `TemplatesCampanha` (que usa o namespace `thinkzap/configuracoes/templates`). Os textos do card vivem em `ajustes.json > smsProvider`.
- `bloqueada` hoje vem do `entitlement` lido por `AjustesTab`. O contexto (`SubscriptionLine`) não expõe `entitlement`.
- Traduções carregam por namespace sob demanda (`import(\`../messages/${language}/${namespace}.json\`)`), então um JSON novo não exige registro.
- Já existe um padrão de barra fixa de salvamento: `_components/permissions-footer-bar.tsx` (`sticky bottom-0`, fundo `bg-card/95` com blur, botão com `Loader2`/`Check`).

## Goals / Non-Goals

**Goals:**
- Aba `campanha` nas duas variantes de linha reaproveitando `SmsProviderCard` sem mudar seu comportamento.
- Barra de salvamento única para a aba Ajustes, com contagem, Descartar e guarda de saída.

**Non-Goals:**
- Não transformar vínculo/desvínculo de canal em alteração pendente — continua ação imediata com confirmação.
- Não mudar endpoints, payloads nem a lógica de `SmsProviderCard`/`TemplatesCampanha` além do namespace de tradução.
- Não trocar abas por sub-rotas nem persistir a aba na URL.
- Não aplicar barra de salvamento em outras abas (Conexão, Grupos, Templates, Campanha não têm campos com "Salvar").

## Decisions

### 1. Nova aba `campanha` com componente `CampanhaSmsTab`
`TabId` ganha `'campanha'`. Nas duas variantes a aba entra depois de Ajustes. `CampanhaSmsTab({ itemId })` é uma casca fina: resolve `bloqueada`, mostra `LinhaBloqueadaAviso` quando bloqueada, e renderiza `SmsProviderCard`.

Na variante oficial, o ramo de renderização atual trata "qualquer aba que não seja templates/ajustes" como Conexão; ele precisa excluir também `campanha`.

**Alternativa considerada:** renderizar `SmsProviderCard` direto na página. Rejeitada porque a aba precisa do aviso de bloqueio e do `entitlement`, e isso não pertence à página.

### 2. `entitlement` da aba Campanha via `api.getSettings()`
A aba Campanha chama `getSettings()` só para obter `entitlement`. É a mesma fonte autoritativa que Ajustes usa (inclusive a regra de trial do backend). O card continua carregando o provedor em paralelo.

**Alternativas:** (a) derivar da assinatura no contexto replicando `isSubscriptionEnabled` — duplicaria a regra de novo e distingue mal trial vencido de inativa; (b) levantar o `entitlement` para a página — obrigaria a página a ler settings mesmo quando o usuário nunca abre Ajustes/Campanha. Uma leitura extra ao abrir a aba é barata.

Enquanto `entitlement` carrega, o card é renderizado com `bloqueada = true`, para nenhuma ação ficar disponível antes de sabermos. Se a leitura de settings falhar, também fica `true` e um aviso de erro com "Tentar novamente" é mostrado; a recusa autoritativa continua sendo o `402` do backend.

### 3. Barra de salvamento: componente `SaveChangesBar` em `_components/configuracoes/`
Novo componente baseado em `PermissionsFooterBar` (mesmas classes `sticky bottom-0 ... backdrop-blur`, margens negativas para encostar nas bordas da casca `px-4 sm:px-6 lg:px-8`), com props `{ dirtyCount, saving, canSave, onSave, onDiscard, labels }` ou textos via namespace `ajustes`. Mostra:
- sem alterações: texto neutro "Nenhuma alteração pendente";
- com alterações: indicador (ponto âmbar) + "N alterações não salvas" (pluralização i18next `_one`/`_other`);
- botões Descartar (`variant="outline"`) e Salvar alterações (primário, `Loader2` enquanto salva).

A barra é renderizada sempre (não aparece/some), para não haver salto de layout e o usuário sempre saber onde salvar. Não reusamos `PermissionsFooterBar` diretamente porque ela está acoplada ao namespace de permissões e não tem Descartar.

**Alternativa considerada:** barra que só aparece quando há alteração (estilo "toast" de rodapé). Rejeitada: some justamente no momento em que o usuário procura onde salvar, e causa pulo de layout.

### 4. Contagem de alterações
`dirtyCount = (nomeMudou ? 1 : 0) + TOGGLE_KEYS.filter(mudou).length`. `nomeMudou` compara com `trim()` do valor gravado para que espaços acidentais nas pontas não contem como alteração (o save já envia `trim()`). `podeSalvar` continua `dirtyCount > 0 && nomeValido && !bloqueada`.

O cálculo fica numa função pura `contarAlteracoes(inicial, atual)` em `ajustes-alteracoes.ts`, com teste `ajustes-alteracoes.test.ts` — o vitest do front só coleta `*.test.ts` (sem testes de componente), então a lógica testável sai do `.tsx`.

**Descartar** faz `setState(prev => ({ ...prev, name: inicial.name, settings: inicial.settings }))` — não chama a api.

### 5. Guarda de alterações não salvas
- `AjustesTab` recebe `onDirtyChange?: (dirty: boolean) => void` e notifica via `useEffect` quando `dirtyCount > 0` muda. Também registra `beforeunload` enquanto dirty (removido no cleanup).
- A página guarda `ajustesDirty` e envolve `setActiveTab` num `requestTab(id)`: se `activeTab === 'ajustes' && ajustesDirty && id !== 'ajustes'`, abre `ConfirmModal` ("Descartar alterações?"); ao confirmar, zera `ajustesDirty` e troca; ao cancelar, fecha. O componente `Tabs` passa a receber `requestTab`.
- O link "Voltar para conexões" também passa pela guarda (intercepta o clique quando dirty e reusa o mesmo modal, navegando com `router.push` ao confirmar). Navegação por outros meios do app (menu lateral) fica coberta só pelo `beforeunload` quando for navegação de documento; navegação client-side do Next fora da página não é interceptada (ver Riscos).

**Alternativa considerada:** manter as abas montadas (esconder com `hidden`) para preservar edições. Rejeitada: carregaria todas as abas (Conexão com socket, Grupos, Campanha) de uma vez e mudaria a política intencional de montagem por aba.

### 6. i18n
- Novo `messages/{pt,en,es}/thinkzap/configuracoes/campanha-sms.json` com o conteúdo de `smsProvider` (achatado na raiz) + `carregando` + bloco `bloqueada` (usado por `LinhaBloqueadaAviso`, que recebe o namespace) + textos de erro de leitura da aba.
- `SmsProviderCard` passa a usar `useTranslation('thinkzap/configuracoes/campanha-sms')` e as chaves perdem o prefixo `smsProvider.`.
- `ajustes.json` remove `smsProvider`; adiciona `barra.{semAlteracoes, alteracoes_one, alteracoes_other, salvar, salvando, descartar}` e remove `salvar`/`salvando` antigos se não forem mais usados.
- `page.json` adiciona `tabs.campanha` ("Campanha de SMS") e `sairSemSalvar.{titulo, descricao, confirmar, cancelar}`.

## Risks / Trade-offs

- [Navegação client-side para fora da página (menu do app) não é interceptada pelo App Router] → coberto o caso mais comum (troca de aba e "Voltar"); `beforeunload` cobre fechar/recarregar. Aceito como limitação; o Next não oferece guarda de rota nativa no App Router.
- [Leitura extra de `getSettings` ao abrir a aba Campanha] → custo de uma requisição leve; evita duplicar a regra de habilitação.
- [Usuário acostumado a encontrar Campanha em Ajustes] → a nova aba fica visível ao lado de Ajustes, com o mesmo título "Campanha de SMS"; nenhuma funcionalidade removida.
- [Barra `sticky` com margens negativas depende do padding da casca] → a casca de configuração usa o mesmo `px-4 sm:px-6 lg:px-8` da tela de permissões; se mudar, ajustar as duas.
- [Chaves `smsProvider.*` removidas de `ajustes.json` podem ser usadas em outro lugar] → verificar com busca por `smsProvider.` antes de remover.

## Migration Plan

Mudança só de frontend, sem dados. Deploy normal; rollback = reverter o commit.
