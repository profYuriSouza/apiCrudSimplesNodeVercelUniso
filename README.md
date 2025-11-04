# API Aula CRUD — 3 Repositórios (MySQL + SQLite + JSON)

Projeto didático em Node.js/Express com autenticação JWT e **três camadas de persistência**:
- **Usuários** → MySQL (via `mysql2/promise`)
- **Produtos** → Arquivo **JSON** em disco
- **Notas Fiscais** → **SQLite** (via `better-sqlite3`)

Arquitetura em camadas:
- **Routes** → **Controllers** → **Services** → **Repositories** → **(MySQL / SQLite / JSON)**
- Variáveis de ambiente centralizadas em `src/config/env.js`

---

## 1) Pré-requisitos

1. **Node.js** (18+ recomendado) e **npm**  
   Verifique:
   ```bash
   node -v
   npm -v
   ```

2. **XAMPP** (para rodar o **MySQL** no Windows)  
   - Baixe e instale o XAMPP (Apache Friends).  
   - Abra o **XAMPP Control Panel** e clique **Start** no **MySQL**. (Apache é opcional.)

3. (Opcional) Um cliente MySQL:
   - **phpMyAdmin** (vem com XAMPP): `http://localhost/phpmyadmin`
   - ou **DBeaver / Workbench / MySQL CLI**.

> **Observação:** não é preciso instalar nada extra para **SQLite** e **Produtos (JSON)**. O arquivo SQLite (`notas.db`) e o JSON (`produtos.json`) são criados automaticamente.

---

## 2) Preparar o MySQL (XAMPP)

### Opção A — via phpMyAdmin (interface gráfica)
1. Acesse `http://localhost/phpmyadmin`.
2. Em **Databases**, crie o banco: **`aula_backend_uniso`**  
   (Collation sugerida: `utf8mb4_unicode_ci`).
3. (Opcional, recomendado) Crie um usuário dedicado:
   - Usuário: `aula_user`  
   - Senha: `aula_pass`  
   - Conceda privilégios **ALL** no banco `aula_backend_uniso`.

### Opção B — via MySQL CLI
```sql
-- Conecte-se como root (no XAMPP, geralmente sem senha):
-- mysql -u root

CREATE DATABASE IF NOT EXISTS aula_backend_uniso
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Usuário dedicado (opcional):
CREATE USER IF NOT EXISTS 'aula_user'@'localhost' IDENTIFIED BY 'aula_pass';
GRANT ALL PRIVILEGES ON aula_backend_uniso.* TO 'aula_user'@'localhost';
FLUSH PRIVILEGES;
```

> A tabela `usuarios` é criada automaticamente ao iniciar a API (via `initMySql()`).

---

## 3) Instalação do projeto (após baixar o .zip)

1. **Descompacte** o `.zip` em uma pasta de sua preferência.

2. No **terminal** dentro da pasta do projeto:
   ```bash
   npm install
   ```

3. **Crie o arquivo `.env`** a partir do exemplo:
   - Windows (PowerShell):
     ```powershell
     copy .env.example .env
     ```
   - macOS/Linux:
     ```bash
     cp .env.example .env
     ```

4. **Edite o `.env`** (ajuste conforme seu ambiente):
   ```ini
   API_NAME="API Aula CRUD 3 Repositórios (Split)"
   PORT=4000
   JWT_SECRET=um-segredo-bem-grande-e-unico-para-sua-api

   # Use root sem senha (padrão XAMPP) OU seu usuário dedicado criado acima
   MYSQL_HOST=localhost
   MYSQL_USER=root
   MYSQL_PASSWORD=
   MYSQL_DATABASE=aula_backend_uniso

   SQLITE_FILE=./notas.db
   PRODUTOS_JSON=./produtos.json
   ```
   **Produção:** nunca use o `JWT_SECRET` do exemplo. Gere um valor longo e único.

5. **Ligue o MySQL no XAMPP** (MySQL → Start).

6. **Inicie a API**:
   ```bash
   npm run dev
   ```
   ou sem nodemon:
   ```bash
   npm start
   ```

7. Abra a **home** da API:  
   `http://localhost:4000/`  
   A página inicial lista rotas, exemplos e dicas.

---

## 4) Fluxo de uso (resumo das rotas)

### 1) Autenticação
- **Registrar**
  ```
  POST /api/auth/register
  Body: { "nome": "Ana", "email": "ana@empresa.com", "senha": "123456" }
  ```
- **Login**
  ```
  POST /api/auth/login
  Body: { "email": "ana@empresa.com", "senha": "123456" }
  ```
- Envie o **token JWT** nas rotas protegidas:
  ```
  Authorization: Bearer SEU_TOKEN_AQUI
  ```

