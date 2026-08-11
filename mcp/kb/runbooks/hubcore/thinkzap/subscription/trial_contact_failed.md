---
category: integration
audience: suporte
summary: Não foi possível registrar seus dados de contato para iniciar o teste.
---
# thinkzap.subscription.trial_contact_failed

## O que significa
O cliente preencheu os dados de contato para começar o período de teste, mas o registro desses dados no CRM interno falhou. O teste **não começou**: nenhuma linha foi criada e nenhum recurso foi provisionado. Não há cobrança envolvida. O portal continua elegível ao teste — é seguro tentar de novo, e a nova tentativa não gasta o teste do cliente.

## Causa provável
- **CRM interno indisponível**: a instância interna do Bitrix não respondeu à gravação no item de cliente.
- **Instabilidade momentânea de rede** entre a aplicação e o CRM interno.
- **Item de cliente ausente ou removido**: a instalação aponta para um item que não existe mais no CRM interno.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.subscription.trial_contact_failed`.
3. Leia na linha do log o domínio/portal e a mensagem devolvida — indica se foi indisponibilidade passageira ou item ausente.
4. Confirme que **não** existe linha nem assinatura de teste criada para esse portal: este erro acontece antes de qualquer criação.

## Como resolver
1. Peça ao cliente para preencher o formulário e ativar o teste novamente em alguns instantes (o erro costuma ser passageiro).
2. Se repetir, verifique com a equipe se a instância interna do Bitrix está respondendo.
3. Se a mensagem do log indicar item de cliente ausente, o portal precisa ter o item recriado antes de nova tentativa — encaminhe à equipe de desenvolvimento.
4. Confirme na tela de Logs que a nova tentativa não gerou o erro, e com o cliente que o teste começou (a linha aparece na tela de Conexões).

## Quando escalar
Se o erro persistir em novas tentativas, ou se o log indicar item de cliente ausente, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.subscription.trial_contact_failed`, domínio/portal do parceiro, horário do evento, e-mail da conta e a mensagem devolvida.
