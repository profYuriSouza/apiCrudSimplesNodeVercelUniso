/**
 * =============================================================================
 *  utils/jwt.js
 * -----------------------------------------------------------------------------
 *  O QUE É JWT (JSON Web Token)?
 *    - É um TOKEN de autenticação/autorizações assinado (não criptografado).
 *    - Estrutura: HEADER.PAYLOAD.SIGNATURE (tudo em Base64URL).
 *      * HEADER  : metadados (ex.: { alg: "HS256", typ: "JWT" })
 *      * PAYLOAD : dados (ex.: { id: 123, email: "a@b.com", iat, exp })
 *      * SIGNATURE: assinatura garantindo integridade (usa nosso JWT_SECRET)
 *
 *  ATENÇÃO:
 *    - "Assinado" != "Criptografado". O conteúdo do payload é legível.
 *      ⇒ Nunca coloque dados sensíveis (senha, dados pessoais, etc.) no payload.
 *    - O servidor confia no token porque sabe verificar a assinatura (com o segredo).
 *
 *  BOAS PRÁTICAS RESUMO:
 *    1) Expiração curta para o "access token" (ex.: 15min–2h).
 *    2) Não colocar informações sensíveis no payload.
 *    3) Validar algoritmo explicitamente (evita aceitar tokens com algoritmo diferente).
 *    4) Usar HTTPS sempre (evita vazamento por sniffing).
 *    5) Enviar no header: Authorization: Bearer <token>
 *    6) Em apps reais, considerar "refresh tokens" + rotação de segredo ao longo do tempo.
 * =============================================================================
 */

import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js"; // Segredo da assinatura (definido no .env)

/**
 * -----------------------------------------------------------------------------
 * generateJwt(payload)
 * -----------------------------------------------------------------------------
 * Gera um JWT assinado com HS256 (padrão simétrico) contendo o "payload" informado.
 *
 * Parâmetros:
 *  - payload: objeto com informações mínimas para identificar o usuário na aplicação.
 *             Ex.: { id: 123, email: "a@b.com" }
 *
 * Observações:
 *  - expiresIn: "2h" → token expira em 2 horas (ajuste conforme necessidade).
 *  - NÃO inclua dados sensíveis (senhas, tokens de serviços de terceiros, etc.).
 *  - Em sistemas maiores, você pode acrescentar "aud", "iss" e "sub" no payload
 *    e validar esses campos no verify (ex.: aud: "minha-api", iss: "minha-empresa").
 *
 * Retorno:
 *  - string do token no formato "HEADER.PAYLOAD.SIGNATURE"
 *
 * Exemplo de uso:
 *  const token = generateJwt({ id: user.id, email: user.email });
 *  res.json({ token });
 */
export function generateJwt(payload) {
  // Assinamos com:
  // - segredo (JWT_SECRET)
  // - algoritmo HS256 (explícito por segurança/clareza)
  // - expiração de 2 horas (ajuste se quiser via ENV)
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "2h",
    algorithm: "HS256",
  });
}

/**
 * -----------------------------------------------------------------------------
 * verifyJwt(token)
 * -----------------------------------------------------------------------------
 * Verifica a assinatura e validade do token.
 *
 * Parâmetros:
 *  - token: string recebida do cliente (ex.: do header Authorization: Bearer <token>)
 *
 * Comportamento:
 *  - Se o token for válido (assinatura confere + não expirou), retorna o payload.
 *  - Se for inválido ou expirado, a função LANÇA um erro (throw). Por isso:
 *      * Quem chama deve envolver em try/catch OU deixar o middleware tratar.
 *      * No nosso projeto, o middleware "authMiddleware" faz esse try/catch.
 *
 * Segurança:
 *  - algorithms: ["HS256"] → garantimos aceitar apenas tokens com esse algoritmo.
 *    Isso evita aceitar, por engano, outro algoritmo não desejado.
 *
 * Retorno:
 *  - objeto payload (ex.: { id, email, iat, exp })
 *
 * Exemplos de erro possíveis:
 *  - TokenExpiredError  → token expirou (exp ultrapassou o horário atual)
 *  - JsonWebTokenError  → assinatura inválida / token malformado
 */
export function verifyJwt(token) {
  // IMPORTANTE: esta função dispara throw em caso de erro.
  // Quem chama (ex.: middleware) precisa capturar e responder com 401.
  return jwt.verify(token, JWT_SECRET, {
    algorithms: ["HS256"], // aceita somente HS256
    // audience: "minha-api",   // (opcional) valide "aud" se você incluir no sign
    // issuer: "minha-empresa", // (opcional) valide "iss" idem
    // clockTolerance: 5,       // (opcional) tolerância em segundos para clock skew
  });
}

/**
 * -----------------------------------------------------------------------------
 * DICAS EXTRAS (para quando evoluir o projeto):
 * -----------------------------------------------------------------------------
 *  - "Access Token" (curta duração) + "Refresh Token" (mais longo) + rota /refresh:
 *      * O cliente usa o access token nas rotas.
 *      * Quando expira, o cliente usa o refresh token para pedir um novo access token.
 *      * Armazene refresh tokens com segurança no servidor (lista/DB) para poder revogar.
 *
 *  - Rotação do segredo (JWT_SECRET rotation):
 *      * Em ambientes maiores, é comum trocar segredos periodicamente.
 *      * Use "kid" no header do token para dizer qual chave foi usada e conseguir verificar
 *        tokens emitidos com segredos antigos (até expirarem).
 *
 *  - Onde guardar o token no cliente?
 *      * SPA (browser): geralmente em memória (variável), reduz exposição; evitar localStorage.
 *      * Cookies HTTPOnly + SameSite podem ajudar contra XSS/CSRF (com mais configurações).
 *
 *  - Blacklist/Revogação:
 *      * JWT por si só é "stateless"; para invalidar antes de expirar, mantenha uma lista
 *        (blacklist) ou um "token version" no usuário e rejeite tokens antigos.
 */
