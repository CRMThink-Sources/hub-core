---
category: integration
audience: suporte
summary: O sistema externo recusou ou falhou ao entregar os dados pedidos pelo BI.
---
# thinkanalise.provider.data_fetch_failed

## O que significa
Quando o BI do Bitrix24 pede um relatório, o CRMThink vai até o sistema externo (Asaas, Bling, Conta Azul, Omie ou Sonax) e solicita os dados. Este erro quer dizer que essa busca de dados falhou: o provedor recusou o pedido ou não conseguiu devolver as informações. Não é um caso claro de credencial inválida nem de bloqueio de plano — é uma falha na entrega dos dados em si. Na prática, o relatório do BI não é preenchido porque os dados não chegaram.

## Causa provável
- **Instabilidade ou indisponibilidade do provedor**: o sistema externo estava fora do ar ou instável na hora, e não conseguiu responder ao pedido.
- **Consulta pesada ou período muito grande**: pedidos de muitos dados de uma vez podem estourar o tempo e fazer o provedor falhar na entrega.
- **Algum parâmetro do pedido não aceito pelo provedor**: um filtro ou intervalo que o provedor não suporta faz ele recusar a busca.
- **Falha momentânea de comunicação**: uma queda de rede entre o CRMThink e o provedor também derruba a entrega naquele instante.

## Como verificar
1. Na tela de Logs do app thinkanalise, filtre pelo `traceKey` do ticket.
2. Confirme `errorCode: thinkanalise.provider.data_fetch_failed`.
3. Veja no log qual é o sistema externo (o provider) envolvido e a mensagem/status que ele devolveu — é esse texto que aponta se foi instabilidade, tempo esgotado ou recusa do pedido.
4. Verifique se o problema é só com aquele sistema externo ou se outros conectores do mesmo parceiro também falham, pra separar problema pontual de indisponibilidade geral.

## Como resolver
1. Comece lendo a mensagem/status do provedor no log, porque ela indica o caminho: instabilidade (esperar), consulta pesada (reduzir) ou recusa do pedido.
2. Se for instabilidade, oriente o parceiro a **aguardar alguns minutos** e rodar a atualização do BI de novo — falhas temporárias do provedor costumam se resolver sozinhas.
3. Se a consulta for muito grande, oriente o parceiro a reduzir o período/volume dos dados quando possível, pra aliviar o pedido.
4. Confirme na tela de Logs que a nova tentativa passou sem o erro.

## Quando escalar
Se as tentativas continuam falhando mesmo com o provedor no ar e com consultas menores, acione a equipe de desenvolvimento. Anexe: `traceKey`, `errorCode: thinkanalise.provider.data_fetch_failed`, o sistema externo (provider) envolvido, o domínio do parceiro, o horário do evento e a mensagem/status que o provedor retornou.
