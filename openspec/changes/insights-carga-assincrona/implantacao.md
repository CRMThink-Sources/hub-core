# Implantação — Insights: carga assíncrona

Roteiro para subir a change `insights-carga-assincrona`. A ordem importa: o container do worker precisa existir **antes** de o front novo ir ao ar, senão o painel fica em "calculando" até o prazo máximo e vira erro.

## 1. Banco

Nenhuma migration. Tudo o que esta change guarda (resultado dos painéis, estado do cálculo, sessões por dia, uso recente, estado da chave) está no Redis, é derivado e tem TTL.

## 2. Variáveis de ambiente (API e worker)

Todas opcionais; sem elas valem os padrões.

| Variável | Padrão | Observação |
|---|---|---|
| `INSIGHTS_CLOSED_DAY_TTL_MS` | `86400000` (24 h) | Validade das sessões de dias fechados (anteriores a ontem) no Redis. Fechamento tardio de sessão só aparece depois disso. |
| `INSIGHTS_CHAT_429_FINAL_WAIT_MS` | `5000` | Espera da última nova tentativa quando a Vibe API responde `429` ao ler um chat. |

Pontos de atenção:

- **`QUEUE_PREFIX` e `REDIS_URL`.** As chaves do Insights levam `QUEUE_PREFIX` (o ambiente), então staging e produção no mesmo Redis não leem nem apagam as chaves um do outro. Mesmo assim, mantenha índices de DB distintos no `REDIS_URL` (`/0` produção, `/1` staging), como já exige o `CLAUDE.md` para as demais chaves de aplicação.
- **A API e o worker precisam do mesmo `QUEUE_PREFIX` e do mesmo `REDIS_URL`.** Divergir não dá erro: a API enfileira num lugar e o worker escuta noutro, e o painel fica em "calculando".
- O worker lê o banco (configuração e chave Vibecode do app) e o Bitrix/Vibe: usa o mesmo `api/.env` da API.

## 3. Processos

- **Novo container `worker-insights`** (`hubthink-worker-insights` em produção, `hubthink-worker-insights-staging` em homologação), nos dois `docker-compose`. O nome começa com `hubthink-worker` porque é o que o Promtail coleta.
- Comando: `node dist/src/workers/insights.worker.js` (local: `yarn worker:insights`).
- Concorrência **1**, de propósito: um cálculo ocupa toda a cota de leitura da Vibe API.
- O CI não lista serviços: o `docker compose up` sobe o novo.

Sem este container, `GET /insights/dashboard` e `/insights/today` respondem `202` (calculando) e, depois de 15 min, erro de leitura.

## 4. Ordem de subida

1. **Homologação:** API, worker e front juntos (push em `develop`).
2. **Produção:** criar/subir o container `worker-insights` **e** a API na mesma janela; o front por último (ou junto).
   - Front novo + API antiga funciona (a API antiga só devolve `200`).
   - Front antigo + API nova **não**: o front antigo trata `202` como se fosse o painel.

## 5. Validação em homologação (grupo 7 das tarefas)

- [ ] **Abertura fria.** Primeira abertura do Insights de um app sem leituras guardadas: a resposta é `202` em segundos e o painel aparece sozinho. Nos logs (`insightsTiming`), `dashboard.request` curto e `dashboard` no worker.
- [ ] **Deploy da API.** Reiniciar a API e reabrir o período de 7 dias: `vibe.readSessions` lê só hoje e ontem.
- [ ] **Pré-aquecimento.** Depois de uma abertura e do intervalo do job (10 min), a abertura seguinte do período padrão responde `200`.
- [ ] **`429`.** Quando houver, o painel mostra o aviso com a quantidade de conversas incompletas e os logs trazem o warn de chat ilegível.
- [ ] **`bull-board`** sem jobs presos na fila `insights-compute`.
- [ ] **Troca de chave.** Salvar ou remover a chave Vibecode derruba os resultados e a próxima abertura calcula pelo modo novo.

## Rollback

- Reverter API e front para a versão anterior. O Redis só guarda dado derivado com TTL: nada a migrar.
- O container `worker-insights` pode ficar parado: a versão antiga não o usa.
- As chaves do Insights no Redis expiram sozinhas.
