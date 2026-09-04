# AM Marketing — App de Requisições de Itens do Marketing (Grupo Alcina Maria)

Você é um engenheiro full-stack sênior e designer de produto. Construa, do zero, o web app descrito abaixo. Trabalhe de forma autônoma: **não faça perguntas antes de começar** — todas as decisões relevantes já estão tomadas na seção 14. Se encontrar um bloqueio real, escolha a alternativa mais simples que respeite as restrições da seção 2 e registre o motivo em `DECISIONS.md`.

Idioma de toda a interface, textos, mensagens do Slack, README e commits: **português do Brasil**. Código, nomes de variáveis e identificadores: inglês.

---

## 1. Contexto

- **Empresa:** Grupo Alcina Maria — rede de lojas franqueadas O Boticário (marca ACQUA) em Alagoas. ~110 colaboradores usam Slack (plano pago da empresa).
- **Problema:** o setor de Marketing tem itens físicos usados em ações nas cidades das lojas — carrinho do marketing, tenda, mesas, cadeiras, bancada, etc. Hoje ninguém sabe quem está com cada item, para qual ação, em qual cidade, por quantos dias, nem se o item estará livre numa data futura.
- **Solução:** um app web onde qualquer colaborador escolhe o próprio nome, vê os itens disponíveis (e a agenda de cada um) e abre uma **requisição**: quais itens, para que serão usados, em qual cidade e em qual período. A administradora do Marketing — **Suzana Martins Tavares, Slack ID `U09F9LWM6MC`** — aprova ou reprova pelo **Slack** (botões na mensagem) ou pelo **painel admin** do app. O solicitante recebe a decisão **no app** (tempo real) e **no Slack**. Cada requisição é um ticket privado entre o solicitante e a administradora, com histórico e chat.
- **Nome do produto:** **AM Marketing** (subtítulo: "Requisições de materiais"). A logo está em `./logo-am.png` (monograma "AM" em dourado, fundo transparente) — copie para `frontend/public/` e gere favicon e ícones PWA a partir dela (com fundo escuro arredondado).

## 2. Restrições inegociáveis

1. **Custo zero.** Frontend em **Render Static Site (free)**; backend em **Render Web Service (free)**; banco **Firebase Firestore no plano Spark (free)** + **Firebase Authentication (login anônimo, free)**. Proibido: Cloud Functions, Firebase Storage, plano Blaze, qualquer serviço que exija cartão de crédito. APIs externas só se forem gratuitas e sem chave paga (OpenStreetMap/Photon/CARTO tiles).
2. **Slack** via Slack App (bot) — gratuito no workspace pago da empresa.
3. **Sem cadastro/senha para usuários comuns:** a pessoa escolhe o nome numa lista (Apêndice A). Só a administradora tem PIN.
4. **Mobile-first e responsivo** — muitas requisições serão feitas pelo celular.
5. **Fuso horário `America/Maceio`**, datas em `dd/MM/yyyy`, moeda/números em pt-BR.
6. Segredos **apenas** em variáveis de ambiente. Nunca commitar tokens. Fornecer `.env.example` em cada pacote.
7. Nunca inventar componentes do React Bits: usar apenas os que existem no catálogo real (verificar no site). Se um componente não existir, implementar equivalente com `framer-motion`.

## 3. Arquitetura

```
┌──────────────────────────────┐        onSnapshot (tempo real)        ┌──────────────────────┐
│  FRONTEND (React + Vite)     │◄────────────────────────────────────►│  FIRESTORE (Spark)    │
│  Render Static Site          │  cria requisições / eventos direto   │  users, items,        │
│  Auth anônimo do Firebase    │──────────────────────────────────────►│  requests, settings   │
└──────────────┬───────────────┘                                       └──────────▲───────────┘
               │ /admin/* (PIN → token)                                            │ Admin SDK
               ▼                                                                   │ (listeners + writes)
┌──────────────────────────────┐   chat.postMessage / chat.update      ┌──────────┴───────────┐
│  BACKEND (Node + Slack Bolt) │──────────────────────────────────────►│        SLACK          │
│  Render Web Service (free)   │◄──────────────────────────────────────│  DM da Suzana (botões)│
│  /health  /slack/events      │   interações (botões, modal)          │  DM do solicitante    │
└──────────────────────────────┘                                       └──────────────────────┘
```

**Por que assim:**
- O frontend fala **direto com o Firestore** para leitura em tempo real e para criar requisições/mensagens. Assim a experiência nunca depende do backend estar acordado (o Render free adormece após ~15 min sem tráfego).
- O backend é a **ponte com o Slack** e o **guardião das ações privilegiadas** (aprovar, reprovar, devolver, CRUD de itens), usando o Firebase Admin SDK. Ele mantém listeners no Firestore para disparar notificações de novas requisições e novas mensagens, e faz *catch-up* ao iniciar (processa tudo que ficou pendente enquanto dormia).
- Toda mudança de **status** passa pelo backend (via Slack ou via painel admin), então as regras do Firestore podem proibir que clientes alterem `status`.

## 4. Stack

