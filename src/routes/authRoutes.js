/**
 * =============================================================================
 *  src/routes/authRoutes.js
 * -----------------------------------------------------------------------------
 *  OBJETIVO DESTE ARQUIVO (CAMADA DE ROTAS):
 *    - Declarar as rotas HTTP relacionadas à AUTENTICAÇÃO.
 *    - Encaminhar as requisições para o CONTROLLER adequado.
 *
 *  POR QUE SEPARAR "ROUTES" DE "CONTROLLERS"?
 *    - "Routes" só mapeia VERBO + CAMINHO → FUNÇÃO.
 *    - "Controller" contém a lógica de lidar com req/res (extrair dados,
 *      tratar erros, enviar status code, etc.), chamando os "Services",
 *      que por sua vez usam os "Repositories".
 *
 *  INJEÇÃO DE DEPENDÊNCIA (DI):
 *    - Repare que recebemos { authService } nos parâmetros da função
 *      createAuthRoutes(). Isso evita "importar direto" dentro do controller
 *      e facilita testes (podemos simular um authService falso).
 * =============================================================================
 */

import express from "express";
import { makeAuthController } from "../controllers/authController.js"; // fábrica que cria o controller já "amarrado" ao service

/**
 * createAuthRoutes({ authService })
 * -----------------------------------------------------------------------------
 * Cria e devolve um "router" do Express com as rotas de autenticação.
 *
 * Parâmetro esperado:
 *  - authService: objeto com métodos de autenticação (register/login) que
 *                 o controller vai usar. (Ele é passado lá no server.js)
 *
 * Retorno:
 *  - Um router pronto para ser usado em app.use('/api/auth', router)
 *
 * Rotas expostas:
 *  - POST /register  → cria um usuário (hash de senha + salva no MySQL)
 *  - POST /login     → verifica credenciais e devolve um token JWT
 */
export function createAuthRoutes({ authService }) {
  // Criamos um "sub-aplicativo" de rotas do Express.
  const router = express.Router();

  // Criamos o controller, passando o service (injeção de dependência).
  // Assim, o controller pode chamar authService.register(...) / authService.login(...)
  const ctrl = makeAuthController({ authService });

  // ---------------------------------------------------------------------------
  // POST /register
  // - Espera body: { nome, email, senha }
  // - Fluxo típico:
  //     1) Controller valida dados básicos (existem? tipos?).
  //     2) Service: gera hash da senha e cria usuário (MySQL via repository).
  //     3) Opcionalmente, já faz login e retorna token junto do usuário público.
  // - Resposta de sucesso (exemplo):
  //     { ok: true, usuarioPublico: {...}, token: "..." }
  // - Erros comuns:
  //     400 (dados inválidos), 409 (email já usado), 500 (erro interno).
  // ---------------------------------------------------------------------------
  router.post("/register", ctrl.register);

  // ---------------------------------------------------------------------------
  // POST /login
  // - Espera body: { email, senha }
  // - Fluxo típico:
  //     1) Controller valida presença de email/senha.
  //     2) Service: busca usuário por email, compara senha com bcrypt.
  //     3) Se bater, gera JWT (expiração curta) e devolve.
  // - Resposta de sucesso (exemplo):
  //     { ok: true, usuarioPublico: {...}, token: "..." }
  // - Erros comuns:
  //     401 (credenciais inválidas), 500 (erro interno).
  // ---------------------------------------------------------------------------
  router.post("/login", ctrl.login);

  // Retornamos o router para ser montado em server.js
  return router;
}

/* =============================================================================
 * DICAS DE TESTE RÁPIDO (cURL) — supondo a API rodando em http://localhost:4000
 * -----------------------------------------------------------------------------
 * 1) Registrar usuário:
 * curl -X POST http://localhost:4000/api/auth/register \
 *   -H "Content-Type: application/json" \
 *   -d '{"nome":"Ana","email":"ana@empresa.com","senha":"123456"}'
 *
 * 2) Fazer login:
 * curl -X POST http://localhost:4000/api/auth/login \
 *   -H "Content-Type: application/json" \
 *   -d '{"email":"ana@empresa.com","senha":"123456"}'
 *
 * 3) Usar o token (exemplo: listar produtos):
 * curl http://localhost:4000/api/produtos \
 *   -H "Authorization: Bearer SEU_TOKEN_AQUI"
 *
 * OBSERVAÇÃO:
 *  - Rotas de autenticação (register/login) são PÚBLICAS.
 *  - As demais (usuarios, produtos, notas) são PROTEGIDAS pelo middleware JWT.
 * =============================================================================
 */
