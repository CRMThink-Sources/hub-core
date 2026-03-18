# Deploy - HubThink Core

## Arquitetura

```
Push develop  ──►  CI (lint/build)  ──►  Docker build  ──►  GHCR (:staging)  ──►  VPS (staging)
Push main     ──►  CI (lint/build)  ──►  Docker build  ──►  GHCR (:latest)   ──►  VPS (production)
```

## 1. Configurar Secrets no GitHub

Vá em **Settings → Environments** no repositório e crie dois environments: `staging` e `production`.

Em cada environment, adicione os seguintes secrets:

| Secret        | Descrição                                  | Exemplo                       |
| ------------- | ------------------------------------------ | ----------------------------- |
| `VPS_HOST`    | IP ou domínio da VPS                       | `142.93.xxx.xxx`              |
| `VPS_USER`    | Usuário SSH na VPS                         | `deploy`                      |
| `VPS_SSH_KEY` | Chave privada SSH (conteúdo do id_ed25519) | `-----BEGIN OPENSSH...`       |
| `ENV_API`     | Conteúdo completo do `.env` da API         | `PORT=4000\nDATABASE_URL=...` |
| `ENV_FRONT`   | Conteúdo completo do `.env` do front       | `NEXT_PUBLIC_API_URL=...`     |

## 2. Preparar a VPS

Execute estes comandos na VPS como root:

```bash
# Criar usuário de deploy
adduser deploy
usermod -aG docker deploy

# Instalar Docker (se ainda não tem)
curl -fsSL https://get.docker.com | sh
systemctl enable docker

# Configurar chave SSH
su - deploy
mkdir -p ~/.ssh
chmod 700 ~/.ssh
# Cole a chave PÚBLICA no authorized_keys:
echo "ssh-ed25519 AAAA..." >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

## 3. Gerar par de chaves SSH

No seu computador local:

```bash
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/hubthink_deploy
```

- **Chave pública** (`hubthink_deploy.pub`) → colocar no `~/.ssh/authorized_keys` da VPS
- **Chave privada** (`hubthink_deploy`) → colocar no secret `VPS_SSH_KEY` do GitHub

## 4. Como funciona

### Branches

| Branch    | Ambiente   | Tag Docker | Portas na VPS        |
| --------- | ---------- | ---------- | -------------------- |
| `develop` | staging    | `:staging` | front:3001, api:4001 |
| `main`    | production | `:latest`  | front:3000, api:4000 |

### Fluxo de trabalho

1. Desenvolva em feature branches
2. Abra PR para `develop` → CI roda lint e build
3. Merge em `develop` → Deploy automático para staging
4. Quando staging estiver OK, abra PR de `develop` → `main`
5. Merge em `main` → Deploy automático para produção

### Comandos úteis na VPS

```bash
# Ver status dos containers
cd ~/hubthink
docker compose ps

# Ver logs em tempo real
docker compose logs -f api
docker compose logs -f front

# Restart manual
docker compose restart api

# Deploy manual (pull + recreate)
docker compose pull && docker compose up -d
```
