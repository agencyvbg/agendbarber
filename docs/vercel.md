# Publicação na Vercel com Services

Importe a raiz `./` do repositório e mantenha o preset **Services**. O `vercel.json` da raiz configura dois serviços independentes:

| Serviço | Diretório | Acesso público |
| --- | --- | --- |
| api | apps/api | `/api` e `/api/*` |
| web | apps/web | `/` e demais caminhos |

As regras da API vêm antes da regra geral. A Vercel preserva o caminho original; o Nest continua usando `setGlobalPrefix('api')`. No frontend, `/master`, `/app` e `/cliente` carregam `index.html` para permitir acesso direto às áreas de login.

## Chamadas e bindings

O React é servido como arquivos estáticos. O navegador chama URLs relativas `/api/...`, encaminhadas ao serviço API no mesmo domínio. Não existe função de servidor no serviço web chamando a API, nem chamada HTTP da API para web. Portanto, a configuração não declara bindings internos.

Bindings só são resolvidos em funções durante a execução, não no build, middleware ou navegador. Não substitua a URL relativa do cliente por uma URL interna e não publique credenciais em variáveis `VITE_*`. PostgreSQL, Redis, Google e os provedores de WhatsApp são dependências externas, não serviços definidos neste projeto Vercel.

## Variáveis e banco

Use `infra/vercel.env.example` como referência de nomes, substituindo os placeholders no painel da Vercel. Configure Production e Preview separadamente:

- `DATABASE_URL`: PostgreSQL gerenciado, com TLS e usuário `barberhub_app` sem superuser/BYPASSRLS. Ajuste o limite de conexões à capacidade do banco e ao número de instâncias.
- `REDIS_URL`: Redis gerenciado compatível com conexões TCP/TLS do ioredis, no formato `redis://` ou `rediss://`; não é uma URL de API REST.
- `JWT_SECRET`: segredo aleatório com pelo menos 32 caracteres.
- `WEB_ORIGIN`: origem HTTPS real da interface. Nas prévias, configure a origem correspondente; não use um wildcard para liberar origens arbitrárias.
- `NOTIFICATIONS_MODE=external` e `WHATSAPP_PROVIDER=disabled` na API enquanto o worker externo não estiver configurado.
- `GOOGLE_CLIENT_ID`: opcional; Google continua desabilitado sem essa configuração. Cadastre as origens autorizadas no provedor.

O build da API gera o Prisma Client e compila TypeScript. Não executa migrações ou seed. Prepare o banco em uma etapa operacional separada: crie o usuário restrito, aplique as migrações com o proprietário do banco e configure a API com o usuário restrito. O provedor precisa permitir a extensão `btree_gist`, os grants e as políticas RLS utilizados pelas migrações. Nunca substitua o usuário da API pelo proprietário para contornar erros de permissão.

## Worker e arquivos

O consumidor BullMQ e os timers de campanhas precisam de um processo persistente externo. A API não inicia esse consumidor na Vercel. Em um host persistente, compile a API e execute `npm run start:worker --workspace @barberhub/api`, com PostgreSQL, Redis, `WHATSAPP_PROVIDER=evolution` ou `business` e as credenciais do provedor. O worker acessa banco e Redis diretamente; não chama outro serviço HTTP do repositório. Use uma única instância de agendamento inicialmente.

Uploads e downloads de arquivos locais retornam 503 na Vercel. Para habilitá-los, implemente armazenamento persistente, como um bucket privado, preservando autorização por tenant e por usuário. O armazenamento em disco continua disponível em Docker/host persistente. Escolher o provedor e implementar seu adapter é uma etapa pendente.

## Validação antes de publicar

Confirme os nomes `api` e `web`, ambos públicos nos caminhos acima, a ausência de bindings internos e o uso de worker externo. Defina domínio, PostgreSQL, Redis e armazenamento antes de homologar os fluxos de produção. Testes locais de TypeScript e banco não confirmam um deploy Vercel.

Depois dessas decisões, publique os arquivos no GitHub e importe novamente na Vercel. Verifique o build, conexão ao banco/Redis, login e refresh, separação de empresas, acesso direto às três áreas e logs. O domínio de Preview também precisa passar pela configuração de origem. Não habilite contas de seed de desenvolvimento em produção.

Referências oficiais: [Services](https://vercel.com/docs/services), [roteamento](https://vercel.com/docs/services/routing), [bindings](https://vercel.com/docs/services/bindings) e [NestJS](https://vercel.com/docs/frameworks/backend/nestjs).
