# Proposal

## Why

A tela que o Bitrix24 abre ao configurar o conector ThinkZap pelo Contact Center (o `PLACEMENT_HANDLER` registrado em `imconnector.register`, `/thinkzap/connector`) quebra ao abrir com `Uncaught Error: Token not found`. A página está dentro do route group `(thinkzap)`, cujo layout monta `SessionProvider` — e ele lança no `useEffect` quando não há token no `sessionStorage`. No iframe do placement ninguém autenticou ainda: a autenticação só aconteceria dentro da própria página, que nem chega a montar (o layout segura os filhos enquanto o acesso está `loading`/`unauthenticated`). Mesmo que abrisse, o botão "Vincular" é um stub — só faz `console.log`; o `imconnector.activate` está comentado e nada é gravado. Hoje o cliente não consegue ligar uma linha a um canal aberto por esse caminho.

## What Changes

- A página `/thinkzap/connector` deixa de herdar o layout do app ThinkZap (aside, `SessionProvider`, `ThinkzapAccessProvider`, gate de acesso). Ela passa a ter um layout próprio de placement, mesmo padrão de `/widgets/conversations`: carrega o BX24, autentica com o backend, grava o token e só então monta o que depende dele. A URL **não muda** — continua a registrada em `BITRIX_CONNECTOR_URL` em todas as instalações.
- Falha de autenticação, falta de permissão ou falha de carga aparecem como mensagem na tela, nunca como erro não tratado.
- O botão "Vincular" passa a vincular de verdade: chama o endpoint existente `POST /thinkzap/lines/:itemId/channel` com o `LINE` do placement. O backend já ativa o conector no Bitrix (`imconnector.activate`) antes de gravar `vinculatedChannel` no item e garante a `Instance`.
- A tela mostra qual linha já está vinculada ao canal aberto aberto no placement e trata os erros do endpoint (canal já vinculado a outra linha, linha bloqueada, sem permissão) com a mensagem da API.
- Fora do escopo: o aviso de CSP (`'default-src' contains 'frame-ancestors'`) não é emitido por este repositório — não há CSP configurada no `next.config`, middleware nem API; vem do portal/hospedagem e não causa o erro. Desvincular pelo placement também fica fora (continua na tela de configuração da linha).

## Capabilities

### New Capabilities
- `thinkzap/placement-contact-center`: a tela de configuração do conector aberta pelo Contact Center do Bitrix24 — autenticação própria no iframe, listagem das linhas, indicação da linha já vinculada e vínculo de uma linha ao canal aberto.

### Modified Capabilities
<!-- Nenhuma: `thinkzap/configuracao-linha` cobre a tela interna da linha, cujo comportamento não muda. -->

## Impact

- **Front**: `front/app/(thinkzap)/thinkzap/connector/page.tsx` sai do group `(thinkzap)` (passa a outro group, mesma URL); `front/components/layouts/widgets/contact-center.tsx` reescrito (auth antes de qualquer chamada, vínculo real, estados de erro). Reusa `authenticateBitrixWithBackend`, `writeAppToken`, `useLineApi(...).linkChannel` e `thinkzapApiErrorMessage`.
- **API**: nenhuma mudança esperada — `GET /thinkzap/connector/list` (permissão `connectors:read`) e `POST /thinkzap/lines/:itemId/channel` (permissão `connectors:update`) já existem.
- **Bitrix**: nenhum re-registro de conector, porque a URL do handler não muda.
