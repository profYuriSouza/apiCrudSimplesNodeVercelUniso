/**
 * =============================================================================
 *  src/models/Usuario.js  (versão usando biblioteca para validar e-mail)
 * -----------------------------------------------------------------------------
 *  Mudança principal:
 *    - Trocamos a REGEX manual por um pacote pronto: "validator".
 *      => Assim evitamos confundir quem ainda não viu expressões regulares.
 *
 *  Como instalar o pacote "validator":
 *    npm i validator
 *
 *  O que o "validator" faz aqui?
 *    - validator.isEmail(email)  -> retorna true/false se o formato parece e-mail
 *    - Opcional: validator.normalizeEmail(email) -> normaliza (ex.: minúsculas)
 *
 *  Objetivo do Model:
 *    - Representar um Usuário com validações simples.
 *    - Fornecer conversões úteis:
 *        * fromDbRow   (linha do MySQL -> model)
 *        * fromPlain   (objeto puro -> model)
 *        * toPlain     (model -> objeto com senha_hash, uso interno)
 *        * toPublic    (model -> objeto sem senha_hash, uso na API)
 *        * toDbInsertParams / toDbUpdateParams (arrays na ordem das queries)
 *
 *  Observações importantes:
 *    - Nunca expor "senha_hash" nas respostas de API (use toPublic()).
 *    - O hash de senha vem do AuthService (bcrypt). Aqui só exigimos que exista.
 * =============================================================================
 */

import validator from "validator"; // <-- Biblioteca de validações (https://www.npmjs.com/package/validator)

const NOME_MIN_LEN = 2; // regra didática: exigir ao menos 2 caracteres no nome

/** Normaliza id: undefined/null => null; caso contrário, Number(id) */
function normalizarId(valor) {
  if (valor === undefined || valor === null) return null;
  return Number(valor);
}

/** Converte Date/string/number para string ISO (ex.: "2025-10-29T12:34:56.789Z") */
function paraIsoDate(input) {
  const dt = input instanceof Date ? input : new Date(input ?? Date.now());
  return dt.toISOString();
}

export class Usuario {
  /**
   * CONSTRUTOR
   * Recebe { id = null, nome, email, senha_hash, created_at = new Date() }
   * e faz validações/normalizações antes de popular a instância.
   */
  constructor({ id = null, nome, email, senha_hash, created_at = new Date() }) {
    // ---------------------------------
    // 1) Validar e normalizar nome
    // ---------------------------------
    const nomeStr = String(nome ?? "").trim();
    if (nomeStr.length < NOME_MIN_LEN) {
      throw new Error(`Nome muito curto (mínimo ${NOME_MIN_LEN} caracteres).`);
    }

    // ---------------------------------
    // 2) Validar e normalizar e-mail (SEM regex manual)
    // ---------------------------------
    //  - Primeiro limpamos espaços e colocamos em minúsculas (boa prática).
    //  - Depois usamos validator.isEmail() para verificar formato válido.
    let emailStr = String(email ?? "")
      .trim()
      .toLowerCase();

    // Se quiser, podemos tentar normalizar o e-mail (opcional).
    // Ex.: remove pontos do Gmail, garante minúsculas, etc.
    // Se normalizeEmail devolver null (e-mail inválido), mantemos o string atual
    // para a verificação com isEmail() logo abaixo.
    const emailNormalizado = validator.normalizeEmail(emailStr) ?? emailStr;
    emailStr = emailNormalizado;

    if (!validator.isEmail(emailStr)) {
      throw new Error("E-mail inválido.");
    }

    // ---------------------------------
    // 3) Verificar presença do hash de senha
    // ---------------------------------
    const senhaHashStr = String(senha_hash ?? "").trim();
    if (!senhaHashStr) {
      throw new Error("senha_hash ausente.");
    }

    // ---------------------------------
    // 4) Datas / ID
    // ---------------------------------
    const createdAtIso = paraIsoDate(created_at);
    const idNorm = normalizarId(id);

    // ---------------------------------
    // 5) Atribuições finais
    // ---------------------------------
    this.id = idNorm;
    this.nome = nomeStr;
    this.email = emailStr; // já validado/normalizado pelo validator
    this.senha_hash = senhaHashStr; // ATENÇÃO: não expor isto em respostas da API!
    this.created_at = createdAtIso; // string ISO
  }

  /**
   * fromDbRow(row)
   * Constrói um Usuario a partir de uma linha do banco (MySQL).
   * Útil quando o repository lê via SELECT e converte para model.
   */
  static fromDbRow(row = {}) {
    return new Usuario({
      id: row.id ?? null,
      nome: row.nome,
      email: row.email,
      senha_hash: row.senha_hash,
      created_at: row.created_at,
    });
  }

  /**
   * fromPlain(p)
   * Constrói um Usuario a partir de um objeto "puro" (ex.: req.body não hasheado
   * não deve chegar aqui; "senha_hash" é o hash já gerado no AuthService).
   */
  static fromPlain(p = {}) {
    return new Usuario({
      id: p.id ?? null,
      nome: p.nome,
      email: p.email,
      senha_hash: p.senha_hash,
      created_at: p.created_at,
    });
  }

  /**
   * toPlain()
   * Retorna o objeto "simples" COM senha_hash (para uso interno / persistência).
   * NÃO use isto diretamente para responder a API.
   */
  toPlain() {
    return {
      id: this.id,
      nome: this.nome,
      email: this.email,
      senha_hash: this.senha_hash, // cuidado para não logar / expor em produção
      created_at: this.created_at,
    };
  }

  /**
   * toPublic()
   * Retorna a visão "segura" do usuário, sem senha_hash.
   * Use isto ao responder endpoints (GET /api/usuarios, /api/auth/login, etc.).
   */
  toPublic() {
    return {
      id: this.id,
      nome: this.nome,
      email: this.email,
      created_at: this.created_at,
    };
  }

  /**
   * toDbInsertParams()
   * Parâmetros na ORDEM esperada pelo INSERT no repository:
   *   INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)
   */
  toDbInsertParams() {
    return [this.nome, this.email, this.senha_hash];
  }

  /**
   * toDbUpdateParams()
   * Parâmetros na ORDEM esperada pelo UPDATE no repository:
   *   UPDATE usuarios SET nome = ?, email = ? WHERE id = ?
   */
  toDbUpdateParams() {
    if (this.id == null) {
      throw new Error("id ausente");
    }
    return [this.nome, this.email, this.id];
  }
}

/* =============================================================================
 * DICAS RÁPIDAS (comentários):
 * -----------------------------------------------------------------------------
 * // Exemplo de uso:
 * // const u = new Usuario({
 * //   nome: "Ana",
 * //   email: "Ana@Empresa.COM",
 * //   senha_hash: "<hash-bcrypt>",
 * // });
 * // console.log(u.toPublic()); // { id: null, nome: "Ana", email: "ana@empresa.com", created_at: "..." }
 * =============================================================================
 */
