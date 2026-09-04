# Decisões de engenharia — AM Marketing

Registro das escolhas feitas durante a construção do app, com o motivo de cada
uma. Serve para quem for dar manutenção entender **por que** o código é assim.

---

## 0. Plano de execução

Seguido na ordem da seção 15 da especificação:

| Fase | Entrega |
| --- | --- |
| 0 | Leitura da especificação, inspeção da logo, verificação do catálogo real do React Bits, este documento |
| 1 | Fundação: monorepo, tokens do Tailwind, fontes, layout/navegação, componentes base, tela de identidade |
| 2 | Firebase: config, auth anônimo, `firestore.rules`, tipos compartilhados, `seed.ts`, hooks de tempo real |
| 3 | Catálogo + disponibilidade (com testes) + agenda |
| 4 | Wizard de requisição + tickets (timeline, chat, cancelamento) |
| 5 | Backend + Slack + painel admin |
| 6 | Polimento: PWA, performance, acessibilidade, `render.yaml`, `slack-manifest.yaml`, README |

---

## 1. Catálogo do React Bits — verificado, não inventado

A restrição 2.7 proíbe inventar componentes. Em vez de confiar na memória, o
catálogo real foi lido do **registry oficial do shadcn** publicado pelo próprio
React Bits:

```
https://reactbits.dev/r/registry.json      → 684 itens, 171 na variante TS-TW
https://reactbits.dev/r/<Nome>-TS-TW.json  → o componente individual
```

Todos os componentes citados na seção 5 da especificação **existem** na variante
`TS-TW` e foram confirmados um a um: `Aurora`, `LightRays`, `Silk`, `Noise`,
`SplitText`, `BlurText`, `ShinyText`, `CountUp`, `GradientText`, `SpotlightCard`,
`MagicBento`, `GlareHover`, `Dock`, `PillNav`, `GooeyNav`, `Stepper`,
`ClickSpark`, `Magnet`, `StarBorder`, `ElectricBorder`, `AnimatedContent`,
`FadeContent`, `AnimatedList`, `Counter`, `TargetCursor`, `TiltedCard`,
`ChromaGrid`. Nenhum substituto por `motion` foi necessário por ausência.

**Como os componentes entram no repositório.** O `components.json` está
configurado com o registry `@react-bits` exatamente como a documentação manda,
então `npx shadcn@latest add @react-bits/<Nome>-TS-TW` funciona. Para o build
inicial usamos `npm run reactbits` (`frontend/scripts/fetch-reactbits.mjs`), que
baixa a **mesma** lista fixada do mesmo registry oficial e grava em
`src/components/reactbits/`. Motivo: o script instala apenas os arquivos e deixa
as versões das dependências sob nosso controle — a CLI do shadcn tentaria fixar
`react-router-dom@^6.30.1`, `motion@^12.23.12` etc. por conta própria, e uma
delas conflitaria com o par React 18 / react-leaflet 4 escolhido abaixo. Os
componentes ficam versionados no Git e podem ser customizados à vontade, que é o
que a especificação pede.

## 2. Silk trocado por Aurora + Light Rays (custo de bundle)

`Silk` depende de `three` + `@react-three/fiber` (~600 kB minificados). O
critério de aceite pede **Lighthouse Performance ≥ 85 no mobile**. `Aurora`,
`LightRays`, `Particles` e `Threads` usam `ogl`, que faz o mesmo trabalho de
WebGL em ~50 kB.

