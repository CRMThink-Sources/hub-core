## Context

O fluxo atual (`front/.../_lib/connect-hubmessage-channel.ts`): (1) `fetch` do navegador a `GET {hubMessageApiUrl}/instances/:channelId/sdk-info` com a Public Key crua em `Authorization`, só para informar o usuário quando a origem não está na allowlist (o SDK aborta em silêncio nesse caso); (2) `client.connect()` do SDK; (3) `POST /thinkzap/lines/:itemId/connect-channel`, que no servidor chama `POST /v1/channels/:id/connect` com a Secret Key.

A documentação atualizada da Omni confirma: `sdk-info` aceita a Public Key crua e é o único endpoint que a aceita; o SDK chama `sdk-info` internamente e roda o Embedded Signup da Meta no navegador; o `connect` final é backend com Secret Key. Não existe fluxo documentado sem o SDK (faltam app id, config_id e URL de autorização da Meta). A doc não diz se `sdk-info` pode ser chamado do servidor, mas é um GET HTTP comum com header, sem indício de restrição, e a API já tem `HUBMESSAGE_PUBLIC_KEY` em `env.ts`.

## Goals / Non-Goals

**Goals:**
- Tirar do navegador a única requisição à Omni feita pelo nosso código.
- Preservar todos os desfechos e a tolerância a falha da pré-checagem.

**Non-Goals:**
- Eliminar o SDK ou reimplementar o Embedded Signup.
- Mudar o modelo de chaves (Public Key no SDK, Secret Key no backend já é o da doc).
- Garantir que o SDK funcione em rede que bloqueie a Omni ou o Facebook.

## Decisions

1. **Rota por item, `GET /lines/:itemId/connect-origin-check?origin=`**, e não por `channelId`. Segue a família `/lines/:itemId`: o canal sai do `metadata` no servidor, com a mesma validação de linha oficial e de instalação de `ConnectOfficialLine` (`assertEnabledOfficialLineInContext`). O front ainda precisa do `channelId` para o SDK; continua vindo do `providerRef`.
2. **Origem em query, não no header `Origin`.** Atrás do iframe Bitrix e de proxies o header não é confiável; a origem relevante é `window.location.origin` do iframe. O servidor normaliza (sem barra final) e valida com `new URL` (http/https). Não é fronteira de segurança: a Omni aplica a allowlist de verdade; isto só gera mensagem melhor.
3. **`HubMessageClient.getSdkInfo(channelId)`** com `Authorization: <publicKey>` crua, diferente da instância atual (Bearer + Secret). Usa `env.hubMessage.publicKey`, timeout curto (ex.: 5 s) e `attachProviderHttpLogging`; pode ser uma segunda instância `axios` ou header por requisição.
4. **Caso de uso `CheckConnectOrigin`** em `application/`: resolve a linha, consulta `sdk-info`, compara. Fail-open em qualquer erro de `sdk-info` (log `warn`). Linha bloqueada continua recusada com a tradução de `mapLineError`, já que `connect-channel` recusaria depois de qualquer forma e assim evitamos abrir o popup da Meta à toa.
5. **Front tolerante.** `isOriginAllowed` chama a rota via `resolveThinkzapClient()`; falha de transporte e 5xx liberam o fluxo; 4xx de linha (402/404) propagam, como propagaria o `connect-channel`.
6. **Troca de pacote `@hubmessage/connect` → `@omnizapi/connect`** (1.1.1 no npm; a doc usa `OmniZapi.newClient`). A API `newClient({ publicKey }).connect({ channelId })` e o retorno `{ success, wabaId, phoneId, code }` seguem a doc. Validar tipos após instalar; se o retorno divergir, ajustar só `connect-hubmessage-channel.ts`.
7. **Remover `NEXT_PUBLIC_HUBMESSAGE_API_URL`** do front. `NEXT_PUBLIC_HUBMESSAGE_PUBLIC_KEY` permanece: o SDK precisa dela no navegador.

## Risks / Trade-offs

- **SDK bloqueado na rede do cliente**: a change não resolve. Mitigar com a lista de domínios a liberar (`api.omni.z-api.io`, `connect.facebook.net`, `www.facebook.com`) e confirmar com o cliente após a entrega.
- **`sdk-info` a partir do servidor não documentado**: se a Omni recusar, o fail-open mantém o fluxo e o log mostra o motivo.
- **Public Key duplicada** (`NEXT_PUBLIC_HUBMESSAGE_PUBLIC_KEY` e `HUBMESSAGE_PUBLIC_KEY`) pode divergir entre ambientes: documentar no `.env.example`.
- **Troca de pacote** pode trazer mudanças de tipos: coberta por typecheck e teste de conexão em sandbox.
- Um salto a mais (front → hub-core → Omni) por clique em Conectar; aceitável.
