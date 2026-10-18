# Juntos — desafios em família

Site para acompanhar objetivos pessoais em grupo. Cada participante cria metas com prazo, unidade, multa, código Pix e frequência semanal opcional; registra progresso por dia com texto e foto; e acompanha ranking, ausência de registros e progresso da família. O criador pode pedir a edição de uma meta ainda aberta ou a exclusão de uma meta, e os demais integrantes decidem conforme a regra de aprovação escolhida para aquele objetivo. Registros individuais feitos por engano continuam podendo ser excluídos pelo autor.

O resultado final usa apenas registros datados **até o prazo**. A frequência semanal mostra os dias distintos com registros na semana atual. Metas vencidas e incompletas geram uma multa informativa que o dono pode marcar como paga. O site não processa pagamentos.

Cada objetivo define um quórum em número de pessoas ou porcentagem dos demais integrantes; o criador não vota. A porcentagem é arredondada para cima. O grupo de votantes e o número necessário ficam registrados quando o pedido é feito. Cada pessoa pode autorizar ou recusar uma vez. A edição ou exclusão só é aplicada quando o quórum é atingido; se não houver outros participantes, é aplicada na hora. A regra vigente também protege pedidos que queiram alterar a própria regra. Objetivos excluídos somem do site e do ranking, mas o banco guarda o histórico para auditoria. O código Pix é transformado em QR Code no detalhe da meta e serve apenas como informação de pagamento.

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
npm run smoke:approvals
npm run build
```

O teste de navegador usa Chromium em `/usr/bin/chromium`; defina `CHROMIUM_PATH` se ele estiver em outro caminho. Quando as variáveis do Supabase estão presentes, o teste entra pela opção **Explorar demonstração** e não modifica o banco.

## Dados compartilhados no Supabase

No projeto Supabase, aplique as migrações **na ordem**:

1. [Estrutura inicial](supabase/migrations/20261016000000_initial.sql): grupos, contas, metas, registros, regras de acesso e fotos privadas. **Já aplicada** ao projeto Projeto-Ovelhas em 16/10/2026.
2. [Controles de metas e multas](supabase/migrations/20261016000001_goal_controls.sql): edição de metas, exclusão de registros, multas pagas e proteção do prazo. **Já aplicada** ao projeto Projeto-Ovelhas em 18/10/2026.
3. [Aprovações e Pix](supabase/migrations/20261018000000_goal_approvals_pix.sql): quórum por objetivo, pedidos e votos protegidos no banco, exclusão lógica e código Pix. **Já aplicada** ao projeto Projeto-Ovelhas em 18/10/2026.

Configure `VITE_SUPABASE_URL` com a URL base do projeto (por exemplo, `https://SEU-PROJETO.supabase.co`, sem `/rest/v1/`) e `VITE_SUPABASE_ANON_KEY` com a chave pública *publishable* (ou *anon*) no ambiente de desenvolvimento e na hospedagem. O app também remove um sufixo `/rest/v1/` caso a variável já tenha sido preenchida assim. Veja [.env.example](.env.example). **Nunca use `service_role` ou uma chave secreta no site.**

O provedor Email está habilitado. A confirmação por e-mail está desativada para permitir o cadastro dos familiares sem um servidor SMTP próprio; cada pessoa pode entrar logo após criar a conta. O acesso aos dados continua protegido por login, código de convite e regras de acesso do banco. A *Site URL* em **Authentication → URL Configuration** está configurada como `https://projeto-ovelhas.pages.dev`.

A primeira pessoa cria um grupo e compartilha o código de convite. As demais criam conta e entram com o código. Cada pessoa altera apenas as próprias metas e registros; integrantes do mesmo grupo podem visualizá-los. Fotos ficam em um bucket privado e são exibidas por URLs temporárias.

## Hospedagem gratuita: Cloudflare Pages

O site está publicado em **https://projeto-ovelhas.pages.dev** no plano gratuito do Cloudflare Pages, com Supabase gratuito para contas e dados. O código está na branch `main` de `WeslleyKow/Projeto-Ovelhas`. O projeto Pages foi criado como `projeto-ovelhas` e publicado por envio direto da pasta `dist` com Wrangler. Ele ainda não está conectado ao GitHub; mudanças futuras exigem uma nova compilação e publicação.

Para publicar uma alteração, com `CLOUDFLARE_API_TOKEN`, `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` disponíveis no ambiente, execute `npm run build` e depois `CLOUDFLARE_ACCOUNT_ID=<ID_DA_CONTA> npx wrangler@4 pages deploy dist --project-name=projeto-ovelhas --branch=main`. Essas duas variáveis `VITE_` são públicas e entram nos arquivos do site durante a compilação; nunca coloque uma chave `service_role` no frontend.

Se futuramente conectar o repositório GitHub ao Cloudflare Pages, use:

- **Framework preset:** Vite
- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Environment variables:** `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em produção e prévias

A publicação e a configuração da *Site URL* foram concluídas. O teste de ponta a ponta com duas contas, foto, ranking e multa paga ainda depende de uso no navegador: o ambiente de execução do Codex não consegue abrir diretamente os domínios `pages.dev` e `supabase.co`, embora as APIs de administração tenham confirmado o deploy e as configurações. Os limites e políticas dos planos gratuitos podem mudar.
