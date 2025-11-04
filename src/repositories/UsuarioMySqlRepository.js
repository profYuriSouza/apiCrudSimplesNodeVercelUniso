/**
 * =============================================================================
 *  src/repositories/UsuarioMySqlRepository.js
 * -----------------------------------------------------------------------------
 *  PAPEL DESTE ARQUIVO (CAMADA REPOSITORY):
 *    - Encapsular o ACESSO AO BANCO (MySQL) para a entidade "Usuário".
 *    - Fornecer métodos de CRUD que:
 *        a) executam SQL com parâmetros (evita SQL Injection),
 *        b) convertem "rows" (linhas do BD) → Model Usuario (com validações),
 *        c) mantêm a aplicação desacoplada dos detalhes do MySQL.
 *
 *  POR QUE DEVOLVER MODELS AQUI?
 *    - O Model (Usuario) concentra regras/normalizações do domínio
 *      (ex.: validações, toPublic(), etc.). Assim, as camadas superiores
 *      (Services/Controllers) trabalham com objetos consistentes.
 *
 *  SOBRE A CONEXÃO:
 *    - Recebemos um "pool" do mysql2/promise (injeção de dependência).
 *      * pool.query(...) → pega uma conexão do pool, executa e devolve.
 *      * O pool gerencia abrir/fechar conexões; não precisamos nos preocupar
 *        com .release() quando usamos .query() direto.
 *
 *  OBSERVAÇÕES PRÁTICAS:
 *    - Mantenha UNIQUE(email) na tabela para garantir unicidade (além da
 *      checagem de negócio no Service).
 *    - Para operações MÚLTIPLAS que precisam ser atômicas, use transações
 *      (pool.getConnection() + beginTransaction/commit/rollback).
 * =============================================================================
 */

import { Usuario } from "../models/Usuario.js";

export class UsuarioMySqlRepository {
  /**
   * Construtor recebe o "pool" já inicializado (vide src/config/mysql.js).
   * Isso facilita testes (podemos injetar um "pool fake") e evita acoplamento.
   */
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * -----------------------------------------------------------------------------
   * findAll()
   * -----------------------------------------------------------------------------
   * Retorna TODOS os usuários, ordenados do id mais recente para o mais antigo.
   *
   * DETALHES:
   *  - SQL com ORDER BY id DESC para lista "mais recente primeiro".
   *  - rows → array de objetos "brutos" do MySQL; convertemos cada um para Model.
   *
   * DICA:
   *  - Para tabelas grandes, considere paginação (LIMIT/OFFSET) e filtros.
   */
  async findAll() {
    const [rows] = await this.pool.query(
      "SELECT id, nome, email, senha_hash, created_at FROM usuarios ORDER BY id DESC;"
    );
    // rows: Array<{ id, nome, email, senha_hash, created_at }>
    return rows.map((r) => Usuario.fromDbRow(r));
  }

  /**
   * -----------------------------------------------------------------------------
   * findById(id)
   * -----------------------------------------------------------------------------
   * Busca UM usuário pelo ID.
   *
   * SEGURANÇA:
   *  - O uso de "?" (placeholders) previne SQL Injection, pois o driver faz
   *    a interpolação segura dos valores.
   *
   * RETORNO:
   *  - Model Usuario se encontrou
   *  - null se não encontrou
   */
  async findById(id) {
    const [rows] = await this.pool.query(
      "SELECT id, nome, email, senha_hash, created_at FROM usuarios WHERE id = ?;",
      [id] // ← parâmetro seguro
    );
    return rows[0] ? Usuario.fromDbRow(rows[0]) : null;
  }

  /**
   * -----------------------------------------------------------------------------
   * findByEmail(email)
   * -----------------------------------------------------------------------------
   * Busca UM usuário pelo e-mail (campo que deve ser UNIQUE no BD).
   *
   * USO:
   *  - O Service utiliza este método para validar unicidade antes de criar/atualizar.
   */
  async findByEmail(email) {
    const [rows] = await this.pool.query(
      "SELECT id, nome, email, senha_hash, created_at FROM usuarios WHERE email = ?;",
      [email]
    );
    return rows[0] ? Usuario.fromDbRow(rows[0]) : null;
  }

