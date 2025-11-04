/**
 * =============================================================================
 *  src/repositories/NotaFiscalSqliteRepository.js
 * -----------------------------------------------------------------------------
 *  OBJETIVO (CAMADA REPOSITORY):
 *    - Fazer a ponte entre a APLICAÇÃO e o BANCO (SQLite) para o agregado NotaFiscal.
 *    - Aqui ficam as QUERIES SQL e a CONVERSÃO de linhas (rows) <-> Model (NotaFiscal).
 *
 *  TECNOLOGIA:
 *    - Usamos "better-sqlite3", que é SINCRONO por design:
 *        * .prepare(sql) → compila a query
 *        * .all(...)     → retorna VÁRIAS linhas
 *        * .get(...)     → retorna 1 linha (ou undefined)
 *        * .run(...)     → executa INSERT/UPDATE/DELETE e retorna info (changes, lastInsertRowid)
 *
 *  POR QUE CONVERTER PARA MODEL AQUI?
 *    - Mantemos as REGRAS/VALIDAÇÕES do domínio centralizadas no Model (NotaFiscal).
 *    - A aplicação para "cima" só trabalha com Model/objetos planos, não com rows brutos.
 *
 *  ESQUEMA DA TABELA (criado no src/config/sqlite.js):
 *    CREATE TABLE IF NOT EXISTS notas_fiscais (
 *      id INTEGER PRIMARY KEY AUTOINCREMENT,
 *      numero TEXT NOT NULL UNIQUE,
 *      cliente_nome TEXT NOT NULL,
 *      itens_json TEXT NOT NULL,   -- guardamos os itens em JSON (simples para fins didáticos)
 *      total REAL NOT NULL,
 *      created_at TEXT NOT NULL    -- ISO string
 *    );
 *
 *  OBSERVAÇÃO IMPORTANTE:
 *    - O "Service" faz o CÁLCULO do total (somando preço * qtd dos produtos).
 *    - Este repository APENAS persiste/recupera os dados, sem recalcular nada.
 * =============================================================================
 */

import { NotaFiscal } from "../models/NotaFiscal.js";

export class NotaFiscalSqliteRepository {
  /**
   * Construtor recebe a conexão aberta (sqliteDb) do better-sqlite3.
   * O "server.js" já fez initSqlite() e injeta aqui a instância.
   */
  constructor(sqliteDb) {
    this.db = sqliteDb;
  }

  /**
   * -----------------------------------------------------------------------------
   * findAll()
   * -----------------------------------------------------------------------------
   * Retorna TODAS as notas (ordenadas do id mais recente para o mais antigo).
   * Passos:
   *  1) Executar SELECT
   *  2) Mapear cada row -> Model NotaFiscal (fromDbRow)
   *  3) Retornar array de Models
   */
  findAll() {
    const rows = this.db
      .prepare(
        `
        SELECT id, numero, cliente_nome, itens_json, total, created_at
        FROM notas_fiscais
        ORDER BY id DESC;
      `
      )
      .all();

    // Convertemos cada linha do DB para um Model (validações se aplicam no Model)
    return rows.map((r) => NotaFiscal.fromDbRow(r));
  }

  /**
   * -----------------------------------------------------------------------------
   * findById(id)
   * -----------------------------------------------------------------------------
   * Busca UMA nota pelo ID.
   * Retorno:
   *  - Model NotaFiscal, se encontrou
   *  - null, se não achou
   */
  findById(id) {
    const row = this.db
      .prepare(
        `
        SELECT id, numero, cliente_nome, itens_json, total, created_at
        FROM notas_fiscais
        WHERE id = ?;
      `
      )
      .get(id);

    return row ? NotaFiscal.fromDbRow(row) : null;
  }

