## Why

Ao conectar uma linha oficial, o front faz um `fetch` direto de `api.omni.z-api.io/instances/:channelId/sdk-info` para checar se a origem da página está liberada. Em pelo menos um cliente essa requisição falha por causa da infraestrutura de rede dele, que alcança o nosso servidor mas não a Omni, e a conexão do número fica travada antes mesmo de abrir o popup da Meta. A checagem não precisa sair do navegador: o servidor pode consultar `sdk-info` e devolver só o veredito.

## What Changes

- Nova rota `GET /api/thinkzap/lines/:itemId/connect-origin-check?origin=<origem>` que consulta `sdk-info` no servidor (usando a Public Key já presente em `HUBMESSAGE_PUBLIC_KEY`) e responde se a origem está liberada.
- O `channelId` continua sendo resolvido pelo `metadata` do item no servidor, como no restante da família `/lines/:itemId`.
- `connect-hubmessage-channel.ts` deixa de chamar `sdk-info`: passa a chamar a rota nova e mantém os mesmos desfechos (`origin-not-allowed` etc.).
- Mesma política atual de tolerância: se a Omni não responder ou a lista vier vazia, a checagem libera e o SDK decide (nunca bloquear o cliente por falha da checagem).
- Atualizar o SDK do front de `@hubmessage/connect` (1.1.0) para `@omnizapi/connect` (nome adotado pela documentação atualizada da Omni), sem mudar o fluxo `connect` → `connect-channel`.
- Remover do front a variável `NEXT_PUBLIC_HUBMESSAGE_API_URL`, que só servia ao `fetch` retirado.

Fora de escopo (decisão tomada com o usuário): o próprio SDK ainda chama `sdk-info` e carrega o SDK do Facebook no navegador, porque o popup do Embedded Signup da Meta só funciona no cliente. A documentação da Omni não publica fluxo de conexão sem o SDK. A autenticação continua sendo Public Key no SDK e Secret Key (Bearer) no `POST /v1/channels/:id/connect` feito pelo backend, que já é o modelo da documentação atual.

## Capabilities

### New Capabilities
- `thinkzap/conexao-oficial`: conexão do número de uma linha oficial (HubMessage/Omni), começando pela checagem de origem autorizada feita no servidor.

### Modified Capabilities
<!-- nenhuma: nenhum spec existente cobre a conexão da linha oficial -->

## Impact

- API: nova rota e caso de uso em `api/src/modules/thinkzap` (rota em `routes.ts`, cliente HubMessage ganha leitura de `sdk-info`); permissão `connectors:update`, igual à de `connect-channel`.
- Front: `front/app/(thinkzap)/thinkzap/_lib/connect-hubmessage-channel.ts`, `package.json`, `env-config.ts`, `.env.example`.
- Dependência: troca de `@hubmessage/connect` por `@omnizapi/connect`.
- Risco aberto: se o SDK em si for bloqueado na rede do cliente (`api.omni.z-api.io` ou `connect.facebook.net`), esta change não resolve; o cliente precisará liberar esses domínios.
