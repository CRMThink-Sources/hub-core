# Proposal

## Why

Toda linha Z-API tem uma fila FIFO por linha, e só a cabeça dela envia, **mesmo com a cadência desligada**. Cada envio leva ~7 s (chamada à Z-API, efeitos no Bitrix e resolução da linha), então a linha tem um teto de ~450–500 mensagens por hora, não importa quantos slots o worker tenha livres.

Medido em produção em 11/11/2026: as linhas 77 e 79 (ambas com a cadência desligada) respondem por 2866 dos 2883 envios que esperaram mais de 1 minuto. A linha 77 chegou a 451 envios/hora, com espera média de 254 s e máxima de 825 s. Nesse mesmo período os 5 slots do `thinkzap-widget-outbound` ficaram ocupados em média 1,5 a 2 de 5, e os cinco juntos só 0 a 3% do tempo: a capacidade existe, a ordem global da linha é que a impede de ser usada.

Sem cadência, a ordem global entre destinatários diferentes não protege nada. O que importa é a ordem para o mesmo contato.

## What Changes

- Com a cadência **desativada** e sem janela nem pausa em andamento, a ordem de saída passa a ser **FIFO por destinatário** (por linha e destinatário), e não FIFO da linha inteira. Destinatários diferentes passam a enviar em paralelo, até a concorrência do worker.
- A ordem para o **mesmo destinatário** continua garantida, entre todas as origens (texto antes de mídia, fala do bot antes da resposta do operador).
- Com a cadência **ativada**, o comportamento não muda: FIFO por linha, janela, pausa e fila de espera como hoje.
- Ao **desativar** a cadência durante uma janela ou pausa, a fila continua em FIFO da linha até o fim dela (como a spec já exige) e só depois passa a ordenar por destinatário.
- Uma chave de configuração permite voltar ao FIFO por linha sem novo deploy, caso o paralelismo cause algum problema inesperado.

Sem **BREAKING**: nenhuma API, payload ou contrato do front muda.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `thinkzap/cadencia-envio-mensagens`: o requisito "Enfileiramento sem recusa e ordem de envio" diz hoje que a ordem é FIFO por linha com a cadência ativada **ou desativada**. Passa a valer FIFO por linha só com a cadência ativa (ou janela/pausa em andamento) e FIFO por destinatário com a cadência desativada.

## Impact

- **Código** (`api/`, módulo `thinkzap`):
  - `infra/queue/redis-send-cadence.ts`: scripts Lua `RESERVE_SCRIPT`, `PEEK_TURN_SCRIPT`, `ENQUEUE_SCRIPT` e `dequeue`, mais as novas chaves Redis por destinatário.
  - `infra/queue/redis-send-cadence.fake.ts` e `domain/send-cadence-machine.ts`: o espelho em TypeScript do Lua, que é a fonte de verdade dos testes.
  - `application/helpers/sequence-outbox-rows.ts` e `domain/ports/send-cadence.port.ts`: o enfileiramento passa o destinatário.
  - `application/dispatch-widget-outbox-message.ts` e `workers/widget-send-turn-precheck.ts`: sem mudança de contrato esperada, a verificar no design.
  - `config/env.ts` e `.env.example`: a nova chave de rollback.
- **Sistemas**: Redis (chaves novas por destinatário, com TTL), nenhuma migration de banco.
- **Operação**: o ganho esperado é de até ~5× de vazão por linha sem cadência, limitado pela concorrência do worker (5) e pelo limite de taxa do Bitrix por portal. Linhas com cadência ativa não mudam.
- **Risco**: mensagens que estiverem na fila no momento do deploy não têm o índice por destinatário. O design trata isso e a janela de transição.
