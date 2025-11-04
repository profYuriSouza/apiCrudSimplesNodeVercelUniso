/**
 * =============================================================================
 *  src/controllers/notaFiscalController.js
 * -----------------------------------------------------------------------------
 *  PAPEL DO CONTROLLER:
 *    - Ficar ENTRE as rotas (HTTP) e a regra de negócio (Service).
 *    - Ler dados de req.params / req.body / req.query.
 *    - Chamar o Service (que contém as regras de negócio).
 *    - Traduzir o resultado/erros em RESPOSTAS HTTP (status + JSON).
 *
 *  SOBRE NOTA FISCAL NESTE PROJETO:
 *    - Persistência em SQLite (better-sqlite3) via Repository.
 *    - Cálculo do TOTAL é responsabilidade do Service (preço * qtd).
 *    - Os itens são um array: [{ productId: number, qtd: number }, ...].
 *
 *  STATUS CODES ESCOLHIDOS:
 *    - 200 OK      → operações de leitura/atualização/remoção bem-sucedidas.
 *    - 201 Created → criação concluída.
 *    - 400 Bad Request → dados inválidos (service lança Error e a gente converte).
 *    - 404 Not Found   → recurso não encontrado (id inexistente, por exemplo).
 *    - 500 Internal Server Error → erro inesperado no list (ex.: falha de DB).
 *
 *  OBSERVAÇÕES:
 *    - Aqui o foco é didático: deixamos o Controller fino e objetivos claros.
 *    - Em projetos maiores, é comum ter:
 *       * validação com schema (Zod/Joi/Celebrate) ANTES do controller;
 *       * um middleware global de erros (errorHandler) para padronizar respostas.
 * =============================================================================
 */

