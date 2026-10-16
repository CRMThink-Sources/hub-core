# Spec Delta

## Purpose

Limita quantas mensagens uma linha não oficial (Web, Z-API) envia por dia. O objetivo é reduzir o risco de a linha ser bloqueada pelo WhatsApp por volume. Esta capability cobre:

- a configuração do limite;
- a contagem do dia;
- a liberação temporária de mensagens extras;
- a recusa de envio quando o limite é atingido.

## ADDED Requirements

### Requirement: Configuração do limite diário por linha não oficial
Cada linha não oficial (provider Z-API) SHALL ter uma configuração própria de limite diário com dois valores:

- **ativado**: sim ou não;
- **limite**: inteiro maior que zero.

Linha nova ou linha que nunca teve a configuração SHALL ter o limite **desativado**.

Gravar o limite ativado com valor ausente, zero, negativo ou não inteiro SHALL ser recusado com erro de validação. Nesse caso nada é gravado.

Linhas oficiais (Business, HubMessage) SHALL NOT expor nem aplicar o limite nesta versão. Uma tentativa de gravar o limite numa linha oficial SHALL ser recusada.

Só quem tem permissão de edição da linha SHALL poder alterar a configuração. Essa permissão é a mesma que já autoriza editar os ajustes da linha.

#### Scenario: Ativar o limite
- **WHEN** um usuário com permissão de edição ativa o limite numa linha não oficial com o valor 300 e salva
- **THEN** a linha passa a ter limite diário ativo de 300 mensagens

#### Scenario: Limite inválido
- **WHEN** o usuário tenta salvar o limite ativado com o valor 0
- **THEN** a gravação é recusada com erro de validação
- **AND** a configuração anterior continua valendo

#### Scenario: Linha existente sem configuração
- **WHEN** uma linha não oficial criada antes desta funcionalidade é lida
- **THEN** o limite aparece desativado e nenhum envio dela é recusado por limite

#### Scenario: Linha oficial não tem limite
- **WHEN** alguém tenta gravar o limite diário numa linha HubMessage
- **THEN** a gravação é recusada
- **AND** os envios da linha não são afetados

### Requirement: Contagem diária de mensagens enviadas
O sistema SHALL contar, por linha não oficial, as mensagens de saída aceitas pelo provider em cada dia. O dia é o dia de calendário no fuso `America/Sao_Paulo`.

A contagem SHALL incluir toda origem de envio da linha:

- resposta do operador no canal aberto (texto, mídia e botões);
- mensagens de texto e botões do widget;
- envio com anexo pelo widget;
- robô "Enviar mensagem" e robô de botões;
- Campanha de SMS;
- falas do bot.

Cada mensagem aceita pelo provider SHALL contar uma unidade. Um envio com texto e anexos conta uma unidade por parte que o provider aceitou. Estes envios SHALL NOT contar:

- o envio que o provider respondeu com erro;
- o envio recusado pelo limite.

O envio sem resposta do provider (tempo esgotado ou falha de rede) tem entrega incerta e SHALL contar. Na dúvida, o sistema conta a mais em vez de deixar passar volume.

A contagem SHALL acontecer **com o limite ativado ou desativado**. Assim o cliente vê o volume real antes de ativar.

A contagem SHALL reiniciar em zero na virada do dia em `America/Sao_Paulo`, sem ação manual.

#### Scenario: Envios de origens diferentes somam no mesmo dia
- **WHEN** num mesmo dia a linha envia 10 respostas de operador, 5 mensagens pelo widget e 20 mensagens de Campanha de SMS, todas aceitas
- **THEN** a contagem do dia da linha é 35

#### Scenario: Texto com anexos conta cada parte
- **WHEN** o usuário envia pelo widget um texto com dois anexos e as três partes são aceitas
- **THEN** a contagem do dia aumenta em 3

#### Scenario: Envio recusado pelo provider não conta
- **WHEN** o provider responde com erro ao envio de uma mensagem
- **THEN** a contagem do dia não muda

