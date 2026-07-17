# GML - Controle de Viaturas

Sistema de controle e gestão de viaturas da Guarda Municipal de Laguna (GML).

## Visão Geral
projeto inicial do controle de viaturas
Este é um aplicativo web progressivo (PWA) para gerenciamento de frota de viaturas, permitindo:
- Registro de saída e retorno de viaturas
- Controle de abastecimento
- Dashboard com indicadores em tempo real
- Acesso offline via PWA
- com facil acessibilidade

## Tecnologias

- **Backend**: Flask 3.0 + SQLAlchemy 2.0
- **Banco de Dados**: PostgreSQL via Supabase
- **Frontend**: HTML5, CSS3, JavaScript vanilla
- **Autenticação**: Supabase Auth
- **Deploy**: Vercel (serverless functions)

## Pré-requisitos

- Python 3.9+
- Conta no [Supabase](https://supabase.com)
- Conta no [Vercel](https://vercel.com) (opcional, para deploy)
- Node.js 16+ (opcional, para gerar ícones)

## Configuração Local

### 1. Clone o repositório

```bash
git clone <url-do-repositorio>
cd "controle de viaturas"
```

### 2. Configure as variáveis de ambiente

```bash
# Copie o arquivo de exemplo
cp .env.example .env

# Edite o arquivo .env com suas credenciais do Supabase
```

Edite o arquivo `.env` com as seguintes informações do seu projeto Supabase:

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_KEY=sua-service-key
SUPABASE_DB_URL=postgresql+psycopg2://postgres.user:[SENHA]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

### 3. Instale as dependências

```bash
pip install -r requirements.txt
```

### 4. Execute o servidor local

```bash
python api/index.py
```

O servidor estará disponível em `http://localhost:5000`

### 5. Configure as credenciais no frontend

Para desenvolvimento local, as credenciais do Supabase podem ser configuradas via localStorage:

1. Abra o navegador em `http://localhost:5000`
2. Abra o console do desenvolvedor (F12)
3. Execute:

```javascript
localStorage.setItem('SUPABASE_URL', 'https://seu-projeto.supabase.co');
localStorage.setItem('SUPABASE_ANON_KEY', 'sua-anon-key');
```

## Configuração do Supabase

### 1. Criar projeto

1. Acesse [supabase.com](https://supabase.com) e crie uma conta
2. Crie um novo projeto
3. Anote a URL e as chaves (Settings > API)

### 2. Executar schema SQL

No SQL Editor do Supabase, execute o conteúdo do arquivo `backend/supabase_schema.sql` para criar as tabelas necessárias.

### 3. Configurar autenticação

1. Vá em Authentication > Settings
2. Configure os provedores de autenticação desejados (Email, Google, etc.)
3. Em Authentication > URL Configuration, adicione suas URLs de redirecionamento

### 4. Obter credenciais de conexão do banco

1. Vá em Settings > Database
2. Em "Connection string", selecione "URI"
3. Copie a string de conexão e substitua `[YOUR-PASSWORD]` pela senha do banco
4. Adicione `+psycopg2` após `postgresql` na string

Exemplo:
```
postgresql+psycopg2://postgres.xxx:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

## Deploy na Vercel

### 1. Instale a CLI da Vercel

```bash
npm i -g vercel
```

### 2. Faça login

```bash
vercel login
```

### 3. Deploy

```bash
vercel --prod
```

### 4. Configure as variáveis de ambiente

1. Acesse o dashboard da Vercel
2. Selecione seu projeto
3. Vá em Settings > Environment Variables
4. Adicione todas as variáveis do arquivo `.env`

### 5. Redeploy (se necessário)

```bash
vercel --prod
```

## Instalação como Aplicativo (PWA)

### Android

1. Abra o site no Chrome
2. Toque no menu (3 pontos) > "Adicionar à tela inicial"
3. Confirme a instalação

### iOS (iPhone/iPad)

1. Abra o site no Safari
2. Toque no botão Compartilhar
3. Role para baixo e toque em "Adicionar à Tela de Início"
4. Confirme a instalação

### Desktop (Chrome/Edge)

1. Abra o site
2. Clique no ícone de instalação na barra de endereço
3. Siga as instruções de instalação

## Gerar Ícones do Aplicativo

O arquivo `frontend/icons/icon.svg` pode ser usado para gerar todos os ícones necessários:

```bash
cd frontend/icons

# Usando sharp-cli
npm install -g sharp-cli

sharp icon.svg --resize 72x72 --output icon-72x72.png
sharp icon.svg --resize 96x96 --output icon-96x96.png
sharp icon.svg --resize 128x128 --output icon-128x128.png
sharp icon.svg --resize 144x144 --output icon-144x144.png
sharp icon.svg --resize 152x152 --output icon-152x152.png
sharp icon.svg --resize 192x192 --output icon-192x192.png
sharp icon.svg --resize 384x384 --output icon-384x384.png
sharp icon.svg --resize 512x512 --output icon-512x512.png
```

Ou use uma ferramenta online como [PWA Asset Generator](https://pwa-asset-generator.nicepkg.cn/).

## Futuro: Geração de APK Android

Para gerar um APK nativo a partir deste PWA, existem várias opções:

### Opção 1: Trusted Web Activity (TWA) - Recomendada

1. Use o [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap):

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://seu-site.vercel.app/manifest.json
bubblewrap build
```

2. O APK será gerado na pasta `app/build/outputs/apk/release/`

### Opção 2: PWA Builder

1. Acesse [PWABuilder](https://www.pwabuilder.com/)
2. Insira a URL do seu site
3. Siga as instruções para gerar o pacote Android

### Opção 3: Capacitor (mais controle)

1. Adicione Capacitor ao projeto:

```bash
npm install @capacitor/core @capacitor/cli
npx cap init
npx cap add android
npx cap sync
npx cap open android
```

2. Compile o APK no Android Studio

## Estrutura do Projeto

```
.
├── api/
│   └── index.py              # Entry point para Vercel
├── backend/
│   ├── controllers/          # Rotas Flask (blueprints)
│   ├── models/               # Modelos SQLAlchemy
│   ├── services/             # Lógica de negócio
│   ├── routes/               # Rotas adicionais
│   ├── supabase_client.py    # Cliente Supabase
│   └── supabase_schema.sql   # Schema do banco
├── frontend/
│   ├── css/                  # Estilos
│   ├── js/                   # Scripts
│   ├── icons/                # Ícones PWA
│   ├── manifest.json         # Manifesto PWA
│   ├── service-worker.js     # Service Worker
│   └── *.html                # Páginas
├── requirements.txt          # Dependências Python
├── vercel.json              # Configuração Vercel
└── .env.example             # Template de variáveis
```

## Segurança

- Nunca commit o arquivo `.env`
- A chave `SUPABASE_SERVICE_KEY` deve permanecer apenas no backend
- No frontend, use apenas a `SUPABASE_ANON_KEY`
- Configure CORS apropriadamente para produção
- Use HTTPS em produção (Vercel fornece automaticamente)

## Troubleshooting

### Erro de conexão com Supabase

Verifique se as variáveis de ambiente estão configuradas corretamente:

```bash
# Teste local
python -c "import os; from dotenv import load_dotenv; load_dotenv(); print(os.getenv('SUPABASE_URL'))"
```

### Service Worker não registra

Verifique se o site está sendo servido via HTTPS (necessário para PWA em produção).

### Ícones não aparecem na instalação

Verifique se todos os arquivos PNG estão presentes em `frontend/icons/` e se os caminhos no `manifest.json` estão corretos.

## Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## Licença

## Licença

Este projeto foi desenvolvido por João Henrique Fanfa como solução para a Guarda Municipal de Laguna.

Todos os direitos de desenvolvimento são reservados ao autor, sendo o sistema apresentado como parte de portfólio.

## Suporte

Para suporte, entre em contato comigo ou com a equipe 
