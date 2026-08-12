---
category: internal
audience: dev
summary: Observabilidade — recurso criado no provedor e a credencial não foi gravada no item; recurso órfão, cobrado de nós.
---
# thinkzap.subscription.manual_line_credential_orphaned

## O que significa
O pior desfecho deste fluxo, e o que exige ação. O job criou o recurso no provedor — instância na Z-API, ou canal na HubMessage — e a gravação da credencial no item da SPA 1146 **falhou**.

Duas consequências, as duas custam dinheiro:

1. **O recurso é órfão e nós pagamos por ele.** Ele existe no provedor, entra na nossa fatura, e não está vinculado a item nenhum — ninguém o usa e nada o cancela.
2. **O item continua ilegal para a leitura.** Provider declarado sem credencial faz o mapper recusar o item, e isso derruba a leitura da assinatura inteira daquela instalação.

Uma reexecução do job **não** conserta: ela encontra o item ainda sem credencial e cria um recurso **novo**, deixando o primeiro órfão do mesmo jeito. É por isso que este caso é registrado com o id remoto em vez de reenfileirado.

## Causa provável
- **CRM interno indisponível** no momento da gravação (`crm.item.update` falhou).
- **Campo inexistente ou renomeado** na SPA 1146: `crm.item.update` ignora campo desconhecido sem devolver erro, então uma renomeação de userfield aparece como gravação que "deu certo" e não persistiu — se o sintoma for esse, o item volta a aparecer aqui na tentativa seguinte.

## Como verificar
1. Na tela de Logs, filtre pelo `traceKey` do job.
2. Confirme `código de erro: thinkzap.subscription.manual_line_credential_orphaned`.
3. Leia `subscriptionItemId`, `provider` e `orphanRemoteId` — o `orphanRemoteId` é o id da instância (Z-API) ou do canal (HubMessage) que ficou órfão.

## Como resolver
Duas saídas, e a escolha é sobre a linha ser desejada ou não:

**Se a linha era desejada** — reaproveite o recurso:
1. Abra o item na SPA 1146.
2. Cole a credencial do `orphanRemoteId` nos campos do provider declarado: para Z-API, o id da instância **e** o token; para HubMessage, o id do canal.
3. Confirme que a leitura da instalação voltou (a listagem de linhas deixa de falhar).
4. Confira no gateway se a quantidade do `line_item` cobre a linha nova; se não, ajuste — o job não chegou ao passo de cobrança.

**Se a linha não era desejada** — apague o recurso:
1. Apague/cancele o recurso `orphanRemoteId` no provedor, para parar de ser cobrado por ele.
2. Corrija o item na SPA 1146 (escreva `NONE`, ou apague o item) para a leitura da assinatura voltar a funcionar.

## Quando escalar
Sempre. É perda financeira direta e leitura de instalação quebrada. Acione o desenvolvimento com: `traceKey`, código de erro, id do item na SPA 1146, `provider`, `orphanRemoteId` e horário. Se o mesmo item aparecer aqui duas vezes, suspeite de userfield renomeado na SPA 1146 antes de criar um terceiro recurso.