export function makeNotaFiscalController({ notaService }) {
  return {
    /**
     * ---------------------------------------------------------------------------
     * GET /api/notas
     * ---------------------------------------------------------------------------
     * OBJETIVO: Listar todas as notas fiscais.
     *
     * COMO FUNCIONA:
     *  - Pede ao service a lista (service.list()).
     *  - O Service busca no repositório SQLite, converte Models para "plain".
     *  - Retorna { ok: true, data: [...] } com status 200.
     *
     * POSSÍVEIS ERROS:
     *  - Em caso de exceção inesperada (ex.: falha de I/O), respondemos 500.
     */
    list: async (req, res) => {
      try {
        const data = await notaService.list();
        return res.json({ ok: true, data });
      } catch (e) {
        // Em uma API real, preferimos logar o erro (sem expor detalhes sensíveis).
        return res.status(500).json({ ok: false, error: e.message });
      }
    },

    /**
     * ---------------------------------------------------------------------------
     * GET /api/notas/:id
     * ---------------------------------------------------------------------------
     * OBJETIVO: Obter UMA nota fiscal pelo seu ID.
     *
     * COMO FUNCIONA:
     *  - Converte req.params.id para número.
     *  - Chama service.get(id), que:
     *      * procura a nota no repositório,
     *      * se não encontrar, lança Error("Nota não encontrada").
     *  - Em caso de sucesso, responde 200 com { ok: true, data }.
     *  - Se não encontrar, responde 404 com { ok: false, error }.
     */
    get: async (req, res) => {
      try {
        const id = Number(req.params.id); // Number(...) para garantir tipo numérico
        const data = await notaService.get(id);
        return res.json({ ok: true, data });
      } catch (e) {
        // Service lança Error("Nota não encontrada") → 404 aqui.
        return res.status(404).json({ ok: false, error: e.message });
      }
    },

    /**
     * ---------------------------------------------------------------------------
     * POST /api/notas
     * ---------------------------------------------------------------------------
     * OBJETIVO: Criar uma nova nota fiscal.
     *
     * ENTRADA ESPERADA (req.body):
     *  {
     *    "numero": "NF-2025-0001",
     *    "cliente_nome": "Fulano da Silva",
     *    "itens": [
     *      { "productId": 1, "qtd": 2 },
     *      { "productId": 7, "qtd": 1 }
     *    ]
     *  }
     *
     * COMO FUNCIONA:
     *  - Extrai "numero, cliente_nome, itens" do body.
     *  - Chama service.create({ numero, cliente_nome, itens }).
     *      * O Service valida campos mínimos, verifica duplicidade de "numero",
     *        consulta preços no repositório de produtos (JSON),
     *        calcula TOTAL e cria o Model NotaFiscal.
     *  - Em sucesso: 201 Created com { ok: true, data }.
     *  - Em dados inválidos/duplicidade: 400 Bad Request.
     */
    create: async (req, res) => {
      try {
        const { numero, cliente_nome, itens } = req.body || {};
        const data = await notaService.create({ numero, cliente_nome, itens });
        return res.status(201).json({ ok: true, data });
      } catch (e) {
        // Exemplos: "Dados inválidos da nota", "Número de nota já existente", etc.
        return res.status(400).json({ ok: false, error: e.message });
      }
    },

    /**
     * ---------------------------------------------------------------------------
     * PUT /api/notas/:id
     * ---------------------------------------------------------------------------
     * OBJETIVO: Atualizar uma nota fiscal existente.
     *
     * ENTRADA ESPERADA (req.params + req.body):
     *  - :id no path (ex.: /api/notas/10)
     *  - body (mesmo formato do POST), podendo trocar numero/cliente_nome/itens.
     *
     * COMO FUNCIONA:
     *  - Converte :id para número.
     *  - Extrai { numero, cliente_nome, itens } do body.
     *  - Chama service.update(id, { numero, cliente_nome, itens }):
     *      * Se "numero" mudar, valida duplicidade.
     *      * Recalcula TOTAL com base nos itens recebidos (ou mantém os atuais).
     *      * Preserva created_at original.
     *  - Em sucesso: 200 OK com { ok: true, data }.
     *  - Em erros de validação/duplicidade: 400 Bad Request.
     *  - Se id inexistente: o Service lança e o Controller poderia devolver 404;
     *    nesta implementação tratamos tudo como 400 para simplificar a aula.
     */
    update: async (req, res) => {
      try {
        const id = Number(req.params.id);
        const { numero, cliente_nome, itens } = req.body || {};
        const data = await notaService.update(id, {
          numero,
          cliente_nome,
          itens,
        });
        return res.json({ ok: true, data });
      } catch (e) {
        // Ex.: "Nota não encontrada", "Número de nota já existente", etc.
        return res.status(400).json({ ok: false, error: e.message });
      }
    },

    /**
     * ---------------------------------------------------------------------------
     * DELETE /api/notas/:id
     * ---------------------------------------------------------------------------
     * OBJETIVO: Remover uma nota fiscal existente.
     *
     * COMO FUNCIONA:
     *  - Converte :id para número e chama service.remove(id).
     *  - Se removeu, responde 200 { ok: true }.
     *  - Se não encontrar, service lança → 404 Not Found aqui.
     */
    remove: async (req, res) => {
      try {
        const id = Number(req.params.id);
        await notaService.remove(id);
        return res.json({ ok: true });
      } catch (e) {
        return res.status(404).json({ ok: false, error: e.message });
      }
    },
  };
}

/**
 * =============================================================================
 * TESTES RÁPIDOS (cURL) — lembrando que /api/notas exige JWT:
 * -----------------------------------------------------------------------------
 * # 1) Listar
 * curl http://localhost:4000/api/notas \
 *   -H "Authorization: Bearer SEU_TOKEN"
 *
 * # 2) Obter por id
 * curl http://localhost:4000/api/notas/1 \
 *   -H "Authorization: Bearer SEU_TOKEN"
 *
 * # 3) Criar
 * curl -X POST http://localhost:4000/api/notas \
 *   -H "Authorization: Bearer SEU_TOKEN" \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "numero":"NF-2025-0001",
 *     "cliente_nome":"Fulano",
 *     "itens":[{"productId":1,"qtd":2},{"productId":7,"qtd":1}]
 *   }'
 *
 * # 4) Atualizar
 * curl -X PUT http://localhost:4000/api/notas/1 \
 *   -H "Authorization: Bearer SEU_TOKEN" \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "numero":"NF-2025-0001",
 *     "cliente_nome":"Fulano de Tal",
 *     "itens":[{"productId":2,"qtd":3}]
 *   }'
 *
 * # 5) Remover
 * curl -X DELETE http://localhost:4000/api/notas/1 \
 *   -H "Authorization: Bearer SEU_TOKEN"
 * =============================================================================
 */
