/**
 * =============================================================================
 *  src/controllers/authController.js
 * -----------------------------------------------------------------------------
 *  PAPEL DO CONTROLLER:
 *    - Ficar ENTRE as rotas (HTTP) e a regra de negócio (Service).
 *    - Extrair dados do req (body/params/query), validar presença mínima,
 *      chamar o service e traduzir o resultado para uma resposta HTTP (status + JSON).
 *
 *  SOBRE ESTE CONTROLLER:
 *    - Possui duas ações: register e login.
 *    - Não conhece detalhes de persistência (MySQL/SQLite/JSON) — isso é do Service/Repository.
 *    - Não gera hashes/JWT — isso é do Service (AuthService).
 *
 *  PADRÕES DE STATUS HTTP USADOS:
 *    - 201 Created → cadastro concluído.
 *    - 200 OK      → login bem-sucedido.
 *    - 400 Bad Request → dados faltando ou inválidos no cadastro.
 *    - 401 Unauthorized → credenciais inválidas no login.
 *
 *  BOAS PRÁTICAS APLICADAS:
 *    - Mensagens de erro genéricas em login (evita “enumeration” de usuários).
 *    - Validação mínima de presença de campos no controller (nome/email/senha).
 *    - Try/catch: caso o Service lance erro, convertemos em HTTP apropriado.
 *
 *  OBSERVAÇÕES:
 *    - Em projetos maiores, é comum usar validação de esquema (ex.: Zod/Joi) ANTES
 *      do controller (middleware validate(schema)) e um middleware global de erros
 *      (errorHandler) para padronizar respostas de erro.
 * =============================================================================
 */

export function makeAuthController({ authService }) {
  return {
    /**
     * ---------------------------------------------------------------------------
     * POST /api/auth/register
     * ---------------------------------------------------------------------------
     * OBJETIVO:
     *   - Cadastrar um novo usuário.
     *   - Fluxo: validar dados mínimos → service.register → responder 201.
     *
     * ENTRADA ESPERADA (req.body):
     *   { nome: string, email: string, senha: string }
     *
     * SAÍDA (sucesso):
     *   201 { ok: true, usuario: { id, nome, email, created_at }, token }
     *
     * ERROS COMUNS:
     *   - 400: campos obrigatórios ausentes / e-mail já existente (negócio).
     */
    register: async (req, res) => {
      try {
        // Extrai com fallback para objeto vazio (evita erro se body vier undefined)
        const { nome, email, senha } = req.body || {};

        // Validação mínima de presença dos campos (formato/força de senha é papel do Service/Model)
        if (!nome || !email || !senha) {
          return res
            .status(400)
            .json({ ok: false, error: "nome, email, senha são obrigatórios" });
        }

        // Chama a regra de negócio (gera hash, cria usuário, emite JWT)
        const out = await authService.register({ nome, email, senha });

        // Cadastro bem-sucedido → 201 Created
        return res.status(201).json({ ok: true, ...out });
      } catch (e) {
        // Qualquer erro de negócio (ex.: e-mail já cadastrado) vira 400 aqui
        // Em apps maiores, prefira um errorHandler central para mapear códigos
        return res.status(400).json({ ok: false, error: e.message });
      }
    },

    /**
     * ---------------------------------------------------------------------------
     * POST /api/auth/login
     * ---------------------------------------------------------------------------
     * OBJETIVO:
     *   - Autenticar um usuário (e-mail + senha).
     *   - Fluxo: validar presença → service.login (bcrypt.compare + JWT) → responder 200.
     *
     * ENTRADA ESPERADA (req.body):
     *   { email: string, senha: string }
     *
     * SAÍDA (sucesso):
     *   200 { ok: true, usuario: { id, nome, email, created_at }, token }
     *
     * ERROS COMUNS:
     *   - 400: corpo sem campos obrigatórios (email/senha ausentes).
     *   - 401: credenciais inválidas (mensagem genérica).
     */
    login: async (req, res) => {
      try {
        const { email, senha } = req.body || {};

        // Checagem mínima de presença de campos
        if (!email || !senha) {
          return res
            .status(400)
            .json({ ok: false, error: "email e senha são obrigatórios" });
        }

        // Service encapsula:
        // - busca por e-mail
        // - compareSenha (bcrypt)
        // - geração do JWT
        const out = await authService.login({ email, senha });

        // Sucesso: devolve 200 com usuário público + token
        return res.json({ ok: true, ...out });
      } catch (e) {
        // Erros de autenticação → 401 Unauthorized
        // (Service usa mensagem genérica: "Usuário/senha inválidos.")
        return res.status(401).json({ ok: false, error: e.message });
      }
    },
  };
}

/**
 * =============================================================================
 *  DICAS DE EVOLUÇÃO (somente comentários):
 * -----------------------------------------------------------------------------
 *  - Validação com schema:
 *      const registerSchema = z.object({ nome: z.string().min(2), ... });
 *      router.post("/register", validate(registerSchema), ctrl.register);
 *
 *  - Middleware de erro global:
 *      app.use(errorHandler);
 *      // Dentro dos controllers, basta "throw" e o errorHandler resolve o status.
 *
 *  - Taxa limite (rate limit) em /login:
 *      Evita tentativas de força bruta. Ex.: limitar por IP/userAgent.
 *
 *  - Auditoria:
 *      Logar tentativas de login (sem armazenar senha), horários, etc.
 * =============================================================================
 */