  /**
   * -----------------------------------------------------------------------------
   * create(usuarioModel)
   * -----------------------------------------------------------------------------
   * Insere um novo usuário.
   *
   * FLUXO:
   *  - Recebe um Model (já validado pelo domínio).
   *  - Usa toDbInsertParams() para montar a lista de valores na ordem correta.
   *  - Após inserir, consulta findById(insertId) para devolver o Model completo.
   *
   * OBSERVAÇÃO:
   *  - Se o e-mail já existir, o MySQL gerará erro (ER_DUP_ENTRY) por causa do UNIQUE.
   *    * O Service já tenta evitar isso com findByEmail(), mas em corrida pode ocorrer.
   *    * Você pode capturar o erro aqui e transformar em um erro de domínio, se quiser.
   */
  async create(usuarioModel) {
    const sql =
      "INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?);";
    const [result] = await this.pool.query(
      sql,
      usuarioModel.toDbInsertParams() // → [nome, email, senha_hash]
    );
    // result.insertId → id gerado pelo AUTO_INCREMENT
    return this.findById(result.insertId);
  }

  /**
   * -----------------------------------------------------------------------------
   * update(id, { nome, email })
   * -----------------------------------------------------------------------------
   * Atualiza UM usuário (nome e e-mail).
   *
   * DETALHES:
   *  - Este método NÃO mexe na senha_hash (fluxo separado para troca de senha).
   *  - Se o id não existir, o UPDATE não altera linhas; depois, findById(id)
   *    retornará null. O Service traduz isso para "Usuário não encontrado".
   *
   * OBSERVAÇÃO:
   *  - Em caso de alteração de e-mail, UNIQUE(email) pode disprar erro se colidir.
   *    O Service valida antes, mas é bom manter o UNIQUE por segurança.
   */
  async update(id, { nome, email }) {
    await this.pool.query(
      "UPDATE usuarios SET nome = ?, email = ? WHERE id = ?;",
      [nome, email, id]
    );
    return this.findById(id);
  }

  /**
   * -----------------------------------------------------------------------------
   * delete(id)
   * -----------------------------------------------------------------------------
   * Remove UM usuário pelo id.
   *
   * RETORNO:
   *  - Aqui devolvemos "true" sempre (simples).
   *  - Alternativa (mais informativa): checar "affectedRows" e retornar (affectedRows > 0).
   *    Exemplo:
   *      const [res] = await this.pool.query("DELETE FROM usuarios WHERE id = ?;", [id]);
   *      return res.affectedRows > 0;
   */
  async delete(id) {
    await this.pool.query("DELETE FROM usuarios WHERE id = ?;", [id]);
    return true;
  }
}

/**
 * =============================================================================
 *  NOTAS TÉCNICAS E DICAS (somente comentários):
 * -----------------------------------------------------------------------------
 * - Sobre tipos de data:
 *     * Dependendo da config do mysql2 (dateStrings/timezone), "created_at" pode
 *       chegar como string ou como Date. O Model Usuario lida com normalize/ISO.
 *
 * - Transações (exemplo rápido):
 *     const conn = await this.pool.getConnection();
 *     try {
 *       await conn.beginTransaction();
 *       // várias queries relacionadas...
 *       await conn.commit();
 *     } catch (e) {
 *       await conn.rollback();
 *       throw e;
 *     } finally {
 *       conn.release();
 *     }
 *
 * - Paginação:
 *     * Para listar com paginação:
 *         SELECT ... FROM usuarios ORDER BY id DESC LIMIT ? OFFSET ?;
 *       Receba page/limit no Service e converta para LIMIT/OFFSET aqui.
 *
 * - Logs:
 *     * Evite logar "senha_hash". Em erros, registre apenas informações úteis
 *       para debug, sem expor dados sensíveis.
 * =============================================================================
 */
