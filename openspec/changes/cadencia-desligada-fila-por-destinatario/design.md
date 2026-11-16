# Design

## Context

Ver `proposal.md` para a motivação. O estado atual, lido no código:

- Todo envio de linha Z-API entra numa fila FIFO da linha ao ser gravado (`sequenceOutboxRows` → `ENQUEUE_SCRIPT`: um `ZSET` por linha, ordenado por uma sequência `INCR`). A sequência é gravada em `queue_seq` na row.
- No despacho, `RESERVE_SCRIPT` (espelho em TypeScript: `reserveStep`) decide **num passo só**: pausa vigente → janela cheia → **só a cabeça da fila da linha segue** → conta na janela ou, com a cadência desligada, libera sem contar. A checagem de cabeça (`isHead`) vem **antes** de `!cfg.enabled`, e é por isso que a linha sem cadência também serializa.
- O worker tem `concurrency: 5`. Antes do despacho, `precheckLineTurn` chama `peekTurn` para o job que não é cabeça desistir cedo (sem resolver a linha, que custa ~1 s) e voltar em ~0,5–1 s.
- Já existe uma trava por `(instância, destinatário)` (`acquireDestinationLock`), adquirida **antes** da reserva e solta depois do envio. Ela impede dois envios simultâneos para o mesmo destinatário; quem não a pega volta sem gastar tentativa.
- Consumidores da fila global, que devem continuar válidos: a lista de mensagens aguardando e a contagem da tela da linha (`queuedTickets`, `waitingCount`), a varredura de órfãos e de cabeça sem job (`SweepCadenceSequencer`) e o aviso de espera.

Restrição forte: o Lua não roda nos testes unitários. `redis-send-cadence.fake.ts` executa o espelho em TypeScript (`send-cadence-machine.ts`) no lugar dele, então a regra nova precisa existir **nos dois** e os testes precisam cobrir a paridade.

## Goals / Non-Goals

**Goals:**
- Com a cadência desativada e sem janela nem pausa em andamento, destinatários diferentes enviam em paralelo, até a concorrência do worker.
- A ordem do mesmo destinatário não muda, para nenhuma origem.
- Linha com cadência ativa tem exatamente o comportamento de hoje, e o mesmo vale para as telas e a varredura.
- Poder ligar e desligar a mudança sem deploy.

**Non-Goals:**
- Reduzir a duração de cada envio (resolução da linha a cada tentativa, efeitos no Bitrix). Pode vir depois e é independente.
- Mudar a concorrência do worker ou subir mais processos: a medição mostra que os slots não são o gargalo.
- Tratar telefone e `@lid` do mesmo contato como o mesmo destinatário. A trava por destinatário já compara a string do destino, e esta mudança herda essa regra.
- Mexer na cadência ativada, no limite diário, nas telas ou nos avisos.

## Decisions

### 1. A regra de ordem é uma função pura, espelhada no Lua

`send-cadence-machine.ts` ganha `ordersByDestination(state, cfg, now)`: verdadeira quando `!cfg.enabled` **e** não há pausa vigente **e** não há janela aberta. É a única definição de "modo relaxado". `reserveStep` passa a receber a cabeça **já resolvida** pelo chamador (`isHead`), e o Lua faz o mesmo cálculo com o estado que ele já carrega (`s.pauseUntil`, `s.windowEnd`).

Dois motivos para incluir a janela e a pausa na condição:
- A spec já exige que desativar a cadência durante uma janela ou pausa a respeite até o fim. Com o estado ainda ativo, a ordem continua global; quando o estado expira, o relaxamento vale sem ninguém precisar limpar nada.
- Mantém o relaxamento fora de qualquer caso em que a cadência ainda está contando envios.

*Alternativa descartada:* decidir o modo no enfileiramento, olhando `settings.cadenceEnabled`. A configuração pode mudar com mensagens já na fila, e a mensagem ficaria presa ao modo de quando nasceu.

### 2. A fila global continua sendo a fonte única; o índice por destinatário é adicional