### 2) Usuários (MySQL) — **protegido**
```
GET    /api/usuarios
GET    /api/usuarios/:id
PUT    /api/usuarios/:id   Body: { "nome": "Novo Nome", "email": "novo@x.com" }
DELETE /api/usuarios/:id
```

### 3) Produtos (JSON) — **protegido**
```
GET    /api/produtos
GET    /api/produtos/:id
POST   /api/produtos       Body: { "nome": "Apontador", "preco": 4.50 }
PUT    /api/produtos/:id   Body: { "nome": "Apontador Premium", "preco": 6.90 }
DELETE /api/produtos/:id
```
> O `produtos.json` é criado automaticamente com itens iniciais:  
> Caneta (3.50), Caderno (18.90), Borracha (2.20), Lápis (1.50), Guache (14.90), Sulfite (28.90), Lápis de cor (34.90), Corretivo (8.50), Mochila (159.90), Lancheira (99.90).

### 4) Notas Fiscais (SQLite) — **protegido**
```
GET    /api/notas
GET    /api/notas/:id
POST   /api/notas          Body:
{
  "numero": "NF-2025-0001",
  "cliente_nome": "Cliente Exemplo",
  "itens": [
    { "productId": 1, "qtd": 2 },
    { "productId": 7, "qtd": 1 }
  ]
}
PUT    /api/notas/:id      Body semelhante ao POST
DELETE /api/notas/:id
```
> O **total** da nota é calculado automaticamente com base no preço do produto do JSON × quantidade.

---

## 5) Testes rápidos com **cURL**

**Registrar**
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"nome":"Ana","email":"ana@empresa.com","senha":"123456"}'
```

**Login**
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@empresa.com","senha":"123456"}'
```

**Listar produtos (com token)**
```bash
curl http://localhost:4000/api/produtos \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

**Criar nota (com token)**
```bash
curl -X POST http://localhost:4000/api/notas \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "numero":"NF-2025-0001",
    "cliente_nome":"Fulano",
    "itens":[{"productId":1,"qtd":2}]
  }'
```

---

## 6) Estrutura de pastas

```
.
├── server.js
├── .env.example   → copie para .env e ajuste
├── produtos.json  → criado/sembrado automaticamente
├── notas.db       → SQLite criado automaticamente
├── src/
│   ├── config/        env.js, mysql.js, sqlite.js
│   ├── controllers/   (HTTP handlers)
│   ├── middlewares/   (auth JWT)
│   ├── models/        (Produto, Usuario, NotaFiscal)
│   ├── repositories/  (MySQL, JSON, SQLite)
│   ├── routes/        (mapeamento HTTP)
│   ├── services/      (regras de negócio)
│   └── utils/         (jwt, crypto, fsJson)
└── package.json
```

---

## 7) Solução de problemas (FAQ)

- **`EADDRINUSE: address already in use`**  
  A porta 4000 está em uso. Altere `PORT` no `.env` (ex.: `5000`) e reinicie.

- **`ER_ACCESS_DENIED_ERROR` (MySQL)**  
  Usuário/senha incorretos ou sem permissão. Ajuste `MYSQL_*` no `.env`.  
  No XAMPP, teste com root (sem senha) ou com o usuário dedicado criado.

- **`ECONNREFUSED` / `getaddrinfo ENOTFOUND` (MySQL)**  
  MySQL não está rodando ou hostname incorreto. Inicie o MySQL no XAMPP e verifique `MYSQL_HOST`.

- **`Table '...usuarios' doesn't exist`**  
  O `initMySql()` cria a tabela ao subir. Veja os logs do terminal e erros anteriores de conexão.

- **`Token inválido/expirado`**  
  Faça login novamente para obter novo token. Confirme que o `JWT_SECRET` não mudou.

- **`SQLITE_CANTOPEN` (SQLite)**  
  Caminho do `SQLITE_FILE` inválido ou sem permissão de escrita. Ajuste no `.env`.

- **Produtos não aparecem / JSON não criado**  
  O `produtos.json` é criado no primeiro boot. Se você deletar, a API recria com o *seed*.

---

## 8) Boas práticas e próximos passos

- Alterar `JWT_SECRET` para algo **longo e único** (principalmente fora do ambiente de aula).
- Usar **usuário dedicado** no MySQL com privilégios mínimos (evitar `root`).
- Centralizar logs e padronizar tratativa de erros.
- Adotar ferramenta de migrações (Knex/Prisma) se o projeto crescer.
- Separar `.env` para **desenvolvimento** e **produção**.

---

Pronto! Com o XAMPP/MySQL **ligado**, `.env` configurado e `npm run dev` no ar, acesse:

**`http://localhost:4000/`** — a “home” exibe um mini-guia das rotas, exemplos e dicas para navegar pela API.
