/**
 * =============================================================================
 *  src/controllers/usuarioController.js
 * -----------------------------------------------------------------------------
 *  PAPEL DO CONTROLLER:
 *    - Fica ENTRE as rotas (HTTP) e a REGRA DE NEGÓCIO (Service).
 *    - Lê dados de req.params / req.body / req.query.
 *    - Chama o service (que valida e conversa com o repository).
 *    - Traduz o resultado para HTTP (status + JSON) e trata erros.
 *
 *  SOBRE USUÁRIOS NESTE PROJETO:
 *    - Persistência em MySQL via UsuarioMySqlRepository.
 *    - Criação (registro) e login ficam em /api/auth (AuthController/AuthService).
 *      → Aqui NÃO existe POST /api/usuarios (cadastro é no módulo de auth).
 *    - Este controller só lista, busca por id, atualiza e remove.
 *
 *  STATUS CODES USADOS:
 *    - 200 OK            → leitura/atualização/remoção com sucesso.
 *    - 400 Bad Request   → dados inválidos (ex.: e-mail já usado).
 *    - 404 Not Found     → id inexistente.
 *    - 500 Internal Error→ erro inesperado (ex.: falha no banco).
 *
 *  DICA DE LEITURA:
 *    - Controllers devem ser “finos”: pouca lógica; delegar ao Service.
 *    - Validações de formato/negócio moram no Model/Service.
 * =============================================================================
 */

export function makeUsuarioController({ usuarioService }) {
  return {
    /**
     * ---------------------------------------------------------------------------
     * GET /api/usuarios
     * ---------------------------------------------------------------------------
     * OBJETIVO:
     *   - Listar todos os usuários (em visão PÚBLICA: sem senha_hash).
     *
     * COMO FUNCIONA:
     *   - Chama service.list() → retorna array de Models → .toPublic() em cada.
     *   - Responde 200 { ok: true, data: [...] }.
     *
     * ERROS:
     *   - Se ocorrer erro inesperado (ex.: conexão de banco), respondemos 500.
     */
    list: async (req, res) => {
      try {
        const data = await usuarioService.list();
        return res.json({ ok: true, data });
      } catch (e) {
        return res.status(500).json({ ok: false, error: e.message });
      }
    },

    /**
     * ---------------------------------------------------------------------------
     * GET /api/usuarios/:id
     * ---------------------------------------------------------------------------
     * OBJETIVO:
     *   - Retornar UM usuário por id (visão pública).
     *
     * COMO FUNCIONA:
     *   - Converte :id para número (boa prática de deixar tipo explícito).
     *   - Chama service.get(id).
     *   - Se não existir → 404; caso contrário, 200 com { ok: true, data }.
     */
    get: async (req, res) => {
      try {
        const id = Number(req.params.id); // deixa claro que trabalhamos com número
        const data = await usuarioService.get(id);
        return res.json({ ok: true, data });
      } catch (e) {
        return res.status(404).json({ ok: false, error: e.message });
      }
    },

    /**
     * ---------------------------------------------------------------------------
     * PUT /api/usuarios/:id
     * ---------------------------------------------------------------------------
     * OBJETIVO:
     *   - Atualizar dados básicos (nome, email) de um usuário existente.
     *   - NÃO atualiza senha aqui (fluxo próprio em /auth).
     *
     * ENTRADA:
     *   - :id no path (ex.: /api/usuarios/10)
     *   - body: { nome?: string, email?: string }
     *
     * COMO FUNCIONA:
     *   - Converte :id para número.
     *   - Extrai { nome, email } do body.
     *   - Chama service.update(id, { nome, email }):
     *       * Valida unicidade de e-mail (se enviado).
     *       * Atualiza no repo e devolve Model → .toPublic().
     *   - Sucesso → 200 { ok: true, data }.
     *   - E-mail já em uso / id inexistente → 400 (simplificado para a aula).
     */
    update: async (req, res) => {
      try {
        const id = Number(req.params.id);
        const { nome, email } = req.body || {};
        const data = await usuarioService.update(id, { nome, email });
        return res.json({ ok: true, data });
      } catch (e) {
        return res.status(400).json({ ok: false, error: e.message });
      }
    },

    /**
     * ---------------------------------------------------------------------------
     * DELETE /api/usuarios/:id
     * ---------------------------------------------------------------------------
     * OBJETIVO:
     *   - Remover um usuário por id.
     *
     * COMO FUNCIONA:
     *   - Converte :id para número e chama service.remove(id).
     *   - Em sucesso → 200 { ok: true }.
     *   - Se não existir → 404.
     */
    remove: async (req, res) => {
      try {
        const id = Number(req.params.id);
        await usuarioService.remove(id);
        return res.json({ ok: true });
      } catch (e) {
        return res.status(404).json({ ok: false, error: e.message });
      }
    },
  };
}

/* =============================================================================
 * TESTES RÁPIDOS (cURL) — lembre-se: rotas de usuário exigem JWT!
 * -----------------------------------------------------------------------------
 * # 1) Listar
 * curl http://localhost:4000/api/usuarios \
 *   -H "Authorization: Bearer SEU_TOKEN"
 *
 * # 2) Obter por id
 * curl http://localhost:4000/api/usuarios/1 \
 *   -H "Authorization: Bearer SEU_TOKEN"
 *
 * # 3) Atualizar (nome/email)
 * curl -X PUT http://localhost:4000/api/usuarios/1 \
 *   -H "Authorization: Bearer SEU_TOKEN" \
 *   -H "Content-Type: application/json" \
 *   -d '{"nome":"Ana Maria","email":"ana.maria@empresa.com"}'
 *
 * # 4) Remover
 * curl -X DELETE http://localhost:4000/api/usuarios/1 \
 *   -H "Authorization: Bearer SEU_TOKEN"
 *
 * NOTAS:
 *  - O cadastro/login é em /api/auth (público).
 *  - A visão pública do usuário NÃO inclui senha_hash.
 *  - Unicidade de e-mail é verificada no Service + UNIQUE no MySQL.
 * =============================================================================
 */
