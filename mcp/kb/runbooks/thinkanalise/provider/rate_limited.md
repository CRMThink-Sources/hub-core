---
category: integration
audience: suporte
summary: O sistema externo limitou as requisições (rate limit) e não entregou os dados agora.
---
# thinkanalise.provider.rate_limited

## O que significa
Pra montar os relatórios do BI, o CRMThink faz várias chamadas ao sistema externo (Asaas, Bling, Conta Azul, Omie ou Sonax) buscando os dados. Todo sistema externo tem um limite de quantas chamadas aceita num certo período — é o *rate limit*. Este erro quer dizer que o sistema externo avisou que esse limite foi atingido e, por isso, recusou temporariamente as chamadas. Não é um problema de credencial nem de dado errado: é excesso de pedidos num curto espaço de tempo. Os dados não vieram agora, mas tendem a voltar quando o limite se recompõe.

## Causa provável
- **Muitas atualizações do BI em sequência**: várias atualizações disparadas em pouco tempo (manuais ou por vários painéis abertos) estouram o limite do provedor.
- **Volume de dados muito grande**: uma consulta que puxa um período longo ou muitos registros gera muitas chamadas de uma vez e bate no limite.
- **Outros sistemas usando a mesma conta**: se a mesma conta do provedor é usada por outras ferramentas ao mesmo tempo, o limite é compartilhado e estoura mais rápido.
- **Limite mais baixo do plano do provedor**: alguns planos têm um teto menor de chamadas, então o limite é atingido com facilidade.

## Como verificar
1. Na tela de Logs do app thinkanalise, filtre pelo `traceKey` do ticket.
2. Confirme `errorCode: thinkanalise.provider.rate_limited`.
3. Veja no log qual é o sistema externo (o provider) envolvido e o horário do evento.
4. Verifique se há vários eventos desse mesmo tipo em sequência, próximos no tempo — isso confirma que o limite foi atingido por excesso de chamadas.

## Como resolver
1. Oriente o parceiro a **aguardar alguns minutos** e rodar a atualização do BI de novo. O limite se recompõe sozinho com o tempo, então muitas vezes a segunda tentativa já funciona.
2. Peça pra ele evitar disparar várias atualizações em sequência e fechar painéis do BI abertos em duplicidade, pra não somar chamadas.
3. Se o volume consultado for muito grande, oriente o parceiro a reduzir o período dos dados quando possível, pra diminuir a quantidade de chamadas de uma vez.
4. Confirme na tela de Logs que, após a espera, a atualização passou sem o erro.

## Quando escalar
Se o erro persistir mesmo com poucas atualizações e depois de esperar, ou se o limite estourar de forma recorrente atrapalhando o uso normal, acione a equipe de desenvolvimento. Anexe: `traceKey`, `errorCode: thinkanalise.provider.rate_limited`, o sistema externo (provider) envolvido, o domínio do parceiro e o horário dos eventos.
