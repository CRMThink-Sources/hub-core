# Spec Delta

## MODIFIED Requirements

### Requirement: Recusa de envio ao atingir o limite
Com o limite ativado, um envio pela linha quando a contagem do dia já alcançou o limite efetivo SHALL ser recusado:

- sem chamar o provider;
- sem contar na contagem do dia;
- com o código de erro `thinkzap.line.daily_limit_reached`.

Envios concorrentes SHALL NOT fazer a contagem do dia ultrapassar o limite efetivo.

Todas as origens enviam pela fila de saída da linha (capability `thinkzap/cadencia-envio-mensagens`). O limite SHALL ser verificado no **momento do envio real** de cada mensagem ou parte, inclusive depois de uma espera por cadência. Onde indicado abaixo, há também uma verificação antecipada no momento do pedido.

A recusa SHALL valer até uma destas três coisas acontecer:

- a virada do dia;
- uma liberação temporária;
- o aumento ou a desativação do limite.

Baixar o limite para um valor menor ou igual à contagem atual SHALL fazer os próximos envios do dia serem recusados.

Cada origem SHALL informar a recusa:

- **Resposta do operador no canal aberto**: a resposta entra na fila. Quando ela chega ao envio com o limite atingido, o operador SHALL receber no chat um aviso de que o limite diário da linha foi atingido. A mensagem SHALL NOT ser retentada.
- **Widget (texto e botões) e robô de botões**: o pedido de envio SHALL ser recusado na hora, com erro que identifica o limite atingido. Se o limite for atingido depois que a mensagem já entrou na fila, ela SHALL falhar de forma definitiva, sem retentativa, com o comentário de falha na timeline do CRM.
- **Envio com anexo pelo widget**: com o limite já atingido no momento do pedido, o envio SHALL ser recusado inteiro, sem enfileirar nenhuma parte. Se o limite acabar enquanto as partes estão na fila, as partes que ainda não saíram SHALL falhar sem ser enviadas. As que saíram SHALL ser registradas normalmente, e o comentário na timeline SHALL informar quantos anexos não foram enviados por limite diário.
- **Robô "Enviar mensagem"**: cada parte de cada destinatário é verificada ao sair da fila. Os destinatários que não receberam por limite SHALL ser listados no comentário da timeline como não enviados por limite diário. Os demais destinatários SHALL ser atendidos normalmente.
- **Campanha de SMS**: a mensagem SHALL ter o status `failed` reportado ao Bitrix24.
- **Bot**: a fala SHALL NOT ser entregue ao contato. O motivo SHALL ficar registrado no log do processamento.

#### Scenario: Operador responde com o limite atingido
- **WHEN** a linha tem limite 300, já enviou 300 hoje, e um operador responde um cliente pelo canal aberto
- **THEN** a mensagem não é enviada ao WhatsApp
- **AND** o operador vê no chat o aviso de limite diário atingido
- **AND** a mensagem não é retentada

#### Scenario: Limite atingido enquanto a resposta do operador espera a cadência
- **WHEN** a resposta do operador aguarda uma janela da cadência e outra mensagem consome a última vaga do dia
- **THEN** a resposta do operador não é enviada
- **AND** o operador vê no chat o aviso de limite diário atingido

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
