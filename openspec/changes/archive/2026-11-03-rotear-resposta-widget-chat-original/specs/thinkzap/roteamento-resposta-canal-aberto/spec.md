# Spec Delta

## Purpose
Define como a resposta de um contato no WhatsApp (linha Z-API) é associada à conversa do canal aberto do Bitrix quando essa conversa foi aberta por uma mensagem enviada pelo widget do CRM, garantindo uma única conversa por contato.

## ADDED Requirements

### Requirement: Resposta que cita mensagem do widget cai na conversa já aberta
Quando uma mensagem recebida de um contato citar (`referenceMessageId`) uma mensagem enviada pelo widget cuja conversa no canal aberto já foi aberta, o sistema SHALL postar a resposta nessa mesma conversa, usando o mesmo identificador de chat (`chat.id`) gravado no envio, e SHALL NOT abrir uma nova conversa. Isso SHALL valer mesmo que a identidade resolvida para o contato no recebimento (LID) seja diferente do identificador gravado no envio (telefone).

#### Scenario: Resposta de botão após envio que caiu em identidade de telefone
- **WHEN** o operador envia pelo widget uma mensagem com botões, a conversa do canal aberto é aberta com `chat.id` igual ao telefone do contato, e o contato responde tocando num botão cuja mensagem cita a mensagem enviada, com o LID do contato no payload
- **THEN** a resposta é postada na conversa já aberta, com o `chat.id` do envio, e nenhuma nova sessão é criada no Bitrix

#### Scenario: Citação de mensagem sem conversa aberta
- **WHEN** o contato responde citando uma mensagem enviada pelo widget cuja conversa no canal aberto não foi aberta (canal não vinculado, opção desligada ou abertura falhou)
- **THEN** a resposta segue a identidade resolvida normalmente, como antes desta mudança

#### Scenario: Citação de mensagem que não é do widget
- **WHEN** o contato cita uma mensagem que o sistema não conhece ou que não carrega referência de conversa do canal aberto
- **THEN** a resposta segue a identidade resolvida normalmente e a citação continua servindo apenas para exibir o trecho citado

### Requirement: Identidade do contato fixada na conversa existente
Ao rotear uma resposta para a conversa já aberta e o identificador dessa conversa for diferente da identidade resolvida no recebimento, o sistema SHALL fixar para esse contato (LID) o identificador da conversa existente, de modo que as mensagens seguintes do mesmo contato, mesmo sem citação, sejam postadas na mesma conversa. O sistema SHALL fixar a identidade apenas quando existir uma conversa real aberta para ela, e SHALL NOT sobrescrever uma identidade já fixada para o mesmo contato.

#### Scenario: Mensagem seguinte sem citação
- **WHEN** a resposta do contato foi roteada para a conversa existente e o contato envia, em seguida, uma nova mensagem sem citar nada
- **THEN** a nova mensagem é postada na mesma conversa, e não em uma nova sessão

#### Scenario: Identidade já fixada não é sobrescrita
- **WHEN** o contato já tem uma identidade fixada e uma nova resposta cita uma mensagem de outra conversa do widget
- **THEN** a identidade fixada anteriormente é mantida e o fato é registrado no log do job

#### Scenario: Identidade igual à da conversa
- **WHEN** a identidade resolvida no recebimento já é igual ao identificador da conversa aberta pelo widget
- **THEN** nenhuma fixação é gravada e a resposta é postada normalmente

### Requirement: Resolução de identidade sem LID no envio é registrada
Quando a identidade do contato no envio pelo widget cair no telefone por não ter sido resolvido nenhum LID, o job de abertura de conversa SHALL registrar no log que a identidade ficou instável e qual elo da cadeia falhou, para que o caso seja diagnosticável sem inspeção do banco.

#### Scenario: Cadeia sem LID no envio
- **WHEN** o widget envia uma mensagem a um número cujo LID não está no mapa e que a consulta ao provider não devolve LID
- **THEN** o log do job de abertura registra que a identidade usada foi o telefone e que o contato pode duplicar a conversa na resposta

### Requirement: Número brasileiro sem o 9º dígito é consultado nas duas formas
Ao consultar o provider para obter o LID de um telefone brasileiro (`55` + DDD + 9 + 8 dígitos), quando a consulta com o número normalizado não devolver LID, o sistema SHALL consultar também a forma sem o 9º dígito antes de desistir de resolver o LID.

#### Scenario: Contato cadastrado sem o 9
- **WHEN** o operador digita o número com o 9º dígito e o WhatsApp do contato está cadastrado sem ele, de modo que a consulta com o 9 não devolve LID mas a consulta sem o 9 devolve
- **THEN** o LID devolvido pela segunda consulta é usado como identidade do contato no envio
