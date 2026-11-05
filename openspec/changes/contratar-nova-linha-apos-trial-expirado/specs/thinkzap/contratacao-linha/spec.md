## ADDED Requirements

### Requirement: Instalação com trial expirado pode criar linha de qualquer conector
Quando a assinatura vigente da instalação está em `trial_expired`, o estado de assinatura SHALL informar `canCreateLine` verdadeiro, e a tela de conexões SHALL exibir a ação "Nova linha" com os planos de todos os conectores ofertáveis do catálogo. A decisão SHALL vir do servidor.

#### Scenario: Trial web expirado, cliente quer linha business
- **WHEN** a instalação tem uma linha `ZAPI` sob assinatura `trial_expired` e o cliente abre a tela de conexões
- **THEN** a ação "Nova linha" é exibida
- **AND** o catálogo da ação inclui planos do conector `HUBMESSAGE`

#### Scenario: Instalação sem nenhuma linha continua sem a ação
- **WHEN** a instalação não tem nenhuma linha
- **THEN** `canCreateLine` é falso e o primeiro uso segue pelo período de teste

#### Scenario: Assinatura manual (boleto) continua recusada
- **WHEN** a assinatura vigente é paga, `manual` e não é trial
- **THEN** `canCreateLine` é falso

### Requirement: Cliente escolhe se a linha do trial expirado entra na contratação
Ao criar uma linha com a assinatura vigente em `trial_expired`, o sistema SHALL permitir ao cliente escolher quais linhas do trial expirado entram no mesmo checkout. A linha nova SHALL sempre entrar. As linhas do trial expirado SHALL NOT entrar na cobrança quando o cliente não as escolheu, e o padrão é não escolhê-las.

#### Scenario: Só a linha nova é contratada
- **WHEN** o cliente cria uma linha `HUBMESSAGE` e não marca a linha `ZAPI` do trial expirado
- **THEN** a sessão de checkout carrega apenas o plano do conector `HUBMESSAGE`, com quantidade 1
- **AND** depois do pagamento a linha `ZAPI` do trial deixa de ser exibida, porque a assinatura de trial é encerrada
- **AND** para ter outra linha `ZAPI` o cliente cria uma nova

#### Scenario: Cliente inclui a linha do trial
- **WHEN** o cliente cria uma linha `HUBMESSAGE` e marca a linha `ZAPI` do trial expirado
- **THEN** a sessão de checkout carrega o plano `ZAPI` e o plano `HUBMESSAGE`, um de cada

#### Scenario: Trial ainda ativo mantém o comportamento atual
- **WHEN** a assinatura vigente está `trialing` e o cliente cria uma linha adicional
- **THEN** a linha do trial entra na cobrança no mesmo checkout, como hoje

### Requirement: Linha escolhida só é reativada depois do pagamento
A linha do trial expirado escolhida para a contratação SHALL permanecer bloqueada até a assinatura paga existir. Um checkout abandonado SHALL NOT alterar o estado de nenhuma linha.

#### Scenario: Checkout abandonado
- **WHEN** o cliente abre o checkout com a linha nova e fecha sem pagar
- **THEN** nenhuma linha muda de estado e a tela continua oferecendo "Nova linha" e "Assinar" (a linha do trial continua exibida e bloqueada)

### Requirement: Assinar por linha bloqueada oferece os planos do conector da linha
A ação "Assinar" de uma linha bloqueada SHALL continuar listando apenas os planos do conector dessa linha.

#### Scenario: Linha web bloqueada
- **WHEN** a linha `ZAPI` está bloqueada por trial expirado
- **THEN** "Assinar" nela oferece só planos do conector `ZAPI`
