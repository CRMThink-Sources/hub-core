# Design

## Context

- `front/app/(thinkzap)/thinkzap/connector/page.tsx` é o `PLACEMENT_HANDLER` do conector (`BITRIX_CONNECTOR_URL`, gravado em `imconnector.register` de todas as instalações). Por estar no group `(thinkzap)`, herda `front/app/(thinkzap)/layout.tsx`, que monta `AplicationProvider` → `ThinkzapAccessProvider` → `SessionProvider` → `ThinkzapContent`.
- `SessionProvider` (`front/providers/session-provider.tsx`) chama `createSessionClient` dentro do `useEffect` e lança `Token not found` quando não há token — é a exceção do console (commit de efeitos passivos do React). Os efeitos do pai rodam no mesmo commit que o efeito assíncrono da página, então a página nunca consegue gravar o token antes.
- `ThinkzapContent` só renderiza `children` com o acesso `ready`; sem token o acesso fica `unauthenticated` e a página nem montaria.
- `/widgets/conversations` (`front/app/(widgets)/widgets/conversations/page.tsx`) já resolve o mesmo problema: `BX24Script` → `useBX24` → `authenticateBitrixWithBackend` → `writeAppToken` → só então monta provider/conteúdo.
- O backend já tem tudo: `GET /thinkzap/connector/list` (linhas ativas, `phoneData` no topo, `instance.vinculatedChannel`) e `POST /thinkzap/lines/:itemId/channel` (`{ lineId }`, ativa o conector no Bitrix antes de gravar, recusa canal ocupado com `ChannelAlreadyLinkedError`). No front, `useLineApi(itemId).linkChannel(lineId)` encapsula a chamada.
- O placement de conector do Bitrix entrega o canal aberto em `placement.info().options.LINE` (o componente atual lê `LINE` no salvar e `LINE_ID` na exibição — inconsistente).

## Goals / Non-Goals

**Goals:**
- Página do placement sem nenhum provider que dependa de token pré-existente.
- Vínculo real reaproveitando o endpoint e o hook já usados pela tela da linha.

**Non-Goals:**
- Mexer em `SessionProvider` (é legado com remoção prevista; deixar de lançar mudaria o comportamento das outras telas).
- Criar endpoint novo, desvincular pelo placement, ou tratar o aviso de CSP do portal.

## Decisions

1. **Mover a página para o group `(widgets)`, mantendo a URL.** Novo arquivo `front/app/(widgets)/thinkzap/connector/page.tsx`; o antigo em `(thinkzap)` é removido. Route groups não entram na URL, então `/thinkzap/connector` continua resolvendo — sem re-registro no Bitrix. O group `(widgets)` não tem layout próprio, só o root.
   - *Alternativa:* exceção por `pathname` dentro do layout do `(thinkzap)` para pular providers. Rejeitada: espalha um caso especial no layout do app e mantém a página acoplada ao aside/tema.
   - *Alternativa:* fazer `SessionProvider` tolerar ausência de token. Rejeitada: corrige o sintoma, mas a página continuaria bloqueada pelo gate de acesso e com aside.

2. **Fluxo da página igual ao de `/widgets/conversations`.** `isInsideIframe()` falso → `BitrixOnlyNotice`. Dentro: `BX24Script` → `useBX24` → `authenticateBitrixWithBackend` → `writeAppToken(result.app.appCode, token)` → renderiza `ContactCenterView` só autenticado. `ContactCenterView` deixa de autenticar por conta própria (vira componente que assume token presente) e mantém `fitWindow`/leitura de `placement.info()`.

3. **Canal do placement só como dica de pré-seleção.** `resolvePlacementLine` lê `options.LINE` (fallback `LINE_ID`). No teste em homolog, clicar em "Conectar" sem escolher canal vinculou a linha ao canal que o painel do Bitrix deixa selecionado por padrão: o Bitrix **sempre** manda um `LINE`, então ele não expressa escolha do usuário. Ele só pré-seleciona quando já existe linha com `instance.vinculatedChannel === String(LINE)` — o caso "Alterar".
   - *Alternativa:* usar `ACTIVE_STATUS` do placement para distinguir "Conectar" de "Alterar". Rejeitada: o vínculo gravado na linha é a fonte que o produto já usa e não depende de semântica não documentada do placement.

4. **Seletor de canal com `GET /thinkzap/openchannels`.** Mesmo endpoint e mesma permissão (`connectors:read`) da aba Ajustes da linha. Rótulo pelo nome do canal (`(inativo)` quando `active === false`); canal com `vinculatedChannel` de outra linha mostra `— vinculado a <linha>`, montado a partir da própria lista de linhas, sem chamada extra. O backend continua sendo quem recusa canal ocupado. Linhas e canais carregam em paralelo; falha nos canais desabilita o botão. Lista de linhas como antes (`/thinkzap/connector/list`, rótulo `phone — name` ou `instance.name`, sem filtrar por `phoneData`).

5. **Vincular via `useLineApi(lineId).linkChannel(Number(channelId))`.** Botão exige linha **e** canal escolhidos. Sucesso só após resposta `ok`; recarrega as linhas para refletir o vínculo e os canais ocupados. Erro → `thinkzapApiErrorMessage(e, 'Falha ao vincular o canal aberto')`, mantendo a seleção. Sem `BX24.reloadWindow()` automático.

6. **Erros de permissão.** `403` dos dois endpoints viram a mensagem da API (já em pt-br) via `thinkzapApiErrorMessage`; nada de `throw` no render ou em efeitos.

## Risks / Trade-offs

- [Formato de `placement.info().options` diferente do esperado (string JSON em vez de objeto) em algum portal] → normalizar: se `options` for string, fazer `JSON.parse` protegido; canal não identificado só deixa de pré-selecionar.
- [Usuário escolhe um canal diferente do que o painel do Bitrix mostra no topo] → é o comportamento pedido; o conector é ativado no canal escolhido e o painel reflete isso ao reabrir.
- [Duas pastas `thinkzap/` em groups diferentes confundem quem procura a página] → comentário no topo da nova página explicando por que ela vive em `(widgets)` e que a URL é o handler registrado.
- [Placement aberto por operador sem permissão `connectors:update`] → spec cobre: mensagem de permissão, sem vínculo.

## Migration Plan

Deploy só do front. Nenhum dado nem registro no Bitrix muda. Rollback = reverter o commit (volta a quebrar, mas sem efeito colateral).
