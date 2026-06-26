# auth-service

Serviço de Autenticação/Usuário do sistema de chat distribuído.
Node.js + TypeScript + Express + PostgreSQL (`pg`) + `bcryptjs` + `jsonwebtoken`.

## Endpoints

Base via gateway: `/api/auth` e `/api/users`.

| Método | Rota | Auth | Resposta |
|---|---|---|---|
| POST | `/api/auth/register` | — | 201 `{id, username}` / 409 / 400 |
| POST | `/api/auth/login` | — | 200 `{token, user:{id,username}}` / 401 |
| GET | `/api/auth/me` | Bearer | 200 `{id, username}` / 401 |
| GET | `/api/users` | Bearer | 200 `[{id, username}, ...]` (todos menos o próprio) |
| GET | `/health` | — | 200 `{status:"ok"}` |

JWT payload: `{ sub: <userId>, username: <username> }`, assinado com `JWT_SECRET`,
expiração `JWT_EXPIRES_IN` (padrão `1d`). IDs de usuário são UUIDs.

## Variáveis de ambiente

Veja `.env.example`:

- `PORT` (padrão `4000`)
- `DATABASE_URL` (ex.: `postgres://chat:chat@postgres:5432/chatdb`)
- `JWT_SECRET` (obrigatório)
- `JWT_EXPIRES_IN` (padrão `1d`)

## Rodar localmente

```bash
npm install
cp .env.example .env     # ajuste DATABASE_URL e JWT_SECRET
npm run dev              # hot-reload (tsx)
```

Build de produção:

```bash
npm run build
npm start
```

A tabela `users` é criada automaticamente na inicialização (migração idempotente,
com retry de conexão ao Postgres).

## Testes

Os testes rodam sem Postgres (o repositório é mockado):

```bash
npm test
npm run test:coverage
```

## Docker

```bash
docker build -t auth-service .
docker run -p 4000:4000 \
  -e DATABASE_URL=postgres://chat:chat@host.docker.internal:5432/chatdb \
  -e JWT_SECRET=change-me \
  auth-service
```