#### Scenario: Envio com entrega incerta conta
- **WHEN** o tempo de resposta do provider se esgota durante o envio de uma mensagem
- **THEN** a mensagem conta na contagem do dia

#### Scenario: Virada do dia
- **WHEN** a linha enviou 300 mensagens até 23h59 e o relógio passa da meia-noite em `America/Sao_Paulo`
- **THEN** a contagem do novo dia começa em zero

#### Scenario: Conta mesmo com o limite desativado
- **WHEN** a linha está com o limite desativado e envia 40 mensagens no dia
- **THEN** a contagem do dia mostra 40

### Requirement: Limite efetivo e liberação temporária
O limite efetivo do dia SHALL ser o limite configurado mais o total de extras liberados naquele dia.

O usuário com permissão de edição SHALL poder liberar mensagens extras para o dia corrente numa linha com o limite ativado:

- a quantidade é um inteiro maior que zero;
- a liberação vale imediatamente;
- a liberação vale só para o dia em que foi feita. Na virada do dia em `America/Sao_Paulo`, o limite efetivo volta a ser o limite configurado;
- uma nova liberação no mesmo dia SHALL somar à anterior, sem substituí-la.

A liberação SHALL ser recusada nestes casos:

- o limite da linha está desativado;
- a quantidade é inválida;
- a linha é oficial.

Alterar o limite configurado no mesmo dia SHALL preservar os extras já liberados naquele dia.

#### Scenario: Liberar extras após atingir o limite
- **WHEN** a linha tem limite 300, já enviou 300 hoje, e o usuário libera 100 extras
- **THEN** o limite efetivo do dia passa a 400 e os envios voltam a ser aceitos

#### Scenario: Liberações somam
- **WHEN** o usuário libera 50 extras e depois mais 30 no mesmo dia, numa linha com limite 300
- **THEN** o limite efetivo do dia é 380

#### Scenario: Extra expira na virada do dia
- **WHEN** o usuário liberou 100 extras ontem numa linha com limite 300
- **THEN** o limite efetivo de hoje é 300

#### Scenario: Liberação com limite desativado
- **WHEN** o usuário tenta liberar extras numa linha com o limite desativado
- **THEN** a liberação é recusada e nada é gravado

### Requirement: Recusa de envio ao atingir o limite
Com o limite ativado, um envio pela linha quando a contagem do dia já alcançou o limite efetivo SHALL ser recusado:

- sem chamar o provider;
- sem contar na contagem do dia;
- com o código de erro `thinkzap.line.daily_limit_reached`.

Envios concorrentes SHALL NOT fazer a contagem do dia ultrapassar o limite efetivo.

A recusa SHALL valer até uma destas três coisas acontecer:

- a virada do dia;
- uma liberação temporária;
- o aumento ou a desativação do limite.

Baixar o limite para um valor menor ou igual à contagem atual SHALL fazer os próximos envios do dia serem recusados.

Cada origem SHALL informar a recusa:

- **Resposta do operador no canal aberto**: o operador SHALL receber no chat um aviso de que o limite diário da linha foi atingido. A mensagem SHALL NOT ser retentada.
- **Widget (texto e botões) e robô de botões**: o pedido de envio SHALL ser recusado na hora, com erro que identifica o limite atingido. Se o limite for atingido depois que a mensagem já entrou na fila, ela SHALL falhar de forma definitiva, sem retentativa, com o comentário de falha na timeline do CRM.
- **Envio com anexo pelo widget**: com o limite já atingido, o envio SHALL ser recusado inteiro, sem enviar nenhuma parte. Se o limite acabar no meio do envio, as partes seguintes SHALL NOT ser enviadas; as que saíram SHALL ser registradas normalmente, e o comentário na timeline SHALL informar quantos anexos não foram enviados por limite diário.
- **Robô "Enviar mensagem"**: cada destinatário reserva uma vaga. Os destinatários além do limite SHALL NOT receber a mensagem, e o comentário na timeline SHALL listá-los como não enviados por limite diário. Os demais destinatários SHALL ser atendidos normalmente.
- **Campanha de SMS**: a mensagem SHALL ter o status `failed` reportado ao Bitrix24.
- **Bot**: a fala SHALL NOT ser entregue ao contato. O motivo SHALL ficar registrado no log do processamento.