  /**
   * -----------------------------------------------------------------------------
   * findByNumero(numero)
   * -----------------------------------------------------------------------------
   * Busca UMA nota pelo "numero" (chave única).
   * Útil para impedir duplicidade no Service (além do UNIQUE no DB).
   */
  findByNumero(numero) {
    const row = this.db
      .prepare(
        `
        SELECT id, numero, cliente_nome, itens_json, total, created_at
        FROM notas_fiscais
        WHERE numero = ?;
      `
      )
      .get(numero);

    return row ? NotaFiscal.fromDbRow(row) : null;
  }

  /**
   * -----------------------------------------------------------------------------
   * create(notaModel)
   * -----------------------------------------------------------------------------
   * Insere uma nova nota no banco.
   * Contrato do Model → notaModel.toDbInsertParams() retorna:
   *   [ numero, cliente_nome, JSON.stringify(itens), total, created_at ]
   *
   * Retorno:
   *   - Model recém-criado (com id preenchido)
   */
  create(notaModel) {
    const stmt = this.db.prepare(
      `
      INSERT INTO notas_fiscais (numero, cliente_nome, itens_json, total, created_at)
      VALUES (?, ?, ?, ?, ?);
    `
    );

    // info.lastInsertRowid = id gerado pelo AUTOINCREMENT
    const info = stmt.run(...notaModel.toDbInsertParams());

    // Lemos do banco para devolver o Model "completo" em estado definitivo
    return this.findById(info.lastInsertRowid);
  }

  /**
   * -----------------------------------------------------------------------------
   * update(id, notaModel)
   * -----------------------------------------------------------------------------
   * Atualiza uma nota EXISTENTE.
   * Contrato do Model → notaModel.toDbUpdateParams() retorna:
   *   [ numero, cliente_nome, JSON.stringify(itens), total, id ]
   *
   * Observação:
   *   - Aqui não mudamos "created_at" (preservamos o original).
   *   - O Service já garantiu que "numero" não conflita com outra nota.
   *
   * Retorno:
   *   - Model atualizado (lido do DB logo após o UPDATE)
   */
  update(id, notaModel) {
    const stmt = this.db.prepare(
      `
      UPDATE notas_fiscais
         SET numero = ?, cliente_nome = ?, itens_json = ?, total = ?
       WHERE id = ?;
    `
    );

    const params = notaModel.toDbUpdateParams(); // ordem exata esperada pela query
    stmt.run(...params);

    return this.findById(id);
  }

  /**
   * -----------------------------------------------------------------------------
   * delete(id)
   * -----------------------------------------------------------------------------
   * Remove a nota pelo ID.
   * Retorno:
   *  - true  → se removeu alguma linha
   *  - false → se não existia (0 linhas afetadas)
   */
  delete(id) {
    const info = this.db
      .prepare(
        `
        DELETE FROM notas_fiscais
        WHERE id = ?;
      `
      )
      .run(id);

    return info.changes > 0; // changes = nº de linhas impactadas pelo DELETE
  }
}

/* =============================================================================
 * DICAS/EXTENSÕES (comentários):
 * -----------------------------------------------------------------------------
 * - TRANSAÇÕES:
 *     Se você fizer múltiplas operações que PRECISAM ser atômicas (tudo-ou-nada),
 *     use transações:
 *       const tx = this.db.transaction((dados) => { ... });
 *       tx(payload);
 *
 * - ÍNDICES:
 *     Já temos UNIQUE(numero). Se for consultar muito por "created_at" ou "numero",
 *     pode valer criar índice:
 *       CREATE INDEX IF NOT EXISTS idx_notas_created_at ON notas_fiscais(created_at);
 *
 * - MIGRAÇÕES:
 *     Em projetos reais, padronize migrações (alterações de schema) com uma ferramenta,
 *     para versionar mudanças e evitar "drift" entre ambientes.
 *
 * - LOGS/OBSERVABILIDADE:
 *     Em caso de erro de DB, logue a query e parâmetros com cuidado (sem dados sensíveis).
 * =============================================================================
 */