**Frontend (`/frontend`)**
- Vite + React 18 + TypeScript (strict) + Tailwind CSS + `framer-motion`.
- **React Bits** (https://reactbits.dev) instalado via CLI do shadcn (`npx shadcn@latest add @react-bits/<Componente>-TS-TW`) ou jsrepo — siga exatamente a página https://reactbits.dev/get-started/installation para configurar o registry em `components.json`. Os componentes ficam versionados no repositório (`src/components/reactbits/`) e podem ser customizados.
- `lucide-react` (ícones) + um conjunto pequeno de **ícones SVG de linha fina próprios** para os itens principais (tenda, mesa, cadeira, bancada, carrinho), no mesmo estilo de traço contínuo do monograma.
- `react-day-picker` v9 + `date-fns` (locale `pt-BR`) como base do calendário, totalmente re-estilizado e animado.
- `react-leaflet` + `leaflet` com tiles escuros gratuitos (CARTO "dark_all", com atribuição) e geocodificação gratuita via **Photon** (`https://photon.komoot.io/api/`) com fallback para Nominatim (respeitando 1 req/s e `User-Agent`).
- `firebase` (SDK modular v10+): Firestore + Auth anônimo.
- `react-router-dom`, `zustand` (estado da identidade e do wizard), `sonner` (toasts), `@fontsource` para fontes (sem chamadas externas).
- `vite-plugin-pwa` (instalável no celular; ícones gerados da logo).
- `vitest` para testes unitários da lógica de disponibilidade.

**Backend (`/backend`)**
- Node 20 + TypeScript + `@slack/bolt` com `ExpressReceiver` (verificação de assinatura embutida; rotas customizadas `/health` e `/admin/*` no mesmo Express).
- `firebase-admin` (service account em base64 na env `FIREBASE_SERVICE_ACCOUNT_B64`).
- `zod` para validar payloads, `cors` restrito à URL do app.

**Repositório:** monorepo simples com `frontend/`, `backend/`, `render.yaml`, `slack-manifest.yaml`, `firestore.rules`, `README.md`, `DECISIONS.md`.

## 5. Identidade visual e design ("design insano", mas usável)

A logo é um monograma "AM" em dourado degradê, traço fino e contínuo, elegante. O app deve parecer uma **extensão premium dessa logo**: escuro, dourado, vidro, luz e movimento — sem virar carnaval.

**Tokens (Tailwind `theme.extend`):**
- Fundo: `onyx-950 #0B0B0D` (base), `onyx-900 #121216` (superfície), `onyx-800 #1A1A20` (elevado), bordas `rgba(206,161,92,0.18)`.
- Dourado (extraído da logo): `gold-300 #F3D28C`, `gold-400 #E2B96F`, `gold-500 #CEA15C` (principal), `gold-600 #B8894A`, `gold-700 #A5793D`, `gold-800 #7E5C2C`. Gradiente da marca: `linear-gradient(135deg, #F3D28C 0%, #CEA15C 45%, #A5793D 100%)`.
- Texto: `ivory #F5F1EA`, `muted #A8A39A`.
- Status: pendente = dourado (contorno), aprovada = `#34D399`, reprovada = `#F43F5E`, cancelada = `#71717A`, devolvida = `#60A5FA`.
- Tipografia: display **Cormorant Garamond** (títulos, números grandes, itálico em destaques) + UI **Manrope** (corpo, botões, formulários), números tabulares nas métricas.
- Superfícies em vidro (glassmorphism): `backdrop-blur`, borda dourada 1px a 18% de opacidade, brilho sutil no topo. Ruído fino (React Bits **Noise**) em baixa opacidade sobre os fundos.

**Motion (princípios):** rápido e intencional (150–350 ms), springs suaves nos cards, stagger de 40–60 ms em listas, transições de página com `AnimatePresence`. Respeitar `prefers-reduced-motion` (desligar WebGL e reduzir animações). Fundos WebGL só onde impressionam (tela de identidade e hero da home), sempre `lazy` e com fallback de gradiente.

**Mapa sugerido de componentes React Bits por tela** (confirme os nomes no catálogo; substitua por equivalente em framer-motion se não existir):
- Tela de identidade: fundo **Silk** ou **Aurora** (tons dourado/onyx) ou **Light Rays**; título com **Split Text** / **Blur Text**; logo com brilho **Shiny Text**-like (CSS); lista de nomes com **Animated List** e busca.
- Home/catálogo: cards de itens com **Spotlight Card** ou **Magic Bento**; **Glare Hover** no hover (desktop); **Count Up** nas métricas; **Gradient Text** em títulos-chave.
- Navegação: **Dock** na base (mobile) e **Pill Nav** ou **Gooey Nav** (desktop).
- Wizard de requisição: **Stepper**; **Click Spark** nos botões; **Magnet** no botão final; **Star Border** ou **Electric Border** no CTA principal.
- Ticket/timeline: **Animated Content** e **Fade Content** na entrada; **Animated List** no histórico.
- Admin: **Counter** / **Count Up** no dashboard; **Chroma Grid** ou **Tilted Card** (só desktop) nos itens.
- Feedback de sucesso: **Click Spark** + confete leve em dourado.
- Ferramenta útil: https://reactbits.dev tem o "Background Studio" para ajustar o fundo antes de copiar o código.

**Detalhes que fazem diferença:** avatares com iniciais em dourado; skeletons com shimmer dourado; empty states com ilustração em linha dourada; cursor **Target Cursor** ou **Splash Cursor** apenas no desktop e desligável; ícone do item sempre visível (card, chip, ticket, mensagem do Slack).

## 6. Modelo de dados (Firestore)

Datas de período são **strings `YYYY-MM-DD`** (granularidade de dia; evita bugs de fuso). Timestamps de auditoria em `Timestamp`. Tipos compartilhados em `shared/types.ts` (copiado ou linkado em ambos os pacotes).

```ts
// users/{slackId}
{ slackId: string; name: string; role: 'admin' | 'requester'; active: boolean; createdAt }

// items/{itemId}
{ name: string; slug: string; category: string;            // ex.: "Estrutura", "Mobiliário", "Ativação"
  icon: string;                                             // chave do ícone (lucide ou custom)
  emoji?: string; imageUrl?: string;                        // imagem só por URL externa (sem Storage)
  description: string; quantity: number;                    // unidades existentes
  attributes: { label: string; value: string }[];           // características dinâmicas (dimensões, cor, peso…)
  storageLocation?: string; tags: string[]; active: boolean;
  createdAt; updatedAt; createdBy: string }

// requests/{requestId}
{ number: number;                                           // sequencial legível: #0042
  requesterId: string; requesterName: string;
  items: { itemId: string; itemName: string; icon: string; quantity: number }[];
  purposeType: 'Evento' | 'Ativação em loja' | 'Feira/Exposição' | 'Blitz' | 'Treinamento/Reunião' | 'Outro';
  purpose: string;                                          // texto livre obrigatório
  city: { name: string; state: string; lat: number; lng: number; displayName: string };
  locationDetail?: string;                                  // ex.: "Loja Arapiraca Shopping"
  startDate: string; endDate: string; days: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'returned';
  decision?: { by: string; byName: string; at; note?: string; channel: 'slack' | 'app' };
  returnedAt?; cancelledAt?;
  slack: { adminChannel?: string; adminMessageTs?: string };   // para chat.update e thread
  notify: { adminPending: boolean };                        // true ao criar; backend zera após avisar
  unread: { admin: number; requester: number };
  createdAt; updatedAt }

// requests/{requestId}/events/{eventId}   (timeline + chat unificados)
{ type: 'created' | 'approved' | 'rejected' | 'cancelled' | 'returned' | 'message';
  authorId: string; authorName: string; authorRole: 'admin' | 'requester';
  text?: string; meta?: Record<string, unknown>;
  notify: { pending: boolean };                             // backend encaminha ao Slack e zera
  createdAt }

// settings/app
{ adminSlackId: 'U09F9LWM6MC'; appUrl: string;
  cities: { name: string; state: string; lat: number; lng: number }[];   // cidades frequentes
  purposeTypes: string[] }

// settings/counters
{ requests: number }
```

## 7. Regras de disponibilidade (coração do app — cobrir com testes)

- Para um item `i` e um dia `d`: `used(i, d)` = soma das quantidades de `i` em requisições com `status == 'approved'` **e sem `returnedAt`**, cujo período contém `d`. `available(i, d) = item.quantity - used(i, d)`.
- Requisições `pending` **não bloqueiam**, mas aparecem como **pré-reserva** (visual diferente) e são listadas como conflito potencial para a administradora.
- Um período é válido para a requisição se, para **todos** os itens selecionados e **todos** os dias do intervalo, `available ≥ quantidadePedida`.
- Devolução antecipada (`returned`) libera o item a partir do dia da devolução.
- Cálculo no cliente (`frontend/src/lib/availability.ts`) a partir de uma query em tempo real de `requests` com `status in ['pending','approved']` e `endDate >= hoje - 60 dias` (limita leituras no plano Spark). O backend reutiliza a mesma função pura (copiada em `shared/`) para revalidar no momento da aprovação e sinalizar conflito.
- Testes unitários (`vitest`): sobreposição de intervalos, múltiplos itens, quantidades parciais, devolução antecipada, pendentes não bloqueando.

## 8. Telas e fluxos

### 8.1 Identidade (rota `/`)
Fundo WebGL dourado/onyx, logo grande, "Quem é você?" e uma busca por nome (lista do Apêndice A, com avatar de iniciais e busca tolerante a acentos). Ao escolher, salvar em `localStorage` e entrar. Se o usuário for `admin` (Suzana), pedir o **PIN** (validado no backend, ver seção 10); a admin pode usar o app tanto como administradora quanto como solicitante. Botão discreto "Trocar de pessoa" no menu.

### 8.2 Home / Catálogo (`/itens`)
- Header com saudação ("Boa tarde, Rafaela") e métricas animadas: itens disponíveis hoje, minhas requisições em aberto, ações acontecendo esta semana.
- Grid de cards (Spotlight/Magic Bento) com ícone do item, nome, categoria, características principais e um **anel de disponibilidade** ("3 de 4 livres hoje"). Badge de status: "Disponível", "Em uso até 12/09 (Penedo)", "Pré-reservado".
- Filtro por categoria, busca, ordenação. Clique no card → drawer com detalhes, agenda do item (quem está com ele, onde, até quando) e botão "Requisitar".
- CTA fixo "Nova requisição".

### 8.3 Nova requisição (`/nova`) — wizard com Stepper, 5 passos
1. **Itens** — seleção múltipla com quantidade (stepper +/−), ícones grandes, disponibilidade em tempo real; itens indisponíveis hoje continuam selecionáveis (a data decide).
2. **Finalidade** — chips de `purposeType` + campo de texto obrigatório ("Para que vai usar?") com contador e placeholder inspirador.
3. **Cidade** — input com autocomplete (Photon, resultados restritos ao Brasil e priorizados por proximidade de Alagoas; `debounce` 300 ms) + chips de "cidades frequentes" (de `settings/app.cities`). Ao escolher, o mapa (Leaflet, tiles escuros) faz `flyTo` com um **marcador dourado pulsante**. Campo opcional "Local/loja". Se o geocoder falhar, permitir digitar só o nome (sem pino).
4. **Período** — calendário customizado (react-day-picker re-estilizado): seleção de intervalo por toque, navegação de mês animada, presets ("Hoje", "Este fim de semana", "Próxima semana"). Cada dia recebe um estado calculado para os itens/quantidades escolhidos: **livre**, **pré-reserva pendente** (aviso), **bloqueado** (item já aprovado para outra pessoa). Ao tentar incluir um dia bloqueado: animação de "shake" + mensagem explicando o conflito ("Tenda 3x3 indisponível em 09/09 — com Rafaela, em Penedo"). Mostrar duração ("3 dias") com Count Up.
5. **Revisão** — resumo bonito (itens com ícones, finalidade, cidade com mini-mapa, período), aviso se houver pré-reservas concorrentes, botão "Enviar requisição" (Magnet + Click Spark). Ao enviar: transação no Firestore incrementa `settings/counters.requests`, cria `requests/{id}` com `status: 'pending'`, `notify.adminPending: true`, e o evento `created`. Tela de sucesso com o número do ticket e confete dourado.

O estado do wizard persiste em `sessionStorage` (não perder ao recarregar). Validação por passo; não avançar com erro.

### 8.4 Minhas requisições (`/requisicoes`) e Ticket (`/requisicoes/:id`)
- Lista (Animated List) com número, itens (ícones), cidade, período, chip de status colorido, contador de não lidas. Filtros por status. Tempo real via `onSnapshot`.
- Ticket: cabeçalho com status grande, dados da requisição, mini-mapa, **timeline** vertical animada (`events`) e **chat** com a administradora (input na base). Mensagens do solicitante criam `events` do tipo `message` com `notify.pending: true`. Solicitante pode **cancelar** enquanto `pending`.
- Ao mudar o status (aprovada/reprovada) o app mostra toast + badge no sino + atualização instantânea do ticket. Opcional: Web Notifications API com permissão do usuário.
- Cada solicitante só vê os próprios tickets no menu; a administradora vê todos.

### 8.5 Agenda (`/agenda`)
Visão mensal (calendário) e visão "linha do tempo" por item (barras por período, estilo Gantt leve, com avatar de quem está com o item e cidade). Serve para todo mundo planejar antes de pedir.

### 8.6 Painel admin (`/admin`, só Suzana com PIN)
- **Fila de aprovação:** cards das pendentes com análise de conflito (verde/amarelo/vermelho), botões Aprovar (nota opcional) e Reprovar (motivo obrigatório). Aprovar com conflito exige confirmação explícita.
- **Em uso:** aprovadas ativas com botão "Marcar como devolvido" (libera disponibilidade).
- **Itens:** CRUD completo — nome, categoria, quantidade, descrição, ícone (seletor com busca entre lucide + ícones próprios, com preview), emoji opcional, URL de imagem opcional, **características dinâmicas** (lista label/valor adicionável), local de guarda, ativo/inativo.
- **Configurações:** cidades frequentes (com busca no geocoder para pegar lat/lng), tipos de finalidade.
- **Dashboard:** contadores animados (pendentes, aprovadas no mês, item mais requisitado, cidades atendidas) e **mapa de ativações** com pinos das requisições aprovadas ativas/próximas.
- Todas as ações privilegiadas chamam o backend (`/admin/*`); o app apenas reflete o Firestore em tempo real.

## 9. Integração com Slack (bot "AM Marketing")

**Slack App:** entregar `slack-manifest.yaml` pronto (bot user "AM Marketing", `always_online`, scopes do bot: `chat:write`, `im:write`; interatividade habilitada com `request_url: https://<backend>.onrender.com/slack/events`). Bolt `ExpressReceiver` atende esse endpoint e verifica a assinatura (`SLACK_SIGNING_SECRET`). Registrar `ack()` também para o botão-link "Abrir no app" (Slack exige).

**Fluxos:**
1. **Nova requisição** → listener do backend em `requests` (`notify.adminPending == true`) envia **DM para `ADMIN_SLACK_ID`** (Block Kit): cabeçalho "🟡 Nova requisição #0042", campos (solicitante, itens com quantidades, finalidade, cidade, período/dias), seção "Conflitos" (nenhum ✅ / ⚠️ detalhes), botões **✅ Aprovar** (`action_id: approve_request`), **❌ Reprovar** (`reject_request`, abre modal `views.open` com motivo obrigatório), **🔗 Abrir no app** (url). Salvar `channel` e `ts` da mensagem em `requests.slack` e zerar `notify.adminPending`. Enviar também DM curta ao solicitante confirmando o recebimento com link do ticket.
2. **Aprovar (Slack)** → `ack()` imediato; revalidar conflito; atualizar Firestore (`status`, `decision`) + evento `approved`; `chat.update` na mensagem original (remover botões, mostrar "✅ Aprovada por Suzana às 14:32"); **DM ao solicitante** com a decisão e link do ticket.
3. **Reprovar (Slack)** → modal com motivo (`view_submission`), mesmos passos com `rejected` e o motivo em `decision.note`; DM ao solicitante com o motivo.
4. **Decisão pelo app** (`POST /admin/requests/:id/decision`) → mesmos efeitos, incluindo `chat.update` da mensagem do Slack e DM ao solicitante.
5. **Mensagens do ticket** → listener em `events` (`notify.pending == true`): mensagem do solicitante vira **reply na thread** da mensagem original na DM da Suzana; mensagem da Suzana (pelo app) vira DM ao solicitante. Sempre com link para o ticket.
6. **Cancelamento** pelo solicitante → reply na thread da Suzana ("🚫 Cancelada pelo solicitante") e `chat.update` removendo botões.
7. Botão clicado em requisição já decidida → resposta efêmera "Esta requisição já foi decidida (status …)".

**Resiliência ao cold start do Render free** (o Slack exige `ack` em 3 s; o serviço free dorme após ~15 min sem tráfego):
- `GET /health` leve; documentar no README a criação de um monitor gratuito (UptimeRobot ou cron-job.org) chamando `/health` a cada 5–10 min. Um serviço acordado 24/7 fica dentro das horas gratuitas mensais do Render (verificar o limite atual na documentação e registrar no README).
- Ao iniciar, o backend roda **catch-up**: processa `requests` com `notify.adminPending == true` e `events` com `notify.pending == true`.
- Todo card do Slack inclui o botão-link "Abrir no app" como caminho alternativo caso um clique falhe.

## 10. Segurança (nível ferramenta interna)

- Frontend autentica com **Auth anônimo**; `firestore.rules` exigem `request.auth != null` para tudo.
- Regras: `users`, `items`, `settings/app` → leitura para autenticados, escrita **só pelo Admin SDK**. `settings/counters` → cliente só pode incrementar `requests` em +1. `requests` → criar apenas com `status == 'pending'` e forma válida; atualização pelo cliente permitida **apenas** para cancelar (`pending → cancelled`) e para zerar `unread` do próprio lado; `status`/`decision`/`returnedAt` nunca editáveis pelo cliente. `events` → criar apenas `type == 'message'` (demais tipos só via backend); leitura para autenticados.
- **Admin:** `POST /admin/login` recebe o PIN (`ADMIN_PIN`, comparação timing-safe) e devolve um token HMAC assinado (`ADMIN_TOKEN_SECRET`, validade 12 h) guardado em `sessionStorage`; rotas `/admin/*` exigem `Authorization: Bearer`. Rate limit simples nas rotas de login.
- CORS restrito a `APP_URL`. Slack: assinatura verificada pelo Bolt.
- Limitação conhecida (documentar): sem login real, qualquer pessoa pode escolher o nome de outra. Evolução sugerida em `DECISIONS.md`: "Sign in with Slack" (OpenID Connect, gratuito), que autentica e entrega o Slack ID automaticamente.

## 11. Dados iniciais (`backend/scripts/seed.ts`, idempotente, usa Admin SDK)

- `users`: todos do **Apêndice A**; `role: 'admin'` apenas para `U09F9LWM6MC` (Suzana); demais `requester`.
- `settings/app`: `adminSlackId: 'U09F9LWM6MC'`, `purposeTypes` da seção 6, `cities` iniciais (validar coordenadas pelo geocoder durante o seed): Penedo/AL, Arapiraca/AL, Palmeira dos Índios/AL, Maceió/AL.
- `settings/counters`: `{ requests: 0 }`.
- `items` (quantidades e características são **placeholders** — a admin ajusta no painel):
  - Carrinho do Marketing (categoria Ativação, qty 1, ícone custom `cart`) — atributos: "Uso: degustação/abordagem", "Precisa de 1 pessoa para transporte".
  - Tenda 3x3 (Estrutura, qty 2, `tent`) — "Dimensões: 3x3 m", "Cor: branca", "Montagem: 2 pessoas".
  - Mesa dobrável (Mobiliário, qty 6, `table`) — "Dimensões: 1,80 x 0,75 m".
  - Cadeira (Mobiliário, qty 30, `chair`) — "Material: plástico", "Empilhável".
  - Bancada / balcão de degustação (Ativação, qty 2, `counter`) — "Dimensões: 1,20 x 0,50 m", "Com prateleira interna".

## 12. Deploy 100% gratuito (documentar passo a passo no README, com prints ou comandos)

1. **Firebase:** criar projeto (Spark) → habilitar Firestore (modo produção, região `southamerica-east1`) → Authentication → Anônimo → publicar `firestore.rules` (`firebase deploy --only firestore:rules` ou colar no console) → gerar service account (JSON → base64 para `FIREBASE_SERVICE_ACCOUNT_B64`) → copiar config web para as envs `VITE_FIREBASE_*`.
2. **Slack:** criar app "from manifest" com `slack-manifest.yaml` → instalar no workspace → copiar `SLACK_BOT_TOKEN` (xoxb) e `SLACK_SIGNING_SECRET` → depois do deploy do backend, confirmar a `request_url`.
3. **Render (`render.yaml` Blueprint):**
   - Web Service `am-marketing-api` (runtime node, plan free, `rootDir: backend`, `npm ci && npm run build` / `npm start`, `healthCheckPath: /health`, envs: `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `FIREBASE_SERVICE_ACCOUNT_B64`, `ADMIN_SLACK_ID`, `ADMIN_PIN`, `ADMIN_TOKEN_SECRET`, `APP_URL`).
   - Static Site `am-marketing-app` (runtime static, `rootDir: frontend`, `npm ci && npm run build`, publish `dist`, rewrite `/* → /index.html`, envs `VITE_FIREBASE_*`, `VITE_API_URL`).
   - Marcar todas as envs como `sync: false` (preenchidas no painel). Conferir a sintaxe atual de Blueprints na documentação do Render.
4. **Seed:** `npm run seed` no backend (localmente, com as envs) — idempotente.
5. **Keep-alive:** monitor gratuito em `/health` (seção 9).
6. Checklist final de teste ponta a ponta (criar requisição → DM Suzana → aprovar no Slack → toast no app do solicitante → DM ao solicitante).

## 13. Qualidade e critérios de aceite

- `npm run build`, `npm run typecheck` e `npm run lint` passam nos dois pacotes; testes de disponibilidade passam.
- Fluxo completo funciona no celular (viewport 360 px) e no desktop; Lighthouse Performance ≥ 85 no mobile (fundos WebGL lazy, imagens leves, code-splitting por rota).
- Tempo real: mudanças de status aparecem no app do solicitante em < 2 s sem recarregar.
- Nenhum segredo no bundle do frontend (buscar por `xoxb` e `private_key` no `dist/`).
- Acessível: foco visível, contraste ≥ 4.5:1 no texto sobre onyx, `prefers-reduced-motion` respeitado, labels em formulários.
- Leituras do Firestore controladas: queries com filtros e limites; nada de listar coleções inteiras em loop.
- README em pt-BR com: visão geral, arquitetura, setup local (`.env.example`), deploy passo a passo, operação (como aprovar, cadastrar item, marcar devolução) e solução de problemas (cold start, botão do Slack falhou, seed).

## 14. Decisões já tomadas (não perguntar; seguir)

- Uma requisição pode ter **vários itens** com quantidades (as ações usam kits: tenda + mesas + cadeiras). Aprovação/reprovação é da requisição inteira.
- Datas em nível de **dia** (sem horário) — `YYYY-MM-DD` — período inclusivo.
- **Pendentes não bloqueiam**; só aprovadas bloqueiam. A admin decide conflitos.
- Numeração sequencial `#0001` via transação em `settings/counters`.
- Identidade por escolha de nome + `localStorage`; **PIN só para a admin**. Sem "Sign in with Slack" no MVP (fica documentado como evolução).
- Imagens de itens só por **URL externa** opcional (Firebase Storage não é gratuito em projetos novos); ícones são o padrão visual.
- Backend com **Slack Bolt (ExpressReceiver)**, um único serviço; listeners do Firestore + catch-up no boot; keep-alive externo documentado.
- Mapa com **Leaflet + CARTO dark + Photon**; sem Google Maps (chave paga).
- Tema **escuro fixo** (sem modo claro) para preservar a identidade dourada.
- Fontes self-hosted via `@fontsource/cormorant-garamond` e `@fontsource/manrope`.
- Estrutura de pastas do frontend por **features**: `src/features/{identity,catalog,request-wizard,tickets,agenda,admin}`, `src/components/ui`, `src/components/reactbits`, `src/lib/{firebase,availability,geocode,dates}`.

## 15. Plano de execução (fases; ao fim de cada uma: build + typecheck + testes passando e um resumo do que foi feito)

0. Ler este prompt inteiro, inspecionar `logo-am.png`, abrir a página de instalação do React Bits e conferir os nomes dos componentes que pretende usar. Escrever um plano curto em `DECISIONS.md` e começar.
1. **Fundação + design system:** scaffold do monorepo, Tailwind com tokens, fontes, layout/navegação (Dock + Pill Nav), componentes base (Button, Card de vidro, Chip de status, Avatar, Input, Drawer, Modal, Skeleton, Toast), tela de identidade com fundo WebGL e busca de nomes (dados mockados).
2. **Firebase:** config, auth anônimo, `firestore.rules`, tipos compartilhados, `seed.ts`, hooks de leitura em tempo real (`useItems`, `useRequests`, `useSettings`).
3. **Catálogo + disponibilidade + agenda:** `availability.ts` com testes, cards com anel de disponibilidade, drawer do item, página Agenda.
4. **Wizard de requisição + tickets:** os 5 passos (itens, finalidade, cidade/mapa, período/calendário, revisão), criação transacional, lista de requisições, ticket com timeline/chat/cancelamento, notificações in-app.
5. **Backend + Slack + admin:** Bolt/Express, listeners e catch-up, Block Kit, aprovar/reprovar/modal, `chat.update`, DMs, rotas `/admin/*` com PIN/token, painel admin completo (fila, em uso, CRUD de itens com características dinâmicas e seletor de ícones, configurações, dashboard com mapa).
6. **Polimento e entrega:** PWA e ícones, performance (lazy/code-splitting), acessibilidade e reduced-motion, `render.yaml`, `slack-manifest.yaml`, `.env.example`, README completo, teste ponta a ponta documentado.

Ao terminar, liste tudo que precisa ser feito manualmente por mim (envs, manifesto do Slack, monitor de keep-alive, seed) em ordem, com os comandos exatos.

---

## Apêndice A — Usuários (Slack ID → nome completo)

Administradora: **U09F9LWM6MC — Suzana Martins Tavares**. Todos os demais são `requester`.

```json
[
  {"slackId":"U07KP9J5BLP","name":"Rafaela Alves Mendes"},
  {"slackId":"U07KPE840MD","name":"Erick Café Santos Júnior"},
  {"slackId":"U07KX76F7D4","name":"Leidiane Souza"},
  {"slackId":"U07KXEJU338","name":"Alberto Luiz Marinho Batista"},
  {"slackId":"U07L4D3EWJW","name":"Jonathan Henrique da Conceição Silva"},
  {"slackId":"U07L6EAUS75","name":"Maria Taciane Pereira Barbosa"},
  {"slackId":"U07LGG4RPK3","name":"José Fernando dos Santos Santana Ramos"},
  {"slackId":"U07LP4JSN9K","name":"João Antonio Tavares Santos"},
  {"slackId":"U07LSKN7SNL","name":"Rômulo Jose Santos Lisboa"},
  {"slackId":"U07Q8NT7J1Y","name":"Ravy Thiago Vieira da Silva"},
  {"slackId":"U07Q9HE3KGA","name":"Amanda Santos Costa"},
  {"slackId":"U081ZP68CA1","name":"Tomás Azevedo Santos"},
  {"slackId":"U082F9GGMSM","name":"Maria Nobre Farias de França"},
  {"slackId":"U0875QNU02K","name":"Kauanne Iwashita da Silva"},
  {"slackId":"U08762E1PMM","name":"João Victor Santos da Silva"},
  {"slackId":"U087E6YNPRD","name":"Ana Paula Amaral Santos Ismerim"},
  {"slackId":"U087HDEARA9","name":"Kemilly Rafaelly Souza Silva"},
  {"slackId":"U087HG1B4DB","name":"Maria Tatiane Oliveira Santos"},
  {"slackId":"U087M32A18B","name":"Luan Santos de Oliveira"},
  {"slackId":"U087M7GCNMC","name":"Valesca Meirelle Bezerra Vitória"},
  {"slackId":"U087P8JF97F","name":"Eliene da Silva Santos"},
  {"slackId":"U088986S1L0","name":"Jordelle Meygre Costa de Oliveira"},
  {"slackId":"U088B372R40","name":"Mariane Santos Sousa"},
  {"slackId":"U088MU33XRC","name":"Bruna Cândido de Lima"},
  {"slackId":"U0895CZ8HU7","name":"Carlos Eduardo Silva de Oliveira"},
  {"slackId":"U089NSW1BDG","name":"Caique dos Santos da Silva"},
  {"slackId":"U08B1MQJL3C","name":"Robéria Gilo da Silva"},
  {"slackId":"U08B2NHAH8C","name":"Thayane Mayara dos Santos"},
  {"slackId":"U08E4LNLG06","name":"Luiz Fellipe Guedes Santos Silva"},
  {"slackId":"U08E8GH19TP","name":"Thalys Gomes dos Santos"},
  {"slackId":"U08EB943ZCJ","name":"Paulo Cesar da Silva Santos Junior"},
  {"slackId":"U08EHG788DV","name":"Claudio Bispo dos Santos"},
  {"slackId":"U08ERHMN6F9","name":"Ana Luiza dos Santos"},
  {"slackId":"U08EYMYMXNW","name":"Danrley Firmino dos Santos"},
  {"slackId":"U08F7PSCPK6","name":"Sabrina Domingos Santos"},
  {"slackId":"U08F8T8SMNE","name":"Yasmim da Rocha Bezerra Barbosa"},
  {"slackId":"U08F9KK0AAG","name":"Ana Clara de Matos Chagas"},
  {"slackId":"U08H0PHPAMC","name":"Ludmylla Wolpert Melo"},
  {"slackId":"U08JFCGBFSA","name":"Anny Karoline Andrade Santos"},
  {"slackId":"U08JJ6JMH50","name":"Leticia Seixas Santos"},
  {"slackId":"U08JJ7VF0N6","name":"Nathália Vieira Lima"},
  {"slackId":"U08JJH9BWP5","name":"Gessyca Nayara Rocha Santos"},
  {"slackId":"U08K69RC01H","name":"Letícia Soares Belo"},
  {"slackId":"U08M7D0EVR9","name":"Natali de Souza Gonzaga"},
  {"slackId":"U08NLNHF29G","name":"Bruna Rayane Oliveira dos Santos"},
  {"slackId":"U08NLQK5PEJ","name":"Millena Sthefany dos Santos Cruz"},
  {"slackId":"U08NTGXEK26","name":"Emanoelle Feitosa Vieira Santos"},
  {"slackId":"U08P5GH6C3Z","name":"Giselle dos Santos Roberto"},
  {"slackId":"U08PER1QM2N","name":"Juliene Bezerra"},
  {"slackId":"U08PPAAH5PT","name":"Luciano Torres"},
  {"slackId":"U08PZTY2G0Y","name":"Josimara Ferreira Monteiro"},
  {"slackId":"U08QP0KFL15","name":"Márcio Alif Santos Silva"},
  {"slackId":"U08UMBX0CP4","name":"Laís Manuelle Santos Pereira"},
  {"slackId":"U0922F5KB7U","name":"Rodrigo Augusto Teixeira Dos Santos"},
  {"slackId":"U0929MZMW5C","name":"Danielle dos Santos Silva"},
  {"slackId":"U092FQKNFPB","name":"Deise Gislaine Silva Vitor"},
  {"slackId":"U0939HA46LW","name":"Camilla Emanuelle Lopes De Almeida"},
  {"slackId":"U094A8J5R2L","name":"Yuri Castro Gomes"},
  {"slackId":"U097B39GTMG","name":"Luís Henrique Batista dos Santos"},
  {"slackId":"U09AYV61119","name":"Lianda Melinda Santos Calixto"},
  {"slackId":"U09B6LQ3FFY","name":"Karine Celestino Evangelista dos Santos"},
  {"slackId":"U09BMRBFRM0","name":"Pedro Lucas Rocha da Fonseca"},
  {"slackId":"U09DHA4MV52","name":"João Ricardo Dantas Albuquerque"},
  {"slackId":"U09ED214T6W","name":"Maryanna Francielly Trajano da Silva"},
  {"slackId":"U09F9LWM6MC","name":"Suzana Martins Tavares"},
  {"slackId":"U09G04R3CNP","name":"Gessica Queiroz"},
  {"slackId":"U09JGAFFZB6","name":"Camille Kauane da Silva Nunes"},
  {"slackId":"U09QM89NV5W","name":"Alcina"},
  {"slackId":"U0A0D0J2E31","name":"Raquele Fragoso da Silva"},
  {"slackId":"U0A1P79UK0T","name":"Sandra da Conceição Freitas"},
  {"slackId":"U0A1VJ2Q4R0","name":"Rosilene Martins da Silva"},
  {"slackId":"U0A2PUWCUKS","name":"Ane Caroline Pereira Martér"},
  {"slackId":"U0A3P2QB5P0","name":"Hugo Castro Lopes"},
  {"slackId":"U0A5YLESW1E","name":"Yasmin Abilia Ferro Da Silva"},
  {"slackId":"U0A6WDA1LSF","name":"Edna Lopes da Silva"},
  {"slackId":"U0AA4R2LSUS","name":"Luciene da Silva Nascimento"},
  {"slackId":"U0AHTBS64KH","name":"Jaíne Mariana Rodrigues Mendonça"},
  {"slackId":"U0AKHDX4G83","name":"Lays da Silva Vieira"},
  {"slackId":"U0AKMRS669L","name":"Marília Alice dos Santos Silva"},
  {"slackId":"U0AKMS2LNEA","name":"Eduarda Pereira Costa Silva"},
  {"slackId":"U0AL2NDNH09","name":"Maria Cicília Brito Veiga"},
  {"slackId":"U0AMN750JT0","name":"Fabia Batista da Silva"},
  {"slackId":"U0AMSCAC1HR","name":"Thamires Emanuelle da Silva"},
  {"slackId":"U0AP3LJ355L","name":"Maria Jeane Da Silva Santos"},
  {"slackId":"U0ARN2C0YLT","name":"Joanna Roberta de Queiroz Viana"},
  {"slackId":"U0ASUE1GNUA","name":"Maria Fernanda Gomes Vieira"},
  {"slackId":"U0ASY08QHTN","name":"Josenildo Alves da Silva Júnior"},
  {"slackId":"U0AT1KKLWNS","name":"Shayane Oliveira Ferreira"},
  {"slackId":"U0ATLF85Z9U","name":"Brunna Isabelly Silva Lima"},
  {"slackId":"U0B1D2NM47M","name":"Nayara Soares Kimura"},
  {"slackId":"U0B8A9PLC6B","name":"Sione Barbosa da Silva"},
  {"slackId":"U0B8TL364P3","name":"Samuel Monteiro da Silva"},
  {"slackId":"U0BA9MCGX6K","name":"Luciene Tayná Félix da Silva"},
  {"slackId":"U0BAT0U8DS5","name":"Juliana Francine Marques da Silva"},
  {"slackId":"U0BQ87WPVQE","name":"Alekson Fernandes Moura"},
  {"slackId":"U0BGA5QHHLJ","name":"Amanda de Araújo Santos"},
  {"slackId":"U0BG84A7VF0","name":"Auda da Conceição Santos"},
  {"slackId":"U0BD3P15E2J","name":"Bruna Soares Siqueira"},
  {"slackId":"U0BBSVDGNP5","name":"Caroline Leite dos Santos"},
  {"slackId":"U0BFUPEQ6B1","name":"Crislaine Freire dos Santos"},
  {"slackId":"U0BDA1F9PLL","name":"Edlane Silva de Lima"},
  {"slackId":"U0BBWRCFVM0","name":"Evellyn Vitória Nunes Santos"},
  {"slackId":"U0BLWU0UG9E","name":"Jayane da Silva Dias"},
  {"slackId":"U0BGDSAR0VA","name":"Juliene Reis Ferreira"},
  {"slackId":"U0BFUP1HDB9","name":"Kledja Nunes da Silva"},
  {"slackId":"U07K7G5N0DB","name":"Luiz Henrique Martins Tavares"},
  {"slackId":"U0BGA5FEA10","name":"Rayanne Maria dos Santos Moca"},
  {"slackId":"U0BGKC2GLMV","name":"Sabrina Barbosa Machado Mariano"},
  {"slackId":"U0BG84EDWVC","name":"Tayna Monaisa Vasconcelos Santos"}
]
```
