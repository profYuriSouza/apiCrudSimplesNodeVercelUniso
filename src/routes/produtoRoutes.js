/**
 * =============================================================================
 *  src/routes/produtoRoutes.js
 * -----------------------------------------------------------------------------
 *  OBJETIVO (camada de ROTAS):
 *    - Declarar as URLs/VERBOS HTTP para operações de Produto.
 *    - Direcionar cada rota para a função correspondente do CONTROLLER.
 *
 *  POR QUE MANTER ESTA CAMADA ENXUTA?
 *    - Aqui NÃO vai regra de negócio nem acesso a dados.
 *    - Apenas mapeamos: "verbo + caminho → função do controller".
 *    - O controller lida com req/res; o service com a lógica; o repository
 *      com a persistência (neste caso, arquivo JSON).
 *
 *  INJEÇÃO DE DEPENDÊNCIAS:
 *    - Recebemos { produtoService } como parâmetro de createProdutoRoutes().
 *    - Isso facilita testes (podemos injetar um "service fake") e reduz acoplamento.
 * =============================================================================
 */

import express from "express";
import { makeProdutoController } from "../controllers/produtoController.js"; // fábrica que cria o controller já ligado ao service

/**
 * createProdutoRoutes({ produtoService })
 * -----------------------------------------------------------------------------
 * Cria e retorna um "router" do Express com as rotas de Produto.
 *
 * Parâmetros:
 *  - produtoService: objeto com os métodos de negócio (list/get/create/update/remove)
 *
 * Retorno:
 *  - Router pronto para ser montado no server.js:
 *      app.use("/api/produtos", authMiddleware, createProdutoRoutes({ produtoService }));
 */
export function createProdutoRoutes({ produtoService }) {
  // Criamos um "sub-aplicativo" para agrupar somente as rotas de produtos.
  const router = express.Router();

  // Criamos o controller injetando o service.
  // O controller sabe conversar com req/res e chamar o service corretamente.
  const ctrl = makeProdutoController({ produtoService });

  // ---------------------------------------------------------------------------
  // GET /api/produtos
  // - Lista todos os produtos.
  // - Pode evoluir no futuro para aceitar paginação/filtros via query string.
  // - Retorno típico:
  //     { ok: true, data: [ { id, nome, preco }, ... ] }
  // ---------------------------------------------------------------------------
  router.get("/", ctrl.list);

  // ---------------------------------------------------------------------------
  // GET /api/produtos/:id
  // - Retorna um único produto pelo ID.
  // - Retornos comuns:
  //     200 -> { ok: true, data: { id, nome, preco } }
  //     404 -> { ok: false, error: "Produto não encontrado" }
  // ---------------------------------------------------------------------------
  router.get("/:id", ctrl.get);

  // ---------------------------------------------------------------------------
  // POST /api/produtos
  // - Cria um novo produto.
  // - Body esperado:
  //     { "nome": "Apontador", "preco": 4.50 }
  // - Validações de domínio (nome e preço) são feitas no Model Produto.
  // - Retorno típico:
  //     201 -> { ok: true, data: { id, nome, preco } }
  // ---------------------------------------------------------------------------
  router.post("/", ctrl.create);

  // ---------------------------------------------------------------------------
  // PUT /api/produtos/:id
  // - Atualiza os dados de um produto existente (substitui campos).
  // - Body esperado (mesmo formato do POST):
  //     { "nome": "Apontador Premium", "preco": 6.90 }
  // - Retornos comuns:
  //     200 -> { ok: true, data: { id, nome, preco } }
  //     404 -> { ok: false, error: "Produto não encontrado" }
  // ---------------------------------------------------------------------------
  router.put("/:id", ctrl.update);

  // ---------------------------------------------------------------------------
  // DELETE /api/produtos/:id
  // - Remove um produto pelo ID.
  // - Retornos comuns:
  //     200 -> { ok: true }
  //     404 -> { ok: false, error: "Produto não encontrado" }
  // ---------------------------------------------------------------------------
  router.delete("/:id", ctrl.remove);

  // Retornamos o router para ser usado pela aplicação principal.
  return router;
}

/* =============================================================================
 * DICAS DE USO (cURL) — supondo a API em http://localhost:4000
 * -----------------------------------------------------------------------------
 * // IMPORTANTE: as rotas de produto são PROTEGIDAS por JWT (use Authorization).
 *
 * // 1) Listar produtos:
 * curl http://localhost:4000/api/produtos \
 *   -H "Authorization: Bearer SEU_TOKEN"
 *
 * // 2) Obter produto por id:
 * curl http://localhost:4000/api/produtos/1 \
 *   -H "Authorization: Bearer SEU_TOKEN"
 *
 * // 3) Criar produto:
 * curl -X POST http://localhost:4000/api/produtos \
 *   -H "Authorization: Bearer SEU_TOKEN" \
 *   -H "Content-Type: application/json" \
 *   -d '{"nome":"Apontador","preco":4.50}'
 *
 * // 4) Atualizar produto:
 * curl -X PUT http://localhost:4000/api/produtos/1 \
 *   -H "Authorization: Bearer SEU_TOKEN" \
 *   -H "Content-Type: application/json" \
 *   -d '{"nome":"Apontador Premium","preco":6.90}'
 *
 * // 5) Deletar produto:
 * curl -X DELETE http://localhost:4000/api/produtos/1 \
 *   -H "Authorization: Bearer SEU_TOKEN"
 *
 * OBSERVAÇÕES PEDAGÓGICAS:
 *  - A validação de "nome" e "preço" NÃO é responsabilidade das rotas. Ela acontece
 *    no Model Produto (src/models/Produto.js) e é acionada pelo Service/Controller.
 *  - Esta divisão deixa o código mais limpo, testável e fácil de evoluir.
 * =============================================================================
 */
