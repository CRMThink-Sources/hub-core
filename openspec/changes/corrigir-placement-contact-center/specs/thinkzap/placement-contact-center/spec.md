# Spec Delta

## Purpose

Define a tela que o Bitrix24 abre ao configurar o conector ThinkZap pelo Contact Center: como ela se autentica dentro do iframe do placement, quais linhas oferece e como vincula uma linha ao canal aberto de onde foi aberta.

## ADDED Requirements

### Requirement: Endereço do handler preservado
A tela SHALL continuar respondendo no mesmo endereço registrado como handler do conector (`/thinkzap/connector`), para que instalações existentes funcionem sem re-registrar o conector no Bitrix24.

#### Scenario: Instalação antiga abre a tela
- **WHEN** o administrador abre a configuração do conector ThinkZap no Contact Center de um portal instalado antes desta mudança
- **THEN** o Bitrix24 carrega a tela pelo endereço já registrado e ela abre normalmente

### Requirement: Autenticação própria no placement
A tela SHALL se autenticar com o backend a partir do contexto do BX24 do placement antes de qualquer chamada à API, sem depender de token gravado por outra tela do app. A tela SHALL NOT exibir a navegação lateral nem as telas internas do app ThinkZap.

#### Scenario: Primeira abertura sem sessão prévia
- **WHEN** o placement é aberto num iframe sem token salvo no navegador
- **THEN** a tela mostra um indicador de carregamento, autentica, e em seguida lista as linhas — sem nenhum erro não tratado no console

#### Scenario: Falha de autenticação
- **WHEN** a autenticação com o backend falha
- **THEN** a tela mostra a mensagem de erro retornada e não tenta listar linhas

#### Scenario: Aberta fora do Bitrix24
- **WHEN** o endereço é aberto diretamente no navegador, fora de um iframe do Bitrix24
- **THEN** a tela informa que deve ser aberta pelo Bitrix24 e não lança erro

### Requirement: Listagem das linhas da instalação
Depois de autenticada, a tela SHALL listar as linhas ativas da instalação, identificando cada uma pelo número e nome do WhatsApp quando disponíveis, ou pelo nome da linha caso contrário. Quando uma linha já estiver vinculada ao canal aberto do placement, a tela SHALL indicá-la como a linha atual desse canal.

#### Scenario: Instalação com linhas
- **WHEN** a instalação tem linhas ativas
- **THEN** a tela oferece cada uma para seleção

#### Scenario: Canal aberto já vinculado
- **WHEN** uma linha da instalação já está vinculada ao canal aberto de onde a tela foi aberta
- **THEN** a tela mostra essa linha como vinculada a este canal e a pré-seleciona

#### Scenario: Instalação sem linhas
- **WHEN** a instalação não tem linhas ativas
- **THEN** a tela informa que não há números disponíveis e não exibe o botão de vincular

#### Scenario: Usuário sem permissão de leitura de conexões
- **WHEN** o usuário do Bitrix24 não tem permissão de leitura de conexões do ThinkZap
- **THEN** a tela mostra a mensagem de falta de permissão em vez da lista

### Requirement: Vincular linha ao canal aberto
Ao confirmar a seleção, a tela SHALL vincular a linha escolhida ao canal aberto identificado pelo placement, usando o mesmo vínculo da tela de configuração da linha: o conector é ativado no canal aberto do Bitrix24 e o vínculo é gravado na linha. A tela SHALL mostrar sucesso apenas depois que o backend confirmar o vínculo.

#### Scenario: Vínculo com sucesso
- **WHEN** o usuário seleciona uma linha e clica em "Vincular"
- **THEN** o conector fica ativo naquele canal aberto, a linha passa a ter o canal como vinculado, e a tela mostra a confirmação

#### Scenario: Canal já pertence a outra linha
- **WHEN** o usuário tenta vincular uma linha a um canal aberto que já é de outra linha ativa
- **THEN** o vínculo não é feito e a tela mostra a mensagem do backend indicando a linha que ocupa o canal

#### Scenario: Usuário sem permissão de edição
- **WHEN** o usuário não tem permissão de edição de conexões do ThinkZap
- **THEN** o vínculo não é feito e a tela mostra a mensagem de falta de permissão

#### Scenario: Falha na ativação do conector
- **WHEN** a ativação do conector no Bitrix24 falha
- **THEN** o vínculo não é gravado e a tela mostra o erro, mantendo a seleção para nova tentativa

#### Scenario: Placement sem canal aberto identificado
- **WHEN** o placement não informa o canal aberto
- **THEN** o botão "Vincular" fica desabilitado e a tela explica que o canal não foi identificado
