# Testes de Concorrência/Carga e Integração

Estes testes exercitam o sistema **completo e em execução** (via Docker Compose),
através do gateway NGINX — provando integração entre os microsserviços, entrega
em tempo real, persistência e balanceamento de carga.

> Pré-requisito: a stack precisa estar no ar.
> Na raiz do projeto: `docker compose up --build`

## Instalação

```bash
cd load-tests
npm install
```

## Scripts

| Comando | O que faz | Requisito do PDF |
|---|---|---|
| `npm run e2e` | Integração ponta-a-ponta: autentica no `auth-service` e, com o JWT, envia/recebe mensagens 1:1 e 1:N no `chat-service`, valida persistência e autorização. | Testes de Integração |
| `npm run load` | Simula **12 usuários simultâneos** (configurável) logando e trocando mensagens em rajada num grupo 1:N; mede latência e taxa de entrega. | Teste de Concorrência/Carga (≥10 usuários) |
| `npm run lb` | Dispara muitas requisições via gateway e mostra a distribuição entre `chat-service-1` e `chat-service-2`. | Balanceamento de carga / Escalabilidade |

## Parâmetros (variáveis de ambiente)

```bash
# Mais usuários e mensagens no teste de carga
USERS=20 MSGS=10 npm run load

# Apontar para outro host/porta do gateway
GATEWAY_URL=http://localhost:8080 npm run e2e

# Número de requisições na checagem de LB
REQUESTS=100 npm run lb
```

Os scripts saem com código `0` em sucesso e `1` em falha, podendo ser usados em CI.
