# Juntos — desafios em família

Site para acompanhar objetivos pessoais em grupo. Cada participante cria metas com prazo, unidade e multa; registra progresso por dia com texto e foto; e acompanha ranking, ausência de registros e progresso da família. Há objetivos únicos e recorrentes: diários, semanais com quantidade de dias, mensais e anuais. O dono pode pedir a edição de uma meta ainda aberta ou a exclusão de uma meta, e os demais integrantes decidem conforme a regra de aprovação do grupo. Novos objetivos são criados sem votação. Registros individuais feitos por engano continuam podendo ser excluídos pelo autor.

O resultado final usa apenas registros datados **até o prazo**. Em objetivos únicos, a meta numérica é acumulada até a data final; a frequência semanal opcional é apenas um indicador. Em objetivos recorrentes, a meta numérica vale **por dia**, **por dia escolhido da semana**, **por mês** ou **por ano**. Na opção semanal, cada dia só conta se atingir a meta numérica daquele dia; semanas parciais exigem no máximo o número de dias disponíveis. Meses e anos parciais mantêm a meta numérica integral. Registros recorrentes só podem ser feitos **no próprio dia, pelo horário de Brasília**. Para metas diárias e semanais há um botão para marcar o dia como cumprido; ele completa apenas a quantidade que falta naquele dia. Um período encerrado sem cumprir gera uma multa informativa **por ocorrência faltante**. Na opção semanal, faltar dois dias gera duas multas. O dono pode marcar cada multa como paga. O site não processa pagamentos.

Quem criou o grupo define um quórum único em número de pessoas ou porcentagem dos demais integrantes. O dono do objetivo não vota no próprio pedido. A porcentagem é arredondada para cima. O grupo de votantes e o número necessário ficam registrados quando cada pedido é feito; mudanças na regra valem para novos pedidos. Cada pessoa pode autorizar ou recusar uma vez. A edição ou exclusão só é aplicada quando o quórum é atingido; se não houver outros participantes, é aplicada na hora. Objetivos excluídos somem do site e do ranking, mas o banco guarda o histórico para auditoria. O criador do grupo pode enviar uma imagem de QR Code Pix compartilhada, exibida para todos na página da família e quando há multa a pagar. O site não processa pagamentos.

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
npm run smoke:recurring
npm run build
```

O teste de navegador usa Chromium em `/usr/bin/chromium`; defina `CHROMIUM_PATH` se ele estiver em outro caminho. Quando as variáveis do Supabase estão presentes, o teste entra pela opção **Explorar demonstração** e não modifica o banco.

## Dados compartilhados no Supabase

No projeto Supabase, aplique as migrações **na ordem**:

1. [Estrutura inicial](supabase/migrations/20261016000000_initial.sql): grupos, contas, metas, registros, regras de acesso e fotos privadas. **Já aplicada** ao projeto Projeto-Ovelhas em 16/10/2026.
2. [Controles de metas e multas](supabase/migrations/20261016000001_goal_controls.sql): edição de metas, exclusão de registros, multas pagas e proteção do prazo. **Já aplicada** ao projeto Projeto-Ovelhas em 18/10/2026.
3. [Base de aprovações](supabase/migrations/20261018000000_goal_approvals_pix.sql): pedidos e votos protegidos no banco e exclusão lógica. **Já aplicada** ao projeto Projeto-Ovelhas em 18/10/2026.
4. [Regra e Pix do grupo](supabase/migrations/20261018000001_group_rule_pix_image.sql): quórum único por grupo, imagem Pix privada e permissões exclusivas do criador. **Já aplicada** ao projeto Projeto-Ovelhas em 18/10/2026.
5. [Objetivos recorrentes](supabase/migrations/20261019000000_recurring_goals.sql): agenda diária, semanal, mensal e anual; multas por ocorrência e pagamentos individuais com acesso protegido. **Já aplicada** ao projeto Projeto-Ovelhas em 19/10/2026.
6. [Registro no próprio dia](supabase/migrations/20261019000001_recurring_same_day_entries.sql): impede registros retroativos nas metas recorrentes no banco de dados. **Já aplicada** ao projeto Projeto-Ovelhas em 19/10/2026.

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
