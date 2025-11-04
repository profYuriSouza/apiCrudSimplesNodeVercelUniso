/**
 * =============================================================================
 *  src/routes/usuarioRoutes.js
 * -----------------------------------------------------------------------------
 *  OBJETIVO (camada de ROTAS):
 *    - Declarar as URLs/VERBOS HTTP para operações com Usuários.
 *    - Encaminhar cada rota para o CONTROLLER correto.
 *
 *  IMPORTANTE:
 *    - Não existe rota POST /api/usuarios para criar usuário aqui.
 *      O cadastro (criação) é responsabilidade de /api/auth/register.
 *      Motivo: no cadastro já geramos o hash da senha (bcrypt) e validamos credenciais.
 *
 *  ARQUITETURA (lembrete rápido):
 *    - ROUTES: mapeia "verbo + caminho" → controller (sem regra de negócio aqui).
 *    - CONTROLLER: lida com req/res, status codes e chama o SERVICE.
 *    - SERVICE: contém as regras de negócio e conversa com o REPOSITORY.
 *    - REPOSITORY: acessa o MySQL (CRUD na tabela "usuarios").
 *
 *  INJEÇÃO DE DEPENDÊNCIA:
 *    - Recebemos { usuarioService } como parâmetro de createUsuarioRoutes().
 *    - Assim, o controller não precisa "importar" diretamente o service.
 *      Isso facilita testes (podemos injetar um service "fake") e reduz acoplamento.
 * =============================================================================
 */

import express from "express";
import { makeUsuarioController } from "../controllers/usuarioController.js"; // fábrica que cria o controller já ligado ao service

/**
 * createUsuarioRoutes({ usuarioService })
 * -----------------------------------------------------------------------------
 * Cria e retorna um Router do Express com as rotas de Usuário.
 *
 * Parâmetros:
 *  - usuarioService: objeto com os métodos de negócio (list/get/update/remove).
 *
 * Retorno:
 *  - Router pronto para ser montado no server.js:
 *      app.use("/api/usuarios", authMiddleware, createUsuarioRoutes({ usuarioService }));
 *
 * Rotas expostas (todas PROTEGIDAS por JWT no server.js):
 *  - GET    /api/usuarios       → list
 *  - GET    /api/usuarios/:id   → get
 *  - PUT    /api/usuarios/:id   → update (não mexe em senha aqui)
 *  - DELETE /api/usuarios/:id   → remove
 */
export function createUsuarioRoutes({ usuarioService }) {
  // "Sub-aplicativo" de rotas do Express para agrupar endpoints de usuário.
  const router = express.Router();

  // Cria o controller injetando o service.
  const ctrl = makeUsuarioController({ usuarioService });

  // ---------------------------------------------------------------------------
  // GET /api/usuarios
  // - Lista todos os usuários (visão pública: sem senha_hash).
  // - Pode receber paginação/filtros no futuro (ex.: ?page=1&limit=20).
  // - Resposta típica:
  //     200 -> { ok: true, data: [ { id, nome, email, created_at }, ... ] }
  // ---------------------------------------------------------------------------
  router.get("/", ctrl.list);

  // ---------------------------------------------------------------------------
  // GET /api/usuarios/:id
  // - Retorna um único usuário pelo ID (visão pública).
  // - Respostas comuns:
  //     200 -> { ok: true, data: { id, nome, email, created_at } }
  //     404 -> { ok: false, error: "Usuário não encontrado" }
  // ---------------------------------------------------------------------------
  router.get("/:id", ctrl.get);

  // ---------------------------------------------------------------------------
  // PUT /api/usuarios/:id
  // - Atualiza dados básicos (nome, email). A senha NÃO é atualizada aqui.
  // - Body esperado:
  //     { "nome": "Novo Nome", "email": "novo@empresa.com" }
  // - Respostas comuns:
  //     200 -> { ok: true, data: { id, nome, email, created_at } }
  //     400 -> { ok: false, error: "Dados inválidos" }
  //     404 -> { ok: false, error: "Usuário não encontrado" }
  // ---------------------------------------------------------------------------
  router.put("/:id", ctrl.update);

  // ---------------------------------------------------------------------------
  // DELETE /api/usuarios/:id
  // - Remove um usuário pelo ID.
  // - Respostas comuns:
  //     200 -> { ok: true }
  //     404 -> { ok: false, error: "Usuário não encontrado" }
  // ---------------------------------------------------------------------------
  router.delete("/:id", ctrl.remove);

  // Retorna o router montado.
  return router;
}

/* =============================================================================
 * DICAS DE TESTE (cURL) — supondo API em http://localhost:4000
 * -----------------------------------------------------------------------------
 * // ATENÇÃO: Todas as rotas de usuário exigem JWT:
 * //   Authorization: Bearer SEU_TOKEN
 *
 * // 1) Listar usuários:
 * curl http://localhost:4000/api/usuarios \
 *   -H "Authorization: Bearer SEU_TOKEN"
 *
 * // 2) Buscar por id (ex.: id=1):
 * curl http://localhost:4000/api/usuarios/1 \
 *   -H "Authorization: Bearer SEU_TOKEN"
 *
 * // 3) Atualizar (nome/email):
 * curl -X PUT http://localhost:4000/api/usuarios/1 \
 *   -H "Authorization: Bearer SEU_TOKEN" \
 *   -H "Content-Type: application/json" \
 *   -d '{"nome":"Ana Maria","email":"ana.maria@empresa.com"}'
 *
 * // 4) Remover:
 * curl -X DELETE http://localhost:4000/api/usuarios/1 \
 *   -H "Authorization: Bearer SEU_TOKEN"
 *
 * OBSERVAÇÕES:
 *  - Criação de usuário é via /api/auth/register (porque lá fazemos hash da senha).
 *  - A visão pública do usuário NUNCA inclui "senha_hash".
 *  - Validações de domínio (ex.: e-mail) são feitas no Model/Service.
 * =============================================================================
 */
