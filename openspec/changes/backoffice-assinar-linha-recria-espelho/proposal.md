# Proposal

## Why

No backoffice, o botão "assinar" (e o "desassinar") de uma linha chama o provider, responde `200` e grava a marca de cobrança no espelho do recurso (Redis). Quando o espelho da linha não existe, a marca **não é gravada e ninguém é avisado**: `setBillingState` só emite um `debug` e retorna. O suporte vê sucesso, o provider foi de fato chamado, mas a tela continua mostrando `providerBilling: unknown`.

Aconteceu em produção (24/11/2026) com a linha Z-API do item 317 da assinatura 239: o espelho foi apagado pela exclusão da linha, a linha voltou a operar sem que nada o recriasse, e dois cliques em "assinar" (13:29 e 13:31) devolveram `200` sem registrar nada. A linha HubMessage da mesma assinatura, cujo espelho existia, recebeu a marca no primeiro clique. A ação existe justamente para o suporte corrigir uma marca que diverge do provider, e é aí que ela falha.

## What Changes

- "Assinar" e "desassinar" linha no backoffice passam a **garantir o espelho do recurso** antes de gravar a marca: se ele não existe, é recriado a partir do item (provider, credencial e assinatura pai), como o sync automático já faz (`ensureMirror`). A marca passa a sempre ficar gravada quando o provider aceita a operação.
- Item sem assinatura pai (não dá para montar o espelho) deixa de passar em silêncio: a ação informa que o provider foi chamado mas a marca não pôde ser registrada, e o motivo é logado em `warn`.
- A resposta das duas ações passa a dizer se a marca foi registrada, para a tela do backoffice não mostrar sucesso quando a marca ficou de fora.
- Sem mudança no ciclo automático: assinatura pai em trial continua sem assinar nem marcar (decisão já especificada).

## Capabilities

### New Capabilities
<!-- Nenhuma. -->

### Modified Capabilities
- `thinkzap/ciclo-provider-spa-assinatura`: o requisito "A marca de assinado acompanha todo caminho de subscribe e é limpa no unsubscribe" passa a cobrir expressamente as ações manuais do backoffice, inclusive quando o espelho da linha não existe.

## Impact

- API: `modules/portal/application/subscribe-thinkzap-line.ts`, `unsubscribe-thinkzap-line.ts` (tipo `LineBillingEffects`, novo helper de espelho), controllers `subscribe-thinkzap-line-controller.ts` e `unsubscribe-thinkzap-line-controller.ts`, testes em `thinkzap-line-actions.test.ts`.
- Reaproveita `SpaItemResourceMirrorRepository.save`/`find`. Sem migration, sem env nova.
- Front do backoffice: usar o campo novo da resposta para avisar quando a marca não foi registrada (a confirmar onde a tela chama a rota).
- Não corrige sozinho o item 317 em produção: depois do deploy, basta o suporte clicar em "assinar" de novo.
