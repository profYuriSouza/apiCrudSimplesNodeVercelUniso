/**
 * =============================================================================
 *  server.js — PONTO DE ENTRADA DA APLICAÇÃO
 * -----------------------------------------------------------------------------
 *  O que este arquivo faz:
 *   - Cria e configura um servidor HTTP com Express.
 *   - Inicializa os bancos: MySQL (Usuários) e SQLite (Notas Fiscais).
 *   - Garante a existência do arquivo JSON de Produtos (com dados iniciais).
 *   - Faz a "injeção de dependências":
 *       Repository  ->  Service  ->  Controller  ->  Routes
 *   - Expõe uma rota "/" (home) com mini-documentação da API, exemplos e dicas.
 *
 *  Dúvidas comuns:
 *   - "Por que separar Repository/Service/Controller?"
 *       * Repository: fala com a persistência (MySQL / SQLite / JSON).
 *       * Service   : regra de negócio (validações, cálculos, orquestrações).
 *       * Controller: traduz HTTP <-> Service (lê req/res, status codes, etc.).
 *     Essa separação deixa o código mais organizado, testável e fácil de evoluir.
 * =============================================================================
 */

import express from "express";

// Configurações (leem do .env) — centralizadas em src/config/env.js
import { API_NAME, PORT, PRODUTOS_JSON } from "./src/config/env.js";

// Inicializadores dos bancos
import { initMySql, mysqlPool } from "./src/config/mysql.js";
import { initSqlite, sqliteDb } from "./src/config/sqlite.js";

// Utilitário para criar/garantir o JSON de produtos
import { ensureJsonFile } from "./src/utils/fsJson.js";

// Repositórios (cada um conversa com uma "fonte" de dados diferente)
import { UsuarioMySqlRepository } from "./src/repositories/UsuarioMySqlRepository.js";
import { ProdutoJsonRepository } from "./src/repositories/ProdutoJsonRepository.js";
import { NotaFiscalSqliteRepository } from "./src/repositories/NotaFiscalSqliteRepository.js";

// Services (regras de negócio)
import { AuthService } from "./src/services/AuthService.js";
import { UsuarioService } from "./src/services/UsuarioService.js";
import { ProdutoService } from "./src/services/ProdutoService.js";
import { NotaFiscalService } from "./src/services/NotaFiscalService.js";

// Rotas (camada HTTP) e middleware de autenticação
import { createAuthRoutes } from "./src/routes/authRoutes.js";
import { createUsuarioRoutes } from "./src/routes/usuarioRoutes.js";
import { createProdutoRoutes } from "./src/routes/produtoRoutes.js";
import { createNotaFiscalRoutes } from "./src/routes/notaFiscalRoutes.js";
import { authMiddleware } from "./src/middlewares/authMiddleware.js";

// ----------------------------------------------------------------------------
// Instancia o app Express e configura para aceitar JSON no body das requisições.
// ----------------------------------------------------------------------------
const app = express();
app.use(express.json());

/**
 * Função principal de boot:
 *  - prepara dados iniciais (produtos)
 *  - sobe MySQL e SQLite
 *  - faz a injeção de dependências (repos -> services -> controllers/routes)
 *  - registra rotas e middlewares
 */