Nada do que lê a fila global muda. Cada ticket passa a viver em **três** estruturas Redis, todas com o mesmo TTL de 30 dias renovado a cada `enqueue`:

| Estrutura | Chave | Conteúdo |
|---|---|---|
| Fila da linha (existe) | `thinkzap:cadence-queue:{linha}` | `ZSET` outboxId → seq |
| Fila por destinatário (nova) | `thinkzap:cadence-dest:{linha}:{destino}` | `ZSET` outboxId → o mesmo seq |
| Mapa ticket → destino (novo) | `thinkzap:cadence-ticketdest:{linha}` | `HASH` outboxId → destino |

O prefixo da fila por destinatário **não** pode começar com `thinkzap:cadence-queue:`, porque `queuedLines()` varre esse prefixo para achar linhas com fila.

Como o seq é o mesmo, a ordem por destinatário é sempre uma subordem consistente da ordem da linha. Isso é o que permite voltar à ordem global (ativar a cadência) sem reconciliar nada: o que sobrou na fila global continua em ordem.

*Alternativas descartadas:*
- Achar a cabeça por destinatário varrendo a fila global: O(n) dentro de um script Redis, que bloqueia o Redis na hora de maior fila.
- Codificar o destino no membro (`destino|id`): quebra todos os consumidores que tratam o membro como `outboxId` (varredura, lista, `findLiveIds`).
- Uma fila só por destinatário, sem a global: perde a ordem da linha para o caso com cadência ativa.

### 3. O mapa ticket → destino existe para que ninguém precise passar o destino em toda chamada

`dequeue(linha, outboxId)` é chamado pelo despacho e pela varredura de órfãos, que **não tem a row** (ela pode nem existir mais). Com o `HASH`, o Lua descobre o destino do ticket e o retira das três estruturas. A porta `SendCadence` muda pouco: `enqueue(linha, outboxId, destino)` e `CadenceTicket` ganham o `destination`; `dequeue`, `peekTurn`, `queuedTickets`, `waitingCount` e `queuedLines` mantêm a assinatura.

### 4. Reserva: a cabeça depende do modo

No `RESERVE_SCRIPT`, depois de pausa e janela cheia, a cabeça passa a ser:

- **modo relaxado** e o ticket tem destino registrado: cabeça da fila **do destinatário**;
- caso contrário: cabeça da fila da linha, como hoje.

Concedida a vaga, o ticket sai das três estruturas. Se o ticket volta depois de uma falha (a retentativa do BullMQ reinsere com o `seq` original), o `ZADD NX` do início do script o reinsere também na fila do destinatário e no mapa, usando o destino que agora vem no ticket. Isso mantém o retorno à mesma posição que a spec e o código já garantem.

A ordem do mesmo destinatário é protegida por duas camadas: a fila por destinatário decide quem é o próximo, e a trava por destinatário (já existente, adquirida antes da reserva) impede que o próximo comece enquanto o anterior ainda está no provider. O ticket sai da fila no momento da concessão, mas a trava só é solta ao fim do envio, então o seguinte volta como `locked` sem gastar tentativa.

### 5. A checagem rápida (`peekTurn`) precisa do modo, e o modo vem da última resolução da linha

O atalho existe para desistir **sem resolver a linha**, então não tem a configuração em mãos. Se ele continuasse comparando com a cabeça global, adiaria justamente os jobs que a mudança quer liberar. O `LineKeyMemory` já guarda a chave da fila da última resolução; passa a guardar também se a cadência estava ativada. `precheckLineTurn` repassa isso e o `PEEK_TURN_SCRIPT` compara com a cabeça do destinatário (linha sem cadência) ou com a da linha (com cadência).

O atalho continua só **desistindo cedo**, nunca deixando alguém passar na frente: quem decide é o `reserve`, atômico. Um modo desatualizado só custa uma tentativa a mais:
- memória diz "sem cadência" mas a linha está com janela aberta: o job passa pelo atalho, resolve a linha e o `reserve` nega por ordem global;
- memória diz "com cadência" logo depois de desativar: o job ainda é adiado como hoje, até a próxima resolução da linha atualizar a memória.

