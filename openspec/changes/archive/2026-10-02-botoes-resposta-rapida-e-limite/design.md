# Design

## Context

Ver proposal.md — Why. Estado atual relevante:

- **Bug da resposta rápida**: `addButton` em `front/app/(widgets)/layouts/conversation-view.tsx` reinicia a lista sempre que o tipo adicionado é `REPLY` (`type === 'REPLY' || previous.some(REPLY) ? [novo] : [...previous, novo]`). A condição deveria ser "troca de família", não "é REPLY". O robô de automação (`button-robot-form.tsx`) já implementa a regra certa (`switchingKind = length > 0 && hasReply !== (type === 'REPLY')`). O widget de botões do Canal Aberto (`button-widget-view.tsx`) sempre acumula — não tem o bug.
- **Limite**: o front tem dois mecanismos paralelos — `maxButtons?: number` em `buttonComposerValidationMessage`/`ButtonComposer` (só a linha HubMessage define, `1`) e `maxButtonsByType` em `validateButtonConfig`/`ButtonRobotForm` (só o robô oficial define, `{ REPLY: 3, URL: 1 }`). Z-API não tem limite em lugar nenhum.
- No backend, `assertValidButtonsForProvider` (`api/src/modules/thinkzap/domain/ports/interactive-button-validation.ts`) é a fonte única da regra, chamada no pré-check do enfileiramento (widget e Canal Aberto), no webhook do robô, no worker e nos dois adapters. Só aplica limite para HubMessage. `TooManyButtonsError` já é mapeado para erro de requisição no controller do widget.

## Goals / Non-Goals

**Goals:**
- Um único teto geral (5) aplicado em todos os pontos que já aplicam limite por provider, sem criar novo caminho de validação.

**Non-Goals:**
- Alterar os limites da HubMessage (3 `REPLY` / 1 `URL`).
- Unificar os dois módulos de validação do front (widget vs. robô) — continuam separados, só ganham o teto.
- Migrar robôs já gravados com mais de 5 botões; eles passam a ser recusados e exibidos com a mensagem de máximo.
- Adicionar `.max()` no schema zod dos controllers: a recusa fica na validação por provider para manter mensagem/erro únicos.

## Decisions

1. **Corrigir `addButton` do widget de conversa copiando a regra do robô**: reiniciar só quando `previous.length > 0` e a família muda (`hasReply !== (type === 'REPLY')`). Na prática o `ButtonComposer` já desabilita o botão de tipo incompatível, então o caminho de reinício quase não é exercitado — mas manter a regra simétrica ao robô evita divergência. Alternativa considerada: sempre acumular (como `button-widget-view`) e deixar a validação recusar a mistura; descartada porque mudaria o comportamento atual de troca de família.

2. **Constante `MAX_BUTTONS_PER_SEND = 5` no backend, aplicada depois das checagens por provider** em `assertValidButtonsForProvider`, lançando `TooManyButtonsError(provider, 5)`. A HubMessage retorna antes com o próprio limite (3/1), sempre mais restrito — assim 6 links numa linha oficial recebem "máximo 1", não "máximo 5". Alternativa: limite só no ramo `ZAPI`; descartada porque um provider futuro ficaria sem teto.

3. **No front, o limite efetivo é `min(teto geral, limite do provider)`**:
   - Widget (`button-composer.tsx`): exportar `MAX_WIDGET_BUTTONS = 5`; `buttonComposerValidationMessage` e `ButtonComposer` passam a usar `maxButtons ?? MAX_WIDGET_BUTTONS` (limites da linha oficial já são menores). `conversation-view.tsx` e `button-widget-view.tsx` não precisam mudar além do bug, pois o default cobre ambos.
   - Robô (`button-robot-config.ts`): `validateButtonConfig` e `isTypeAtMax` em `button-robot-form.tsx` usam `maxButtonsByType?.[type] ?? MAX_ROBOT_BUTTONS` (5). Exportar a constante de `button-robot-config.ts` para o form reutilizar.
   - Mensagem reaproveitada: "Esta linha aceita no máximo N botão(ões) por envio."

   Alternativa: passar `maxButtons={5}` explicitamente nos chamadores Z-API; descartada porque exigiria lembrar do limite em cada tela nova.

## Risks / Trade-offs

- [Robôs/automações existentes com mais de 5 botões param de enviar] → o disparo é recusado com mensagem clara na timeline (fluxo `button_robot_refused` já existente) e a tela de configuração mostra o motivo; volume esperado baixo.
- [Front e back com a constante duplicada] → mesma situação dos limites da HubMessage hoje; testes nos dois lados cobrem o valor 5.

## Migration Plan

Deploy normal de front e API, sem migração de dados. Rollback: reverter o commit.
