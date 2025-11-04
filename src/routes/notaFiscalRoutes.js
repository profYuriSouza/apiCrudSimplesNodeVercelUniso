/**
 * =============================================================================
 *  src/routes/notaFiscalRoutes.js
 * -----------------------------------------------------------------------------
 *  OBJETIVO DESTE ARQUIVO (CAMADA DE ROTAS):
 *    - Mapear as URLs/VERBOS HTTP para as funções do CONTROLLER de Nota Fiscal.
 *    - Manter este arquivo ENXUTO: aqui só declaramos rotas e conectamos ao
 *      controller. A lógica (validar req/res, chamar service, status codes) fica
 *      no controller; as regras de negócio ficam no service; e o acesso a dados
 *      fica no repository.
 *
 *  INJEÇÃO DE DEPENDÊNCIA:
 *    - A função createNotaFiscalRoutes recebe { notaService } de fora (server.js).
 *      Isso facilita testes (podemos passar um service falso) e evita acoplamento.
 *
 *  ROTAS EXPOSITAS (todas protegidas por JWT no server.js):
 *    - GET    /api/notas         -> listar notas
 *    - GET    /api/notas/:id     -> obter uma nota por id
 *    - POST   /api/notas         -> criar nova nota
 *    - PUT    /api/notas/:id     -> atualizar nota existente
 *    - DELETE /api/notas/:id     -> remover nota existente
 *
 *  CORPOS ESPERADOS:
 *    - POST/PUT: { numero, cliente_nome, itens: [{ productId, qtd }, ...] }
 *      * O "total" é calculado no Service com base nos preços do Produto (JSON).
 * =============================================================================
 */

import express from "express";
import { makeNotaFiscalController } from "../controllers/notaFiscalController.js"; // fábrica que "amarra" o service

/**
 * createNotaFiscalRoutes({ notaService })
 * -----------------------------------------------------------------------------
 * Cria e devolve um Router do Express com as rotas de Nota Fiscal.
 *
 * Parâmetros:
 *  - notaService: objeto com a lógica de negócio de NFs (list/get/create/update/delete).
 *
 * Retorno:
 *  - router configurado para ser montado em server.js:
 *      app.use("/api/notas", authMiddleware, createNotaFiscalRoutes({ notaService }));
 */
export function createNotaFiscalRoutes({ notaService }) {
  // Criamos um "sub-aplicativo" só para as rotas de notas.
  const router = express.Router();

  // Criamos o controller passando o service (injeção de dependência).
  const ctrl = makeNotaFiscalController({ notaService });

  // ---------------------------------------------------------------------------
  // GET /api/notas
  // - Lista todas as notas (pode ter paginação no futuro).
  // - Controller: extrai filtros se existirem (futuro), chama service.list().
  // - Retorno típico: { ok: true, data: [ ...notas ] }
  // ---------------------------------------------------------------------------
  router.get("/", ctrl.list);

  // ---------------------------------------------------------------------------
  // GET /api/notas/:id
  // - Busca uma única nota pelo ID.
  // - Controller: valida :id (número), chama service.getById(id).
  // - Retornos comuns:
  //     200 -> { ok: true, data: { ...nota } }
  //     404 -> { ok: false, error: "Nota não encontrada" }
  // ---------------------------------------------------------------------------
  router.get("/:id", ctrl.get);

  // ---------------------------------------------------------------------------
  // POST /api/notas
  // - Cria uma nova nota fiscal.
  // - Body esperado:
  //     {
  //       "numero": "NF-2025-0001",
  //       "cliente_nome": "Cliente Exemplo",
  //       "itens": [
  //         { "productId": 1, "qtd": 2 },
  //         { "productId": 7, "qtd": 1 }
  //       ]
  //     }
  // - Controller: valida campos mínimos, chama service.create(payload).
  // - Service: valida itens, busca preços dos produtos (JSON), calcula TOTAL,
  //            cria Model NotaFiscal e persiste no SQLite via repository.
  // - Retorno típico: 201 -> { ok: true, data: { ...notaCriada } }
  // ---------------------------------------------------------------------------
  router.post("/", ctrl.create);

  // ---------------------------------------------------------------------------
  // PUT /api/notas/:id
  // - Atualiza uma nota existente (substitui campos).
  // - Body esperado: mesmo formato do POST.
  // - Controller: valida :id + body, chama service.update(id, payload).
  // - Retornos comuns:
  //     200 -> { ok: true, data: { ...notaAtualizada } }
  //     404 -> { ok: false, error: "Nota não encontrada" }
  // ---------------------------------------------------------------------------
  router.put("/:id", ctrl.update);

  // ---------------------------------------------------------------------------
  // DELETE /api/notas/:id
  // - Remove uma nota por ID.
  // - Controller: valida :id, chama service.remove(id).
  // - Retornos comuns:
  //     200 -> { ok: true }
  //     404 -> { ok: false, error: "Nota não encontrada" }
  // ---------------------------------------------------------------------------
  router.delete("/:id", ctrl.remove);

  // Retornamos o router pronto para ser montado na aplicação principal.
  return router;
}

/* =============================================================================
 * DICAS DE TESTE RÁPIDO (cURL) — supondo API em http://localhost:4000
 * -----------------------------------------------------------------------------
 * // LEMBRE-SE: rotas de notas exigem JWT:
 * //   Authorization: Bearer SEU_TOKEN
 *
 * // 1) Listar notas:
 * curl http://localhost:4000/api/notas \
 *   -H "Authorization: Bearer SEU_TOKEN"
 *
 * // 2) Criar nota:
 * curl -X POST http://localhost:4000/api/notas \
 *   -H "Authorization: Bearer SEU_TOKEN" \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "numero":"NF-2025-0001",
 *     "cliente_nome":"Fulano",
 *     "itens":[{"productId":1,"qtd":2},{"productId":7,"qtd":1}]
 *   }'
 *
 * // 3) Obter nota por id:
 * curl http://localhost:4000/api/notas/1 \
 *   -H "Authorization: Bearer SEU_TOKEN"
 *
 * // 4) Atualizar nota:
 * curl -X PUT http://localhost:4000/api/notas/1 \
 *   -H "Authorization: Bearer SEU_TOKEN" \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "numero":"NF-2025-0001",
 *     "cliente_nome":"Fulano de Tal",
 *     "itens":[{"productId":2,"qtd":3}]
 *   }'
 *
 * // 5) Deletar nota:
 * curl -X DELETE http://localhost:4000/api/notas/1 \
 *   -H "Authorization: Bearer SEU_TOKEN"
 * =============================================================================
 */
