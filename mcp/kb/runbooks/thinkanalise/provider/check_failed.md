---
category: integration
audience: suporte
summary: O teste de conexão com o sistema externo falhou por um erro do provedor (não credencial).
---
# thinkanalise.provider.check_failed

## O que significa
Antes de usar um conector, o BI faz um **teste de conexão** com o sistema externo (Asaas, Bling, Conta Azul, Omie ou Sonax) pra confirmar que dá pra falar com ele. Este erro quer dizer que esse teste falhou por um problema do lado do provedor — e não por credencial inválida. Ou seja, a chave/conta até parece estar em ordem, mas o provedor não respondeu como esperado ao teste. Enquanto o teste não passa, o conector não é dado como pronto pra buscar dados.

## Causa provável
- **Instabilidade ou indisponibilidade do provedor**: o sistema externo estava fora do ar ou instável na hora do teste.
- **Provedor respondeu com erro inesperado**: o provedor devolveu um erro que não é de credencial (por exemplo, falha interna dele) durante o teste.
- **Restrição temporária de acesso**: uma limitação momentânea no provedor pode fazer o teste falhar sem que a credencial esteja errada.
- **Falha momentânea de comunicação**: uma queda de rede entre o CRMThink e o provedor também derruba o teste naquele instante.

## Como verificar
1. Na tela de Logs do app thinkanalise, filtre pelo `traceKey` do ticket.
2. Confirme `errorCode: thinkanalise.provider.check_failed`.
3. Veja no log qual é o sistema externo (o provider) envolvido e a mensagem/status que ele devolveu no teste — é isso que separa erro do provedor de problema de credencial.
4. Pergunte ao parceiro se, no painel do provedor, o sistema aparece funcionando normalmente naquele momento.

## Como resolver
1. Como o teste falhou por erro do provedor, oriente o parceiro a **aguardar alguns minutos** e refazer o teste de conexão — falhas temporárias do provedor costumam se resolver sozinhas.
2. Peça pra ele confirmar, no painel do provedor, se o sistema externo está no ar e sem incidentes em andamento.
3. Se, mesmo assim, quiser descartar credencial, oriente o parceiro a conferir a chave/conta na configuração do conector (veja `thinkanalise.credentials.invalid`) — mas lembre que este erro aponta para o provedor, não para a credencial.
4. Confirme na tela de Logs que o teste passou na nova tentativa.

## Quando escalar
Se o provedor está no ar e o teste continua falhando após novas tentativas, acione a equipe de desenvolvimento. Anexe: `traceKey`, `errorCode: thinkanalise.provider.check_failed`, o sistema externo (provider) envolvido, o domínio do parceiro, o horário do evento e a mensagem/status que o provedor retornou no teste.
