/**
 * =============================================================================
 *  src/middlewares/authMiddleware.js
 * -----------------------------------------------------------------------------
 *  OBJETIVO:
 *    - Proteger rotas exigindo um token JWT válido no cabeçalho HTTP:
 *        Authorization: Bearer <seu_token_aqui>
 *
 *  COMO FUNCIONA:
 *    1) Lê o header Authorization.
 *    2) Verifica o formato "Bearer <token>".
 *    3) Valida o token com verifyJwt() (assinatura + expiração).
 *    4) Se válido, coloca o payload em req.user e segue para a próxima função.
 *    5) Se inválido/ausente, responde 401 (não autorizado).
 *
 *  DICAS:
 *    - Monte este middleware no server.js ANTES das rotas protegidas, ex.:
 *        app.use("/api/produtos", authMiddleware, createProdutoRoutes(...));
 *        app.use("/api/notas",    authMiddleware, createNotaFiscalRoutes(...));
 *      Já as rotas públicas (ex.: /api/auth/login e /api/auth/register) NÃO usam esse middleware.
 *
 *    - verifyJwt() (em utils/jwt.js) lança erro quando o token está inválido/expirado,
 *      por isso usamos try/catch aqui para responder 401 de forma padronizada.
 *
 *    - O payload padrão que assinamos é algo como { id, email, iat, exp }.
 *      Depois de verificar, salvamos isso em req.user para outras camadas usarem
 *      (ex.: controller pode acessar req.user.id para saber “quem” está chamando).
 *
 *  BOAS PRÁTICAS:
 *    - Sempre usar HTTPS em produção, evitando vazamento de token na rede.
 *    - Tokens curtos (ex.: 15min-2h) + refresh token (fluxo separado) melhoram segurança.
 *    - Se precisar de RBAC (roles/perfis), você pode criar middlewares adicionais
 *      que verifiquem req.user.role/claims depois que este middleware passar.
 * =============================================================================
 */

import { verifyJwt } from "../utils/jwt.js";

export function authMiddleware(req, res, next) {
  // ---------------------------------------------------------------------------
  // 1) Ler o cabeçalho Authorization
  //    - Header típico: "Authorization: Bearer <token>"
  //    - Se não existir, tratamos como string vazia para evitar undefined/null.
  // ---------------------------------------------------------------------------
  const auth = req.headers.authorization || "";

  // ---------------------------------------------------------------------------
  // 2) Checar o formato "Bearer <token>"
  //    - Dividimos por espaço: ["Bearer", "<token>"]
  //    - Se não vier exatamente duas partes ou o prefixo não for "Bearer",
  //      respondemos com 401 (falta de credenciais corretas).
  // ---------------------------------------------------------------------------
  const parts = auth.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    // DICA: Mensagem clara para facilitar teste no Insomnia/Postman.
    return res.status(401).json({ ok: false, error: "Token ausente" });
  }

  // ---------------------------------------------------------------------------
  // 3) Validar o token (assinatura + expiração)
  //    - verifyJwt() lança erro se o token for inválido, expirado ou malformado.
  //    - Se OK, colocamos o payload em req.user para as próximas camadas usarem.
  // ---------------------------------------------------------------------------
  try {
    const token = parts[1]; // a segunda parte é o token em si
    req.user = verifyJwt(token); // payload → ex.: { id, email, iat, exp }
    // Segue para a próxima função da cadeia (outro middleware ou controller)
    return next();
  } catch {
    // Token inválido/expirado → 401
    return res
      .status(401)
      .json({ ok: false, error: "Token inválido/expirado" });
  }
}

/**
 * =============================================================================
 *  VARIAÇÕES (IDEIAS quando você quiser evoluir):
 * -----------------------------------------------------------------------------
 *  - Case-insensitive para o prefixo "Bearer":
 *      const [scheme, token] = (req.headers.authorization || "").split(" ");
 *      if (!token || !/^Bearer$/i.test(scheme)) { ... }
 *
 *  - Buscar token em cookie HttpOnly:
 *      const token = req.cookies?.access_token;
 *      // Útil para SPAs que usam cookies em vez de header Authorization.
 *
 *  - Middleware de autorização (RBAC):
 *      export function requireRole(...roles) {
 *        return (req, res, next) => {
 *          if (!req.user || !roles.includes(req.user.role)) {
 *            return res.status(403).json({ ok:false, error:"Acesso negado" });
 *          }
 *          next();
 *        };
 *      }
 *      // Uso:
 *      router.post("/", authMiddleware, requireRole("admin"), ctrl.create);
 *
 *  - Revogação de tokens:
 *      // JWT é stateless. Para revogar antes de expirar, mantenha uma lista
 *      // em memória/DB com "jti" ou "tokenVersion" no payload e cheque aqui.
 * =============================================================================
 */
