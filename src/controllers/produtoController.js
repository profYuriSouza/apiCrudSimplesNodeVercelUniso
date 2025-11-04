/**
 * =============================================================================
 *  src/controllers/produtoController.js
 * -----------------------------------------------------------------------------
 *  PAPEL DO CONTROLLER:
 *    - Fica ENTRE a camada HTTP (rotas) e a REGRA DE NEGÓCIO (Service).
 *    - Lê dados de req.params / req.body / req.query.
 *    - Chama o service (que valida e conversa com o repository).
 *    - Traduz o resultado para HTTP (status + JSON) e trata erros.
 *
 *  SOBRE PRODUTOS NESTE PROJETO:
 *    - Persistência em ARQUIVO JSON via ProdutoJsonRepository.
 *    - O Model Produto valida nome/preço (ex.: nome mínimo, preço >= 0).
 *    - O Service retorna sempre objetos "planos" (toPlain) para responder a API.
 *
 *  STATUS CODES USADOS:
 *    - 200 OK            → leitura/atualização/remoção com sucesso.
 *    - 201 Created       → criação concluída.
 *    - 400 Bad Request   → dados inválidos (validação de domínio).
 *    - 404 Not Found     → id inexistente.
 *    - 500 Internal Error→ erro inesperado (ex.: I/O no JSON).
 * =============================================================================
 */

export function makeProdutoController({ produtoService }) {
  return {
    /**
     * ---------------------------------------------------------------------------
     * GET /api/produtos
     * ---------------------------------------------------------------------------
     * OBJETIVO:
     *   - Listar todos os produtos.
     *
     * COMO FUNCIONA:
     *   - Service.list() carrega do repository (JSON), converte Models → planos.
     *   - Retornamos { ok: true, data: [...] } com status 200.
     *
     * OBSERVAÇÃO:
     *   - Em caso de erros inesperados (I/O), enviamos 500 para o cliente.
     */
    list: async (req, res) => {
      try {
        const data = await produtoService.list();
        return res.json({ ok: true, data });
      } catch (e) {
        return res.status(500).json({ ok: false, error: e.message });
      }
    },

    /**
     * ---------------------------------------------------------------------------
     * GET /api/produtos/:id
     * ---------------------------------------------------------------------------
     * OBJETIVO:
     *   - Buscar UM produto por id.
     *
     * COMO FUNCIONA:
     *   - Convertemos :id para número (boa prática para deixar explícito o tipo).
     *   - Chamamos service.get(id). Se não existir, o service lança Error e
     *     aqui traduzimos para 404.
     */
    get: async (req, res) => {
      try {
        const id = Number(req.params.id); // Number(...) para garantir tipo numérico
        const data = await produtoService.get(id);
        return res.json({ ok: true, data });
      } catch (e) {
        return res.status(404).json({ ok: false, error: e.message });
      }
    },

    /**
     * ---------------------------------------------------------------------------
     * POST /api/produtos
     * ---------------------------------------------------------------------------
     * OBJETIVO:
     *   - Criar um novo produto.
     *
     * ENTRADA (req.body):
     *   { nome: string, preco: number }
     *
     * COMO FUNCIONA:
     *   - Extraímos nome e preço do body.
     *   - Chamamos service.create({ nome, preco }).
     *     * O Model valida nome/preço (lança erro se inválidos).
     *   - Em sucesso, respondemos 201 + objeto criado.
     *   - Em validação inválida, respondemos 400.
     */
    create: async (req, res) => {
      try {
        const { nome, preco } = req.body || {};
        const data = await produtoService.create({ nome, preco });
        return res.status(201).json({ ok: true, data });
      } catch (e) {
        return res.status(400).json({ ok: false, error: e.message });
      }
    },

    /**
     * ---------------------------------------------------------------------------
     * PUT /api/produtos/:id
     * ---------------------------------------------------------------------------
     * OBJETIVO:
     *   - Atualizar nome/preço de um produto existente.
     *
     * ENTRADA:
     *   - :id no path (ex.: /api/produtos/10)
     *   - body: { nome?: string, preco?: number }
     *
     * COMO FUNCIONA:
     *   - Convertemos :id para número.
     *   - Chamamos service.update(id, { nome, preco }).
     *     * O service busca o atual, aplica os novos valores (ou mantém antigos),
     *       revalida com o Model e salva no JSON via repository.
     *   - Sucesso → 200 { ok: true, data }.
     *   - Erros de validação / não encontrado → 400 (simples para a aula).
     */
    update: async (req, res) => {
      try {
        const id = Number(req.params.id);
        const { nome, preco } = req.body || {};
        const data = await produtoService.update(id, { nome, preco });
        return res.json({ ok: true, data });
      } catch (e) {
        return res.status(400).json({ ok: false, error: e.message });
      }
    },

    /**
     * ---------------------------------------------------------------------------
     * DELETE /api/produtos/:id
     * ---------------------------------------------------------------------------
     * OBJETIVO:
     *   - Remover um produto por id.
     *
     * COMO FUNCIONA:
     *   - Convertemos :id para número e chamamos service.remove(id).
     *   - Em sucesso → 200 { ok: true }.
     *   - Se não existir → 404.
     */
    remove: async (req, res) => {
      try {
        const id = Number(req.params.id);
        await produtoService.remove(id);
        return res.json({ ok: true });
      } catch (e) {
        return res.status(404).json({ ok: false, error: e.message });
      }
    },
  };
}

/* =============================================================================
 * TESTES RÁPIDOS (cURL) — lembrando: rotas de produto exigem JWT!
 * -----------------------------------------------------------------------------
 * # 1) Listar
 * curl http://localhost:4000/api/produtos \
 *   -H "Authorization: Bearer SEU_TOKEN"
 *
 * # 2) Obter por id
 * curl http://localhost:4000/api/produtos/1 \
 *   -H "Authorization: Bearer SEU_TOKEN"
 *
 * # 3) Criar
 * curl -X POST http://localhost:4000/api/produtos \
 *   -H "Authorization: Bearer SEU_TOKEN" \
 *   -H "Content-Type: application/json" \
 *   -d '{"nome":"Caderno Universitário","preco":21.90}'
 *
 * # 4) Atualizar
 * curl -X PUT http://localhost:4000/api/produtos/1 \
 *   -H "Authorization: Bearer SEU_TOKEN" \
 *   -H "Content-Type: application/json" \
 *   -d '{"nome":"Caderno 96 folhas","preco":18.50}'
 *
 * # 5) Remover
 * curl -X DELETE http://localhost:4000/api/produtos/1 \
 *   -H "Authorization: Bearer SEU_TOKEN"
 * =============================================================================
 */
