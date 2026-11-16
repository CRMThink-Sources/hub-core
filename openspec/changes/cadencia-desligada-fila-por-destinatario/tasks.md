# Tasks

## 1. Regra de ordem no domínio e no fake

- [x] 1.1 Em `api/src/modules/thinkzap/domain/send-cadence-machine.ts`, criar `ordersByDestination(state, cfg, now)` (verdadeira só com `!cfg.enabled`, sem pausa vigente e sem janela aberta) e ajustar `reserveStep` para receber a cabeça já resolvida; verificar com testes em `send-cadence.test.ts` cobrindo os quatro casos (cadência ligada, desligada ociosa, desligada com janela aberta, desligada com pausa vigente)
- [x] 1.2 Em `api/src/modules/thinkzap/domain/ports/send-cadence.port.ts`, incluir `destination` em `CadenceTicket` e em `enqueue(lineKey, outboxId, destination)`; verificar com `yarn check-types` apontando todos os chamadores a atualizar
- [x] 1.3 Em `api/src/modules/thinkzap/infra/queue/redis-send-cadence.fake.ts`, modelar a fila por destinatário e o mapa ticket → destino (mesmas regras de entrada, concessão e `dequeue` do Lua), com o `scan` do fake ignorando as chaves novas; verificar com os testes existentes de `redis-send-cadence.test.ts` ainda passando sem alteração

## 2. Fila por destinatário no Redis

- [x] 2.1 Em `api/src/modules/thinkzap/infra/queue/redis-send-cadence.ts`, adicionar as chaves `thinkzap:cadence-dest:{linha}:{destino}` e `thinkzap:cadence-ticketdest:{linha}` (prefixo diferente de `thinkzap:cadence-queue:`) e fazer `ENQUEUE_SCRIPT` registrar o ticket nas três estruturas com o mesmo seq e TTL de 30 dias; verificar com teste no fake: ticket novo aparece na fila da linha, na do destinatário e no mapa
- [x] 2.2 Fazer `RESERVE_SCRIPT` calcular o modo relaxado (cadência desligada, sem pausa, sem janela aberta e chave de configuração ligada), usar a cabeça do destinatário nesse modo e a da linha no resto, reinserir o ticket nas três estruturas no `ZADD NX` do início e removê-lo das três na concessão; verificar com testes de paridade contra `reserveStep`
- [x] 2.3 Fazer `PEEK_TURN_SCRIPT` e `peekTurn` receberem o modo (por destinatário ou por linha) e `dequeue` remover das três estruturas lendo o destino no mapa; verificar com testes: `dequeue` de ticket cuja row não existe mais limpa as três, e o ticket sem destino registrado segue a ordem da linha
- [x] 2.4 Passar a chave de configuração ao `RedisSendCadence` por `makeSendCadence()`, ler `THINKZAP_CADENCE_OFF_FIFO_PER_DESTINATION` em `api/src/config/env.ts` (default `false`) e documentá-la com comentário em `api/.env.example`; verificar com `yarn check-types` e conferindo a variável nos dois arquivos
- [x] 2.5 Cobrir no fake e em `redis-send-cadence.test.ts` os cenários da spec: destinatários diferentes saem sem esperar uns pelos outros, mesmo destinatário mantém a ordem (texto, anexo 1, anexo 2) com mensagens de outros destinatários no meio, ordem entre origens (bot antes do operador), janela aberta depois de desativar mantém a fila da linha, ativar a cadência volta à fila da linha, retorno do ticket após falha volta à posição original, e com a chave desligada o comportamento é o da linha em todos os casos; verificar com `yarn test src/modules/thinkzap/infra/queue/redis-send-cadence.test.ts`

## 3. Enfileiramento e checagem rápida

- [x] 3.1 Passar `row.destination` em `sequenceOutboxRows` (`api/src/modules/thinkzap/application/helpers/sequence-outbox-rows.ts`) e na inserção tardia de `reserveCadenceSlot` em `dispatch-widget-outbox-message.ts`, e `destination` no ticket de `reserve`; verificar com os testes de `dispatch-widget-outbox-message*.test.ts` e dos serviços de enfileiramento passando, mais um teste novo de que o destino chega ao `enqueue`
- [x] 3.2 Em `api/src/workers/widget-send-turn-precheck.ts`, fazer `LineKeyMemory` guardar também se a cadência estava ativada e `precheckLineTurn` repassar o modo a `peekTurn`; em `thinkzap-widget-send.processor.ts`, gravar o modo ao resolver a linha; verificar com `widget-send-turn-precheck.test.ts`: linha sem cadência não adia ticket que é cabeça do próprio destinatário, linha com cadência adia como hoje, e memória sem modo cai no comportamento atual
- [x] 3.3 Confirmar que `SweepCadenceSequencer` continua correto com a `dequeue` nova (órfão sem row é removido das três estruturas) e ajustar `sweep-cadence-sequencer.test.ts` se algum fake da porta mudar; verificar com `yarn test src/modules/thinkzap/application/sweep-cadence-sequencer.test.ts`

## 4. Integração e verificação

- [x] 4.1 Teste de despacho com dois destinatários e `concurrency` maior que 1 (fake de cadência com a chave ligada): os dois enviam sem esperar um pelo outro; com a chave desligada o segundo espera; verificar com o teste novo em `dispatch-widget-outbox-message.cadence.test.ts`
- [x] 4.2 Rodar no pacote `api`: `yarn check-types`, `yarn lint` (zero warnings) e `yarn test` completo; verificar que os três terminam sem erro
- [ ] 4.3 Atualizar a spec principal `thinkzap/cadencia-envio-mensagens` aplicando o delta deste change quando for arquivado (`/opsx:archive`), e verificar com `openspec validate cadencia-desligada-fila-por-destinatario`
- [ ] 4.4 Validar em staging com a chave ligada, exercitando o Lua real: dois contatos em paralelo, mesmo contato em ordem (texto + 2 anexos) e uma linha com cadência ativa sem mudança; verificar nos logs do worker (`waitMs`) e na ordem de chegada no WhatsApp de teste
- [ ] 4.5 Implantar em produção seguindo o plano do `design.md` (deploy com a chave `false`, esperar a fila anterior escoar, ligar a chave e reiniciar `hubthink-worker-widget-outbound`); verificar, nas linhas 77 e 79, queda da espera p95 por hora e aumento da ocupação dos slots em relação à linha de base de 11/11/2026 (espera média de 254 s e máxima de 825 s no pico das 10h)
