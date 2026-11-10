## 1. API: consulta de `sdk-info` no servidor

- [x] 1.1 Em `api/src/modules/thinkzap/infra/clients/hubmessage.client.ts`, adicionar `getSdkInfo(channelId)` (`GET /instances/:id/sdk-info`, header `Authorization: <HUBMESSAGE_PUBLIC_KEY>` crua, sem Bearer, timeout curto) e o tipo `HubMessageSdkInfo` em `types/hubmessage.types.ts`
- [x] 1.2 Garantir que o cliente receba a Public Key de `env.hubMessage.publicKey` na factory que o instancia, sem exigi-la para os demais métodos
- [x] 1.3 Criar o caso de uso `CheckConnectOrigin` em `api/src/modules/thinkzap/application/`: resolve a linha oficial via `assertEnabledOfficialLineInContext`, normaliza a origem (sem barra final), compara com `allowOrigins`; lista vazia ou qualquer falha de `sdk-info` retorna `allowed: true` com log `warn`
- [x] 1.4 Criar `CheckConnectOriginController` em `presentation/controllers/line/`, validando `origin` com zod e `new URL` (http/https), respondendo `{ allowed }`, 400 para origem inválida e `mapLineError` para erros de linha
- [x] 1.5 Criar a fábrica em `main/connector/` e a rota `GET /lines/:itemId/connect-origin-check` em `routes.ts` com `requireThinkzapPermission('connectors', 'update')`

## 2. API: testes

- [x] 2.1 Testes do caso de uso: origem liberada, não liberada, barra final, lista vazia, `sdk-info` 401/404/5xx/timeout (fail-open), linha de outro provider, linha bloqueada
- [x] 2.2 Teste do controller: origem ausente ou inválida → 400; sucesso → `{ allowed }`; nenhuma chamada à Omni quando a origem é inválida
- [x] 2.3 Teste do `getSdkInfo` confirmando o header `Authorization` sem `Bearer`

## 3. Front

- [x] 3.1 Em `connect-hubmessage-channel.ts`, substituir o `fetch` a `sdk-info` por chamada a `/thinkzap/lines/:itemId/connect-origin-check?origin=<window.location.origin>` via `resolveThinkzapClient()`; falha de transporte ou 5xx libera, 4xx de linha propaga; remover `SdkInfo`, `normalizeOrigin` e o uso de `hubMessageApiUrl`
- [x] 3.2 Trocar a dependência `@hubmessage/connect` por `@omnizapi/connect` (`package.json` e lockfiles do front), ajustar import e `newClient`, e conferir os tipos do retorno de `connect`
- [x] 3.3 Remover `hubMessageApiUrl` de `front/shared/infra/env-config.ts` e `NEXT_PUBLIC_HUBMESSAGE_API_URL` de `.env.example` e docs de deploy; atualizar o comentário do `.env.example` para o novo nome do SDK
- [x] 3.4 Atualizar a referência ao SDK em `front/app/(marketing)/lp/thinkzap/_components/tutorials/api-oficial.tsx` se citar o pacote antigo
- [x] 3.5 Testes de `connect-hubmessage-channel`: origem não liberada → `origin-not-allowed`; rota de checagem fora do ar → segue ao SDK

## 4. Documentação e validação

- [x] 4.1 Documentar em `api/.env.example` que `HUBMESSAGE_PUBLIC_KEY` agora também é usada no servidor e deve ser igual à do front
- [x] 4.2 Rodar lint, typecheck e testes de `api` e `front`
- [ ] 4.3 Testar a conexão em sandbox e depois com o cliente afetado, confirmando na aba Network que a pré-checagem não faz requisição do navegador à Omni
- [ ] 4.4 Se o cliente ainda falhar no SDK, informar a lista de domínios a liberar (`api.omni.z-api.io`, `connect.facebook.net`, `www.facebook.com`)