### 6. A varredura não muda

Ela repõe o job da **cabeça global** quando ele se perdeu, e remove órfãos pela `dequeue`, que agora limpa as três estruturas. No modo relaxado, um ticket sem job que seja cabeça do seu destinatário mas não da linha só é recriado quando virar a cabeça global (poucos minutos no pior caso, sem perda). Cada row sempre tem o seu próprio job, e só o caso de job perdido é afetado. Estender a varredura para as cabeças por destinatário fica registrado como melhoria possível, sem entrar nesta mudança.

### 7. Chave de configuração e implantação em dois passos

Env `THINKZAP_CADENCE_OFF_FIFO_PER_DESTINATION`, em `config/env.ts` e `api/.env.example`, **default `false`**. Lida só por `reserve` e `peekTurn` (via `RedisSendCadence`); o `enqueue` **sempre** registra o índice por destinatário, com a chave ligada ou não.

Isso resolve a janela de transição: mensagens que já estão na fila no deploy não têm destino registrado e seguiriam a ordem global (comportamento de hoje), mas um ticket novo do mesmo destinatário poderia ultrapassá-las se o relaxamento já estivesse ligado. Com a chave desligada no primeiro deploy, o índice vai sendo populado pelas mensagens novas e a fila antiga escoa; só depois a chave é ligada.

*Alternativa descartada:* ligar direto no deploy. Funciona na maior parte do tempo, mas deixa uma janela em que a ordem de um destinatário pode inverter, e o ganho de esperar alguns minutos é ter essa garantia de graça.

## Risks / Trade-offs

- **Rajada paralela em linha sem cadência** → o paralelismo é limitado pela concorrência do worker (5) e pela trava por destinatário, e a cadência desligada é uma escolha explícita do cliente. O limite de taxa do Bitrix por portal continua passando por `shared/infra/bitrix-limits`. Acompanhar `waitMs` e falhas da Z-API nas linhas 77 e 79 logo após ligar a chave; desligar a chave desfaz.
- **Lua não é executado nos testes unitários** → a regra existe na função pura e no Lua. Mitigação: os testes de paridade (cenários da spec contra o fake) e a validação em staging com a chave ligada, exercitando o script real, antes da produção.
- **Ticket sem destino registrado (mensagens anteriores ao deploy)** → seguem a ordem global até saírem. Coberto pelo passo 1 da implantação (chave desligada).
- **Reordenação entre `telefone` e `@lid` do mesmo contato** → pré-existente na trava por destinatário; não piora, e não é tratada aqui.
- **Mais chaves no Redis** → duas por ticket (membro no `ZSET` por destinatário e entrada no `HASH`), removidas na concessão ou no `dequeue`, com TTL de 30 dias. Uma fila de 1000 mensagens ocupa poucos KB.
- **A varredura recupera cabeça por destinatário só quando ela vira cabeça global** → aceito; ver a Decisão 6.
- **Vazão real abaixo de 5×** → o teto passa a ser a concorrência (5 slots) e o tempo de cada envio, e cada tentativa ainda paga ~1 s para resolver a linha. O ganho esperado é grande, mas a medição final é a das linhas 77 e 79 depois de ligar a chave.

## Migration Plan

1. Deploy com `THINKZAP_CADENCE_OFF_FIFO_PER_DESTINATION=false`. Comportamento idêntico ao atual. Mensagens novas já registram o destino.
2. Esperar a fila anterior ao deploy escoar (conferir `waitingCount` das linhas e a ausência de tickets sem destino no `HASH`).
3. Validar em staging com a chave ligada: dois destinatários em paralelo, mesmo destinatário em ordem, linha com cadência ativa inalterada.
4. Ligar em produção (`true`) e reiniciar o `hubthink-worker-widget-outbound`. Acompanhar espera por hora e ocupação dos slots nas linhas 77 e 79.
5. **Rollback:** voltar a chave para `false` e reiniciar o worker. Nenhum dado a desfazer: as estruturas novas são só índices e expiram sozinhas.

Sem migration de banco.
