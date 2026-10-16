# Juntos — desafios em família

Site para acompanhar objetivos pessoais em grupo. Cada participante pode criar metas com prazo, unidade, valor de multa e frequência semanal opcional; registrar progresso por data com texto e foto; e acompanhar o ranking, a ausência de registros e o progresso da família.

A multa é apenas informativa. O site não cobra pagamentos. A conclusão de uma meta considera a soma dos registros frente à meta numérica; a frequência semanal mostra os **dias distintos com registros** na semana atual, sem impor multa automática por semana.

## Desenvolvimento local

Requer Node.js 20 ou superior.

```bash
npm ci --cache /tmp/npm-cache
npm run dev
```

Sem variáveis de ambiente, o site abre uma demonstração com dados fictícios. As alterações da demonstração ficam somente no navegador. Fotos na demonstração têm limite de 1 MB. Para testar o fluxo básico no Chromium instalado no ambiente:

```bash
npm run smoke
npm run build
```

O teste de navegador espera que `npm run dev` esteja aberto em `http://127.0.0.1:4173/`; execute `npm run dev -- --port 4173`. Se o Chromium estiver em outro caminho, defina `CHROMIUM_PATH`.

## Dados compartilhados no Supabase

1. Crie um projeto no plano gratuito do Supabase.
2. No SQL Editor, execute [a migração inicial](supabase/migrations/20261016000000_initial.sql). Ela cria as tabelas, as regras de acesso por grupo e o armazenamento privado de fotos.
3. Em **Project Settings → API**, copie a URL do projeto e a chave pública (anon/publishable). Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no ambiente de desenvolvimento e na hospedagem. Veja [.env.example](.env.example). A chave `service_role` nunca deve ir para o site.
4. Em **Authentication → Providers**, habilite Email. Se a confirmação por e-mail estiver habilitada, cada pessoa deve confirmar o cadastro antes de entrar.
5. Em **Authentication → URL Configuration**, defina a URL da hospedagem como Site URL. Inclua o endereço local de desenvolvimento nas URLs de redirecionamento, se necessário.

Com as variáveis configuradas, o site mostra cadastro e login. A primeira pessoa cria um grupo e compartilha o código de convite. As demais criam conta e entram com o código. Cada pessoa pode registrar progresso apenas nas próprias metas; membros do mesmo grupo podem visualizar os registros. Fotos são privadas e exibidas por URL temporária.

## Hospedagem gratuita: Cloudflare Pages

O site é estático e pode ser publicado no plano gratuito do Cloudflare Pages, com o Supabase gratuito para autenticação e dados. Para conectar o repositório GitHub pelo painel do Cloudflare Pages:

1. Crie uma aplicação Pages, escolha **Connect to Git** e selecione `WeslleyKow/Projeto-Ovelhas` na branch `main` depois que o código estiver no GitHub.
2. Configure **Framework preset: Vite**, **Build command: `npm run build`** e **Build output directory: `dist`**. O Pages instala as dependências antes do build.
3. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em **Settings → Variables and Secrets** para produção e prévias, e faça um novo deploy.
4. Adicione a URL `*.pages.dev` recebida à configuração de URL do Supabase.
5. Cadastre dois usuários e confira convite, registro, foto e ranking no site publicado.

Nenhuma conta de Cloudflare ou Supabase está vinculada a este ambiente. A criação desses projetos e a ativação da publicação exigem acesso às respectivas contas. Os limites gratuitos e políticas desses serviços podem mudar.
