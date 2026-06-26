/**
 * Teste de Integração ponta-a-ponta — exercita os DOIS microsserviços juntos,
 * exatamente o caso citado no PDF: "Autenticar e, em seguida, enviar uma mensagem".
 *
 * Fluxo:
 *   1. auth-service: registra/loga Alice e Bob (emite JWT);
 *   2. chat-service: com o JWT do auth, cria conversa direta (1:1), conecta os
 *      sockets, Alice envia mensagem e Bob a recebe em TEMPO REAL;
 *   3. chat-service REST: confirma que a mensagem foi PERSISTIDA no histórico;
 *   4. Testa também o caso 1:N (grupo) com um terceiro usuário.
 *
 * Requer a stack no ar:  docker compose up --build
 * Uso:  npm run e2e
 */
import { ensureUser, connectSocket, randomSuffix, sleep } from "./helpers";

const run = randomSuffix();
let failures = 0;

function check(name: string, ok: boolean) {
  console.log(`  ${ok ? "✓" : "✗"} ${name}`);
  if (!ok) failures++;
}

async function waitFor<T>(fn: () => T | undefined, ms = 8000): Promise<T> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const v = fn();
    if (v !== undefined) return v;
    await sleep(100);
  }
  throw new Error("timeout aguardando condição");
}

async function main() {
  console.log("\n=== Teste de Integração ponta-a-ponta (auth ⇄ chat) ===\n");

  // 1) Autenticação (auth-service) -------------------------------------------
  console.log("[1] Autenticação no auth-service");
  const alice = await ensureUser(`e2e_${run}_alice`);
  const bob = await ensureUser(`e2e_${run}_bob`);
  const carol = await ensureUser(`e2e_${run}_carol`);
  check("Alice obteve token JWT", !!alice.token);
  check("Bob obteve token JWT", !!bob.token);

  // auth: lista de usuários autenticada
  const { data: users } = await alice.http.get("/users");
  check("GET /api/users retornou outros usuários", Array.isArray(users) && users.length >= 2);
  check("Lista não inclui o próprio requester", !users.some((u: any) => u.id === alice.id));

  // 2) Conexão WebSocket usando o token do auth (integração entre serviços) ---
  console.log("\n[2] Conexão WebSocket no chat-service usando o JWT do auth-service");
  const aliceSock = await connectSocket(alice);
  const bobSock = await connectSocket(bob);
  check("Socket de Alice conectado (JWT aceito pelo chat)", aliceSock.connected);
  check("Socket de Bob conectado", bobSock.connected);

  // token inválido deve ser rejeitado
  let rejected = false;
  await new Promise<void>((resolve) => {
    const bad = require("socket.io-client").io(process.env.GATEWAY_URL ?? "http://localhost:8080", {
      path: "/socket.io",
      auth: { token: "token-invalido" },
      transports: ["websocket"],
      reconnection: false,
    });
    bad.on("connect_error", () => {
      rejected = true;
      bad.close();
      resolve();
    });
    bad.on("connect", () => {
      bad.close();
      resolve();
    });
    setTimeout(resolve, 4000);
  });
  check("Conexão com JWT inválido é rejeitada", rejected);

  // 3) Conversa direta 1:1 + entrega em tempo real ---------------------------
  console.log("\n[3] Mensagem 1:1 em tempo real + persistência");
  const { data: dm } = await alice.http.post("/conversations", {
    type: "direct",
    participantIds: [bob.id],
  });
  check("Conversa direta criada", dm.type === "direct");

  // reuso: criar de novo deve devolver a MESMA conversa
  const { data: dm2 } = await alice.http.post("/conversations", {
    type: "direct",
    participantIds: [bob.id],
  });
  check("Conversa direta é reutilizada (sem duplicar)", dm2.id === dm.id);

  aliceSock.emit("conversation:join", { conversationId: dm.id });
  bobSock.emit("conversation:join", { conversationId: dm.id });
  await sleep(300);

  let bobReceived: any;
  bobSock.on("message:new", (m: any) => {
    if (m.conversationId === dm.id) bobReceived = m;
  });

  const content = `oi bob ${run}`;
  aliceSock.emit("message:send", { conversationId: dm.id, content });

  const got = await waitFor(() => bobReceived);
  check("Bob recebeu a mensagem em tempo real", got.content === content);
  check("Mensagem traz o username do remetente", got.senderUsername === alice.username);

  // 3b) persistência no histórico (REST) -------------------------------------
  await sleep(300);
  const { data: history } = await bob.http.get(`/conversations/${dm.id}/messages`);
  check("Mensagem persistida no histórico (MongoDB)", history.some((m: any) => m.content === content));

  // 4) Conversa em grupo 1:N --------------------------------------------------
  console.log("\n[4] Mensagem 1:N (grupo) em tempo real");
  const carolSock = await connectSocket(carol);
  const { data: group } = await alice.http.post("/conversations", {
    type: "group",
    name: `Grupo ${run}`,
    participantIds: [bob.id, carol.id],
  });
  check("Grupo criado com 3 participantes", group.participantIds.length === 3);

  [aliceSock, bobSock, carolSock].forEach((s) =>
    s.emit("conversation:join", { conversationId: group.id }),
  );
  await sleep(300);

  let bobGroupMsg: any;
  let carolGroupMsg: any;
  bobSock.on("message:new", (m: any) => {
    if (m.conversationId === group.id) bobGroupMsg = m;
  });
  carolSock.on("message:new", (m: any) => {
    if (m.conversationId === group.id) carolGroupMsg = m;
  });

  const gContent = `olá grupo ${run}`;
  aliceSock.emit("message:send", { conversationId: group.id, content: gContent });

  await waitFor(() => (bobGroupMsg && carolGroupMsg ? true : undefined));
  check("Bob recebeu a mensagem do grupo", bobGroupMsg?.content === gContent);
  check("Carol recebeu a mensagem do grupo (1:N)", carolGroupMsg?.content === gContent);

  // 5) Authz: estranho não acessa histórico alheio ---------------------------
  console.log("\n[5] Autorização");
  const stranger = await ensureUser(`e2e_${run}_stranger`);
  let forbidden = false;
  try {
    await stranger.http.get(`/conversations/${dm.id}/messages`);
  } catch (err: any) {
    forbidden = err?.response?.status === 403;
  }
  check("Não-participante recebe 403 ao ler conversa alheia", forbidden);

  [aliceSock, bobSock, carolSock].forEach((s) => s.close());

  console.log(`\n=== ${failures === 0 ? "✅ TODOS os testes de integração passaram" : `❌ ${failures} verificação(ões) falharam`} ===\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Erro no teste de integração:", err?.message ?? err);
  process.exit(1);
});