async function bootstrap() {
  // --------------------------------------------------------------------------
  // 1) Produtos "seed" no arquivo JSON
  //    - A ideia é termos uma base inicial mais "real" para testar as notas.
  //    - Se o arquivo não existir, será criado com esse conteúdo.
  //    - Se já existir, NÃO sobrescrevemos (apenas garantimos que exista).
  // --------------------------------------------------------------------------
  await ensureJsonFile(PRODUTOS_JSON, [
    // Preços ajustados para algo mais plausível (e variados)
    { id: 1, nome: "Caneta esferográfica azul", preco: 3.5 },
    { id: 2, nome: "Caderno espiral 96 folhas", preco: 18.9 },
    { id: 3, nome: "Borracha branca", preco: 2.2 },
    { id: 4, nome: "Lápis HB nº 2", preco: 1.5 },
    { id: 5, nome: "Tinta guache 250ml", preco: 14.9 },
    { id: 6, nome: "Papel Sulfite A4 (500 folhas)", preco: 28.9 },
    { id: 7, nome: "Lápis de cor 24 cores", preco: 34.9 },
    { id: 8, nome: "Corretivo (caneta)", preco: 8.5 },
    { id: 9, nome: "Mochila escolar", preco: 159.9 },
    { id: 10, nome: "Lancheira térmica", preco: 99.9 },
  ]);

  // --------------------------------------------------------------------------
  // 2) Inicializa os bancos
  //    - MySQL: cria pool e garante tabela "usuarios"
  //    - SQLite: abre/gera arquivo e garante tabela "notas_fiscais"
  // --------------------------------------------------------------------------
  await initMySql();
  initSqlite();

  // --------------------------------------------------------------------------
  // 3) Instancia os repositórios (passando as dependências reais)
  // --------------------------------------------------------------------------
  const usuarioRepo = new UsuarioMySqlRepository(mysqlPool); // MySQL
  const produtoRepo = new ProdutoJsonRepository(PRODUTOS_JSON); // JSON
  const notaRepo = new NotaFiscalSqliteRepository(sqliteDb); // SQLite

  // --------------------------------------------------------------------------
  // 4) Instancia os services (regras de negócio)
  // --------------------------------------------------------------------------
  const authService = new AuthService(usuarioRepo);
  const usuarioService = new UsuarioService(usuarioRepo);
  const produtoService = new ProdutoService(produtoRepo);
  const notaService = new NotaFiscalService(notaRepo, produtoRepo);

  // --------------------------------------------------------------------------
  // 5) Rota "Home" (mini-documentação interativa)
  //    - Útil para o aluno visualizar rapidamente como usar a API.
  //    - Inclui exemplos de cURL e sequência típica de chamadas.
  // --------------------------------------------------------------------------
  app.get("/", (req, res) => {
    res.json({
      ok: true,
      api: API_NAME,
      descricao:
        "API didática com autenticação JWT e CRUD distribuído em 3 camadas de persistência: Usuários (MySQL), Produtos (JSON) e Notas Fiscais (SQLite).",
      requisitos_gerais: [
        "Para acessar rotas protegidas, faça login e envie o cabeçalho Authorization: Bearer <seu_token_jwt>",
        "Corpo das requisições em JSON (Content-Type: application/json).",
      ],
      fluxo_sugerido: [
        "1) POST /api/auth/register  -> criar um usuário",
        "2) POST /api/auth/login     -> obter o token JWT",
        "3) Usar o token nas rotas /api/usuarios, /api/produtos e /api/notas",
      ],
      endpoints: {
        auth: {
          register: {
            method: "POST",
            path: "/api/auth/register",
            body_exemplo: {
              nome: "Ana",
              email: "ana@empresa.com",
              senha: "123456",
            },
            retorna: "{ ok, usuarioPublico, token }",
          },
          login: {
            method: "POST",
            path: "/api/auth/login",
            body_exemplo: { email: "ana@empresa.com", senha: "123456" },
            retorna: "{ ok, usuarioPublico, token }",
          },
        },
        usuarios_mysql: {
          protegido: true,
          base: "/api/usuarios",
          rotas: {
            list: { method: "GET", path: "/api/usuarios" },
            get: { method: "GET", path: "/api/usuarios/:id" },
            update: {
              method: "PUT",
              path: "/api/usuarios/:id",
              body_exemplo: { nome: "Novo Nome", email: "novo@x.com" },
            },
            delete: { method: "DELETE", path: "/api/usuarios/:id" },
          },
          observacoes: [
            "Senha não é alterada aqui; cadastro e login ficam em /api/auth.",
            "Respostas devolvem visão pública (sem senha_hash).",
          ],
        },
        produtos_json: {
          protegido: true,
          base: "/api/produtos",
          rotas: {
            list: { method: "GET", path: "/api/produtos" },
            get: { method: "GET", path: "/api/produtos/:id" },
            create: {
              method: "POST",
              path: "/api/produtos",
              body_exemplo: { nome: "Apontador", preco: 4.5 },
            },
            update: {
              method: "PUT",
              path: "/api/produtos/:id",
              body_exemplo: { nome: "Apontador Premium", preco: 6.9 },
            },
            delete: { method: "DELETE", path: "/api/produtos/:id" },
          },
          persistencia:
            "Arquivo JSON em disco (caminho vem de .env - PRODUTOS_JSON).",
        },
        notas_sqlite: {
          protegido: true,
          base: "/api/notas",
          rotas: {
            list: { method: "GET", path: "/api/notas" },
            get: { method: "GET", path: "/api/notas/:id" },
            create: {
              method: "POST",
              path: "/api/notas",
              body_exemplo: {
                numero: "NF-2025-0001",
                cliente_nome: "Cliente Exemplo",
                itens: [
                  { productId: 1, qtd: 2 },
                  { productId: 7, qtd: 1 },
                ],
              },
              observacao:
                "O total é calculado automaticamente com base no preço do produto (JSON) x quantidade.",
            },
            update: {
              method: "PUT",
              path: "/api/notas/:id",
              body_exemplo: {
                numero: "NF-2025-0001",
                cliente_nome: "Cliente Exemplo Atualizado",
                itens: [
                  { productId: 2, qtd: 3 },
                  { productId: 4, qtd: 1 },
                ],
              },
            },
            delete: { method: "DELETE", path: "/api/notas/:id" },
          },
          persistencia:
            "Banco local SQLite (arquivo .db) criado automaticamente.",
        },
      },
      headers_importantes: {
        Authorization: "Bearer <token-jwt>",
        "Content-Type": "application/json",
      },
      curl_examples: [
        // Registro
        `curl -X POST http://localhost:${PORT}/api/auth/register -H "Content-Type: application/json" -d '{"nome":"Ana","email":"ana@empresa.com","senha":"123456"}'`,
        // Login
        `curl -X POST http://localhost:${PORT}/api/auth/login -H "Content-Type: application/json" -d '{"email":"ana@empresa.com","senha":"123456"}'`,
        // Listar produtos (exige token)
        `curl -H "Authorization: Bearer SEU_TOKEN" http://localhost:${PORT}/api/produtos`,
        // Criar nota (exige token)
        `curl -X POST http://localhost:${PORT}/api/notas -H "Authorization: Bearer SEU_TOKEN" -H "Content-Type: application/json" -d '{"numero":"NF-2025-0001","cliente_nome":"Fulano","itens":[{"productId":1,"qtd":2}]}'`,
      ],
      dicas: [
        "Mude o JWT_SECRET no .env para um valor grande e único (principalmente fora do ambiente de aula).",
        "Ajuste a porta (PORT) se der conflito com outros serviços.",
        "Se o MySQL não subir, confira usuário/senha/host no .env e se a tabela 'usuarios' foi criada.",
        "Para 'notas', verifique se o arquivo SQLite foi gerado e se há produtos válidos no JSON.",
      ],
    });
  });

  // --------------------------------------------------------------------------
  // 6) Rotas da aplicação
  //    - As rotas protegidas exigem JWT (middleware authMiddleware).
  //    - A ordem importa: primeiro /api/auth (público), depois as protegidas.
  // --------------------------------------------------------------------------
  app.use("/api/auth", createAuthRoutes({ authService }));

  app.use(
    "/api/usuarios",
    authMiddleware,
    createUsuarioRoutes({ usuarioService })
  );

  app.use(
    "/api/produtos",
    authMiddleware,
    createProdutoRoutes({ produtoService })
  );

  app.use(
    "/api/notas",
    authMiddleware,
    createNotaFiscalRoutes({ notaService })
  );

  // --------------------------------------------------------------------------
  // 7) Rota de saúde (opcional mas útil): indica que o servidor está no ar.
  // --------------------------------------------------------------------------
  app.get("/health", (req, res) => {
    res.json({
      ok: true,
      status: "UP",
      uptime_segundos: process.uptime(),
      agora_iso: new Date().toISOString(),
    });
  });

  // --------------------------------------------------------------------------
  // 8) 404 (não encontrado) — quando nenhuma rota anterior casa.
  // --------------------------------------------------------------------------
  app.use((req, res) =>
    res.status(404).json({ ok: false, error: "Rota não encontrada" })
  );

  // --------------------------------------------------------------------------
  // 9) Sobe o servidor HTTP na PORTa informada.
  // --------------------------------------------------------------------------
  app.listen(PORT, () =>
    console.log(`${API_NAME} rodando em http://localhost:${PORT}`)
  );
}

// ------------------------------------------------------------------------------
// Inicializa tudo. Se falhar em alguma etapa (ex.: conexão com MySQL), loga e sai.
// ------------------------------------------------------------------------------
bootstrap().catch((e) => {
  console.error("Erro ao iniciar:", e);
  process.exit(1);
});
