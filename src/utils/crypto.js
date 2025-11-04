/**
 * =============================================================================
 *  utils/crypto.js
 * -----------------------------------------------------------------------------
 *  Funções utilitárias para lidar com SENHAS usando bcryptjs.
 *
 *  Conceitos fundamentais:
 *   - NUNCA armazenar senha em texto puro.
 *   - Armazenar APENAS o HASH gerado pelo bcrypt (que já inclui o SALT).
 *   - O bcrypt usa um SALT aleatório novo a cada hash: por isso, a MESMA senha
 *     gera hashes DIFERENTES em momentos distintos. Isso é desejado e seguro.
 *
 *  Sobre "10" nos exemplos:
 *   - Esse número NÃO é o SALT. É o "custo" (cost factor / salt rounds).
 *   - O SALT em si é aleatório e é gerado internamente pelo bcrypt.
 *   - O HASH final guarda: algoritmo + custo + SALT + hash. Ex.: "$2a$10$..."
 *       $2a$         -> versão/algoritmo
 *       10           -> fator de custo (log2 do trabalho)
 *       $<22-chars>  -> SALT em Base64
 *       <31-chars>   -> hash propriamente dito
 *
 *  Verificação:
 *   - Para comparar, o bcrypt extrai o SALT e o custo de dentro do hash salvo,
 *     refaz o processo com a senha digitada e VERIFICA se bate. Por isso a
 *     comparação funciona MESMO quando os hashes são diferentes entre si.
 *
 *  Desempenho e segurança:
 *   - Quanto maior o custo (ex.: 12, 14...), mais lento (mais seguro).
 *   - Ambiente de aula/dev: 10 costuma ser bom; produção pode avaliar 12+.
 *   - Teste o tempo de hash no seu servidor para escolher um custo adequado.
 *
 *  Assíncrono vs. síncrono:
 *   - Usamos as versões assíncronas (promises) para NÃO bloquear o event loop.
 *   - Em APIs Node, preferir sempre async/await para não travar requisições.
 *
 *  Boas práticas:
 *   - Não faça console.log da senha nem do hash em produção.
 *   - Se mudar o custo no futuro, re-hash paulatino: ao logar, se custo antigo
 *     for menor que o desejado, gere novo hash e atualize no BD.
 *   - Opcional: adicionar um "pepper" (segredo do servidor) antes do hash.
 *     Ex.: bcrypt.hash(senha + process.env.PEPPER, cost).
 * =============================================================================
 */

import bcrypt from "bcryptjs";

/**
 * -----------------------------------------------------------------------------
 * hashSenha(plaintext)
 * -----------------------------------------------------------------------------
 * Recebe a senha em texto puro e devolve o HASH (com SALT embutido).
 *
 * Parâmetros:
 *  - plaintext: string com a senha informada pelo usuário.
 *
 * Retorno:
 *  - string do hash, algo como: "$2a$10$Wm8V...Q3wN4tIh2iZ7qz2"
 *
 * Observações:
 *  - O segundo parâmetro "10" não é o SALT; é o custo.
 *  - O SALT é gerado internamente de forma aleatória e embutido no hash final.
 *  - Em produção, considere tornar o custo configurável via .env:
 *      const COST = parseInt(process.env.BCRYPT_COST || "10", 10);
 *      bcrypt.hash(plaintext, COST);
 */
export async function hashSenha(plaintext) {
  // Valida entrada de forma simples para evitar bugs silenciosos.
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("Senha inválida: informe uma string não vazia.");
  }

  // 10 = custo (salt rounds). Ajuste conforme seu ambiente.
  // Quanto maior, mais demorado (e mais caro para atacar por força bruta).
  return bcrypt.hash(plaintext, 10);
}

/**
 * -----------------------------------------------------------------------------
 * compareSenha(plaintext, hash)
 * -----------------------------------------------------------------------------
 * Compara a senha em texto puro com o hash salvo no banco.
 *
 * Parâmetros:
 *  - plaintext: a senha digitada pelo usuário no login.
 *  - hash     : o hash guardado no banco (inclui SALT e custo).
 *
 * Retorno:
 *  - boolean: true (senhas equivalem) ou false (não equivalem).
 *
 * Como funciona internamente:
 *  - O bcrypt PEGA o SALT e o custo de dentro do "hash" fornecido,
 *    refaz o processo com a "plaintext" e compara os resultados.
 *  - Por isso, não precisamos guardar o SALT separado; ele já está no hash.
 */
export async function compareSenha(plaintext, hash) {
  if (typeof plaintext !== "string" || typeof hash !== "string") {
    // Falhar rápido para evitar comparações inválidas.
    return false;
  }
  // compare() é resistente a timing attacks (comparação em tempo constante).
  return bcrypt.compare(plaintext, hash);
}

/**
 * -----------------------------------------------------------------------------
 * Exemplos e dicas (comentários):
 * -----------------------------------------------------------------------------
 *  // Gerando hash:
 *  const senha = "minhaSenhaSegura!";
 *  const hash = await hashSenha(senha);
 *  // Salve "hash" no banco. NÃO salve a "senha".
 *
 *  // Verificando no login:
 *  const ok = await compareSenha("minhaSenhaSegura!", hashDoBanco);
 *  if (!ok) { throw new Error("Usuário/senha inválidos"); }
 *
 *  // Tornar o custo configurável via .env:
 *  // export async function hashSenha(plaintext) {
 *  //   const COST = parseInt(process.env.BCRYPT_COST || "10", 10);
 *  //   return bcrypt.hash(plaintext, COST);
 *  // }
 *
 *  // Migrando custo:
 *  //  - Suponha que você usava 10 e decidiu subir para 12.
 *  //  - Ao usuário logar, após "ok === true", verifique se o hash atual tem custo 10.
 *  //  - Se sim, gere um novo hash com 12 e atualize no banco (rehash oportunista).
 *
 *  // Alternativas modernas:
 *  //  - Argon2 (muito popular e recomendado atualmente).
 *  //  - Scrypt (também boa opção). No Node, há libs estáveis para ambos.
 */