A especificação já oferecia a alternativa ("fundo **Silk** ou **Aurora** ... ou
**Light Rays**"), então ficou: **Aurora** na tela de identidade e **Light Rays**
no hero da home. Os dois entram por `React.lazy` + `IntersectionObserver`, com
fallback de gradiente CSS, e são desligados sob `prefers-reduced-motion`, em
telas pequenas e quando a máquina tem poucos núcleos.

## 3. `motion` em vez de `framer-motion`

O `framer-motion` v12 é publicado com o nome **`motion`** (`motion/react` expõe a
mesma API). É essa a dependência declarada pelos componentes do React Bits.
Instalar os dois colocaria duas cópias da mesma biblioteca no bundle, então o
projeto inteiro usa `motion/react`.

## 4. Versões travadas por causa do React 18

A especificação fixa **React 18**. Isso amarra algumas escolhas:

- `react-leaflet@4.2.1` — a v5 exige React 19.
- `react-day-picker@9` — pedido explicitamente; a v10 já saiu, mas a API do
  calendário customizado aqui é a da v9.
- `react-router-dom@6` — é a faixa declarada pelo `PillNav` do React Bits.
- `tailwindcss@3.4` — a seção 5 descreve os tokens em `theme.extend`, que é a
  configuração da v3. A v4 move tudo para CSS (`@theme`) e mudaria o formato pedido.
- `vite@7` + `@vitejs/plugin-react@4` + `vitest@3` — trio com peer deps
  mutuamente compatíveis.

## 5. `shared/` copiado para dentro de cada pacote

O Render constrói cada serviço com um `rootDir` próprio (`frontend/`,
`backend/`). Importar de `../shared` complicaria o `rootDir` do `tsc` do backend
e o alias do Vite sem ganho real.

A fonte da verdade é `/shared/*.ts`; `npm run sync:shared` copia para
`frontend/src/shared/` e `backend/src/shared/`, e as cópias são versionadas —
assim o build funciona mesmo sem rodar o script. Os arquivos gerados levam um
cabeçalho avisando que não devem ser editados. A especificação permite
explicitamente ("copiado ou linkado em ambos os pacotes").

## 6. Backend em CommonJS

`@slack/bolt` é CJS na origem. Com `"type": "module"` seria preciso sufixar todo
import relativo com `.js` e lidar com `createRequire` em alguns pontos, sem
benefício. O backend compila para CommonJS; o frontend segue ESM (Vite).

## 7. `returnedOn` (dia) além de `returnedAt` (timestamp)

O modelo da seção 6 traz `returnedAt`. A disponibilidade, porém, é calculada em
**dias** (`YYYY-MM-DD`), e converter um `Timestamp` para o dia em
`America/Maceio` dentro de cada célula do calendário seria caro e fácil de errar.

Guardamos os dois: `returnedAt` (auditoria, `Timestamp`) e `returnedOn` (o dia da
devolução). O motor de disponibilidade usa só `returnedOn`.

Consequência na regra: a especificação diz "aprovadas **e sem `returnedAt`**". A
implementação é equivalente para o futuro e mais correta no passado — uma
requisição devolvida ocupa até a **véspera** da devolução (`min(endDate,
returnedOn - 1)`), o que atende "libera o item a partir do dia da devolução" sem
apagar o histórico.

## 8. `status` fora do alcance do cliente

Toda transição de status passa pelo backend (Slack ou `/admin/*`), então
`firestore.rules` pode negar qualquer escrita de cliente em `status`, `decision`,
`returnedAt`, `returnedOn` e `number`. As duas exceções permitidas ao cliente,
listadas na seção 10, são o cancelamento (`pending → cancelled`) e zerar o
próprio contador de não lidas — ambas validadas campo a campo nas regras.

## 9. Limitação conhecida: identidade sem autenticação real

Sem login, qualquer pessoa pode escolher o nome de outra. É aceitável para uma
ferramenta interna de ~110 pessoas em um workspace fechado, e está documentado no
README.

**Evolução sugerida:** *Sign in with Slack* (OpenID Connect), que é gratuito e
entrega o Slack ID já autenticado. O caminho é curto porque o app inteiro já
identifica as pessoas por `slackId`: bastaria trocar a tela de identidade pelo
fluxo OIDC e passar a emitir um token do Firebase Auth com o `slackId` como
`uid`, permitindo endurecer as regras para `request.auth.uid == requesterId`.

## 10. Ícones dos itens: SVG próprios de traço fino

Nenhum ícone do lucide combina com a linha contínua do monograma para tenda,
bancada e carrinho de marketing. Foram desenhados cinco ícones próprios
(`tent`, `table`, `chair`, `counter`, `cart`) com `stroke-width` 1.25 e
`stroke-linecap: round`, no mesmo peso visual da logo. O seletor do painel admin
mistura esses cinco com um subconjunto curado do lucide.

## 11. Imagens de item apenas por URL externa

O Firebase Storage não faz parte do plano Spark para projetos novos. O campo
`imageUrl` aceita uma URL externa opcional; o padrão visual do app é o ícone.

## 12. Leitura do Firestore contida

O plano Spark limita leituras diárias. As decisões que seguram o volume:

- A consulta de disponibilidade é **uma só** (`status in ['pending','approved']`
  e `endDate >= hoje - 60 dias`), compartilhada por catálogo, agenda e wizard
  através de um contexto único — não há uma consulta por tela.
- `items`, `users` e `settings` são coleções pequenas, lidas uma vez por sessão
  via `onSnapshot`.
- A lista de requisições de um solicitante filtra por `requesterId`; só a
  administradora lê a coleção inteira, e ainda assim com limite.
- Nenhuma consulta dentro de laço ou de `useEffect` sem dependências estáveis.

## 13. Render configurado na mão, sem Blueprint

A especificação previa um `render.yaml` (Blueprint). **A pedido do cliente, o
deploy é feito criando os serviços direto no painel do Render** — um **Web
Service** para a API e um **Static Site** para o app —, então o `render.yaml`
foi removido do repositório.

Em troca, o README traz a lista exata de campos para preencher em cada tela
(root directory, comandos de build e start, health check path, rewrite de SPA e
todas as variáveis de ambiente). O resultado é o mesmo; muda quem digita.

## 14. Modo demonstração em vez do emulador do Firestore

O caminho normal para rodar local sem tocar em produção seria o emulador do
Firestore — mas ele é uma aplicação **Java**, e a máquina de desenvolvimento não
tem JVM. Instalar um runtime inteiro só para ver o app rodar seria um preço
alto.

Em vez disso, `frontend/src/demo/` traz uma loja em memória que substitui o
Firestore **e** o backend. Ela liga sozinha quando o Firebase não está
configurado em desenvolvimento, ou explicitamente com `VITE_DEMO_MODE=true`.

O ponto importante: as decisões passam pelo **mesmo** `shared/availability.ts`
da produção. O conflito que aparece na demonstração é o conflito de verdade —
não há uma segunda implementação para divergir. O que a loja substitui é só a
persistência.

São quatro pontos de integração, todos de poucas linhas: `AppDataProvider`,
`hooks/useRequests`, as escritas em `lib/collections` e o cliente `lib/api`.
Com o Firebase configurado, `isDemoMode()` é `false` e nenhum deles é tocado.

## 15. CTA "Nova requisição" no cabeçalho, não flutuando

A especificação pedia um CTA **fixo** no catálogo. Na prática ele cobria o texto
dos cards durante a rolagem — em 360 px chegava a esconder uma linha inteira — e
repetia uma ação que a dock (celular) e o PillNav (desktop) já oferecem.

O botão foi para o fim do cabeçalho: continua sendo a primeira coisa depois das
métricas, sem tapar conteúdo nenhum.

## 16. Tiles do mapa: Esri no lugar da CARTO (a CARTO passou a exigir chave)

A especificação pedia os tiles escuros `dark_all` da CARTO. **Eles deixaram de
ser utilizáveis sem chave.** Hoje `basemaps.cartocdn.com` responde HTTP 200 e
devolve o tile com um carimbo diagonal por cima do mapa:

```
API KEY REQUIRED — carto.com/basemaps/apikey
```

Como chave da CARTO é serviço pago, manter isso violaria a restrição 1 (custo
zero, sem chave paga) — e o carimbo aparecia no meio do mapa do painel.

A troca foi para o **World Dark Gray Canvas da Esri**, servido em
`services.arcgisonline.com` sem chave nem cadastro, em duas camadas: a base
(relevo, água, vias) e a de referência (nomes de lugares). Atribuição:
`© Esri — Esri, HERE, Garmin, © OpenStreetMap contributors`.

Alternativa considerada e descartada: tiles do OpenStreetMap com filtro CSS de
inversão para simular o escuro. Funciona, mas os rótulos invertidos ficam ruins
de ler e a política de uso do OSM desencoraja aplicações dependerem dos tiles
públicos deles.

A configuração ficou isolada em `frontend/src/components/map/tiles.ts` — se a
Esri um dia mudar de política, é um arquivo só para trocar.

## 17. Tela de identidade: buscar em vez de listar

A primeira versão mostrava a lista inteira de pessoas. Com ~110 nomes isso é
pior do que digitar: a pessoa rola procurando a si mesma, e a lista aberta
sugere que escolher outra pessoa é natural.

Agora nada aparece até digitar (mínimo de 2 caracteres). A busca aceita nome,
pedaço do nome ou **iniciais** — "rm", "ram" e "rafa" encontram Rafaela Alves
Mendes —, tudo sem acento. A lógica está em `lib/peopleSearch.ts`, com testes.

A administradora ganhou um caminho próprio e discreto no rodapé
("Entrar como administradora"), que pede o PIN direto: ela não precisa se
procurar na lista, e o botão deixa claro que aquele acesso é diferente.

## 18. Cold start do Render free

O plano gratuito dorme após ~15 min sem tráfego e o Slack exige `ack` em 3 s.
Três defesas, todas na seção 9 da especificação:

1. `GET /health` leve, para um monitor externo gratuito bater a cada 10 min.
2. **Catch-up no boot:** ao subir, o backend processa `requests` com
   `notify.adminPending == true` e `events` com `notify.pending == true`, então
   nada se perde enquanto o serviço dormiu.
3. Todo card do Slack traz o botão-link **Abrir no app**, que não depende do
   backend estar acordado.
