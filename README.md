# Juntos — desafios em família

Site para acompanhar objetivos pessoais em grupo. Cada participante cria metas com prazo, unidade, multa e frequência semanal opcional; registra progresso por dia com texto e foto; e acompanha ranking, ausência de registros e progresso da família. O dono pode editar uma meta ainda aberta e excluir um registro feito por engano.

O resultado final usa apenas registros datados **até o prazo**. A frequência semanal mostra os dias distintos com registros na semana atual. Metas vencidas e incompletas geram uma multa informativa que o dono pode marcar como paga. O site não processa pagamentos.

## Desenvolvimento local

Requer Node.js 20 ou superior.

```bash
npm ci --cache /tmp/npm-cache
npm run dev -- --port 4173
```

Sem variáveis de ambiente, o site abre uma demonstração com dados fictícios. As alterações da demonstração ficam somente no navegador. Fotos na demonstração têm limite de 1 MB.

Com o servidor na porta 4173, valide com:

```bash
npm test
npm run smoke
npm run build
```

O teste de navegador usa Chromium em `/usr/bin/chromium`; defina `CHROMIUM_PATH` se ele estiver em outro caminho. Quando as variáveis do Supabase estão presentes, o teste entra pela opção **Explorar demonstração** e não modifica o banco.

## Dados compartilhados no Supabase

No projeto Supabase, aplique as migrações **na ordem**:

1. [Estrutura inicial](supabase/migrations/20261016000000_initial.sql): grupos, contas, metas, registros, regras de acesso e fotos privadas. **Já aplicada** ao projeto Projeto-Ovelhas em 16/10/2026.
2. [Controles de metas e multas](supabase/migrations/20261016000001_goal_controls.sql): edição de metas, exclusão de registros, multas pagas e proteção do prazo. **Ainda não aplicada** ao projeto remoto. Aplique-a antes de usar essas funções na versão compartilhada.

Configure `VITE_SUPABASE_URL` com a URL do projeto e `VITE_SUPABASE_ANON_KEY` com a chave pública *publishable* (ou *anon*) no ambiente de desenvolvimento e na hospedagem. Veja [.env.example](.env.example). **Nunca use `service_role` ou uma chave secreta no site.**

Em **Authentication → Providers**, habilite Email. Se a confirmação por e-mail estiver ativa, cada pessoa precisa confirmar o cadastro. Em **Authentication → URL Configuration**, defina a URL publicada do site como *Site URL* após a publicação.

A primeira pessoa cria um grupo e compartilha o código de convite. As demais criam conta e entram com o código. Cada pessoa altera apenas as próprias metas e registros; integrantes do mesmo grupo podem visualizá-los. Fotos ficam em um bucket privado e são exibidas por URLs temporárias.

## Hospedagem gratuita: Cloudflare Pages

O site pode ficar no plano gratuito do Cloudflare Pages, com Supabase gratuito para contas e dados. O código está na branch `main` de `WeslleyKow/Projeto-Ovelhas`. Ao conectar o repositório GitHub no Cloudflare Pages, use:

- **Framework preset:** Vite
- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Environment variables:** `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em produção e prévias

Após o deploy, configure a URL `*.pages.dev` recebida como *Site URL* no Supabase e teste cadastro, convite, registro com foto, ranking e multa paga usando duas contas. O domínio exato e o teste da versão publicada ainda dependem da publicação no Pages. Os limites e políticas dos planos gratuitos podem mudar.