#### Scenario: Operador responde com o limite atingido
- **WHEN** a linha tem limite 300, já enviou 300 hoje, e um operador responde um cliente pelo canal aberto
- **THEN** a mensagem não é enviada ao WhatsApp
- **AND** o operador vê no chat o aviso de limite diário atingido
- **AND** a mensagem não é retentada

#### Scenario: Envio pelo widget com o limite atingido
- **WHEN** o usuário envia uma mensagem de texto pelo widget numa linha que atingiu o limite do dia
- **THEN** o envio é recusado na hora com a indicação de limite diário atingido e nada é enfileirado

#### Scenario: Limite acaba no meio do envio com anexos
- **WHEN** a linha tem uma vaga restante e o usuário envia pelo widget um texto com dois anexos
- **THEN** o texto é enviado e os dois anexos não
- **AND** o comentário na timeline informa que 2 anexos não foram enviados por limite diário

#### Scenario: Robô "Enviar mensagem" além do limite
- **WHEN** o robô dispara para dois contatos numa linha com uma vaga restante
- **THEN** só o primeiro contato recebe a mensagem
- **AND** o comentário na timeline lista o segundo como não enviado por limite diário

#### Scenario: Limite atingido com mensagem já na fila
- **WHEN** uma mensagem de robô foi enfileirada com 299 de 300 enviadas e outra mensagem consome a última vaga antes dela
- **THEN** a mensagem enfileirada falha sem retentativa e a timeline do CRM registra a falha por limite diário

#### Scenario: Campanha de SMS com o limite atingido
- **WHEN** a Campanha de SMS do Bitrix24 dispara uma mensagem por uma linha que atingiu o limite do dia
- **THEN** o status `failed` dessa mensagem é reportado ao Bitrix24

#### Scenario: Envios simultâneos na última vaga
- **WHEN** a linha está com 299 de 300 enviadas e duas mensagens são enviadas ao mesmo tempo
- **THEN** só uma é enviada e a outra é recusada por limite

#### Scenario: Limite desativado não recusa
- **WHEN** a linha está com o limite desativado e já enviou 1000 mensagens hoje
- **THEN** novos envios seguem normalmente

### Requirement: Exibição do uso do dia
A configuração da linha não oficial SHALL mostrar o uso do dia corrente, com o limite ativado ou desativado:

- mensagens enviadas hoje;
- limite configurado;
- extras liberados hoje;
- limite efetivo.

Com o limite ativado, SHALL mostrar também:

- o percentual que falta para atingir o limite efetivo: `(efetivo − enviadas) / efetivo`, arredondado para inteiro, com mínimo de 0%;
- a indicação de limite atingido quando enviadas ≥ efetivo.

Com o limite desativado, SHALL mostrar as mensagens enviadas hoje e a indicação de que não há limite ativo, sem percentual.

#### Scenario: Uso parcial
- **WHEN** a linha tem limite 300, nenhum extra, e enviou 225 hoje
- **THEN** a tela mostra 225 enviadas de 300 e 25% restantes

#### Scenario: Limite atingido na tela
- **WHEN** a linha tem limite 300 e enviou 300 hoje
- **THEN** a tela mostra 0% restantes e a indicação de limite atingido

#### Scenario: Uso com extras
- **WHEN** a linha tem limite 300, recebeu 100 extras hoje e enviou 350
- **THEN** a tela mostra 350 enviadas de 400 (300 + 100 extras) e 13% restantes

#### Scenario: Limite desativado
- **WHEN** a linha está com o limite desativado e enviou 40 hoje
- **THEN** a tela mostra 40 enviadas hoje e que não há limite ativo, sem percentual
