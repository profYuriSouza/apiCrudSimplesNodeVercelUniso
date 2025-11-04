/**
 * =============================================================================
 *  src/models/NotaFiscal.js
 * -----------------------------------------------------------------------------
 *  OBJETIVO:
 *    Representar uma Nota Fiscal (NF) na camada de domínio, com:
 *      - Validações simples (número, cliente, itens, total).
 *      - Conversões práticas:
 *          * fromDbRow  -> quando lemos do SQLite (coluna itens_json)
 *          * fromPlain  -> quando recebemos objeto "puro" (ex.: req.body)
 *          * toPlain    -> quando devolvemos para a API/JSON
 *          * toDbInsertParams / toDbUpdateParams -> quando persistimos no SQLite
 *
 *  IMPORTANTE:
 *    - O "total" é CALCULADO no Service (somando preço do produto * qtd).
 *      Aqui no Model apenas validamos que "total" é um número >= 0.
 *    - Os "itens" são um array de objetos: { productId: number, qtd: number }
 *      * productId: id do Produto (inteiro > 0)
 *      * qtd      : quantidade (número > 0)
 * =============================================================================
 */

/**
 * Normaliza/valida a lista de itens de uma NF.
 * Aceita qualquer array (por exemplo vindo do req.body) e converte cada item
 * para o formato canônico: { productId: number, qtd: number }
 * Lança erro se encontrar valores inválidos.
 */
function normalizarItens(rawArray) {
  if (!Array.isArray(rawArray)) {
    throw new Error("itens deve ser um array.");
  }

  return rawArray.map((it, idx) => {
    const productId = Number(it?.productId);
    const qtd = Number(it?.qtd);

    // productId deve ser inteiro positivo
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new Error(`itens[${idx}].productId inválido (use inteiro > 0).`);
    }

    // qtd deve ser número finito e positivo
    if (!Number.isFinite(qtd) || qtd <= 0) {
      throw new Error(`itens[${idx}].qtd inválida (use número > 0).`);
    }

    return { productId, qtd };
  });
}

/** Normaliza id: undefined/null => null; caso contrário, Number(id) */
function normalizarId(valor) {
  if (valor === undefined || valor === null) return null;
  return Number(valor);
}

/** Gera string ISO a partir de Date, string ou número (timestamp) */
function paraIsoDate(input) {
  // Se já for Date -> usa toISOString(); se vier string/number -> cria Date
  const dt = input instanceof Date ? input : new Date(input ?? Date.now());
  return dt.toISOString(); // ex.: "2025-10-29T12:34:56.789Z"
}

export class NotaFiscal {
  /**
   * CONSTRUTOR
   * Recebe um objeto com as chaves:
   *  { id = null, numero, cliente_nome, itens, total, created_at = new Date() }
   */
  constructor({
    id = null,
    numero,
    cliente_nome,
    itens,
    total,
    created_at = new Date(),
  }) {
    // ---------------------------------
    // 1) Validar campos de texto
    // ---------------------------------
    const numeroStr = String(numero ?? "").trim();
    if (!numeroStr) {
      throw new Error("Número da nota é obrigatório.");
    }

    const clienteStr = String(cliente_nome ?? "").trim();
    if (clienteStr.length < 2) {
      throw new Error("Nome do cliente muito curto.");
    }

    // ---------------------------------
    // 2) Normalizar/validar itens
    // ---------------------------------
    const itensNorm = normalizarItens(itens);

    // ---------------------------------
    // 3) Validar total (número >= 0)
    //    Obs.: quem calcula o total é o Service (com base no preço do produto).
    // ---------------------------------
    const totalNum = Number(total);
    if (!Number.isFinite(totalNum) || totalNum < 0) {
      throw new Error("Total inválido (use número >= 0).");
    }
    const totalDuasCasas = Number(totalNum.toFixed(2));

    // ---------------------------------
    // 4) Datas / IDs
    // ---------------------------------
    const createdAtIso = paraIsoDate(created_at);
    const idNorm = normalizarId(id);

    // ---------------------------------
    // 5) Atribuições finais
    // ---------------------------------
    this.id = idNorm;
    this.numero = numeroStr;
    this.cliente_nome = clienteStr;
    this.itens = itensNorm;            // array de { productId, qtd }
    this.total = totalDuasCasas;       // número com 2 casas
    this.created_at = createdAtIso;    // string ISO
  }

  /**
   * fromDbRow(row)
   * Constrói a NF a partir de uma linha do SQLite.
   * No banco, os itens ficam em "itens_json" (string) e precisamos fazer parse.
   */
  static fromDbRow(row = {}) {
    const itens = JSON.parse(row?.itens_json || "[]");
    return new NotaFiscal({
      id: row?.id ?? null,
      numero: row?.numero,
      cliente_nome: row?.cliente_nome,
      itens,
      total: row?.total,
      created_at: row?.created_at,
    });
  }

  /**
   * fromPlain(p)
   * Constrói a NF a partir de um objeto "puro" (ex.: req.body).
   * Útil para validar entrada antes de gravar.
   */
  static fromPlain(p = {}) {
    return new NotaFiscal({
      id: p?.id ?? null,
      numero: p?.numero,
      cliente_nome: p?.cliente_nome,
      itens: p?.itens,
      total: p?.total,
      created_at: p?.created_at,
    });
  }

  /**
   * toPlain()
   * Converte a instância para objeto simples (pronto para JSON/resposta da API).
   * Observação: garantimos que itens continuem no formato { productId, qtd }.
   */
  toPlain() {
    return {
      id: this.id,
      numero: this.numero,
      cliente_nome: this.cliente_nome,
      itens: this.itens.map((i) => ({ productId: i.productId, qtd: i.qtd })),
      total: this.total,
      created_at: this.created_at,
    };
  }

  /**
   * toDbInsertParams()
   * Retorna os valores na ORDEM esperada pelo INSERT do repository:
   *   (numero, cliente_nome, itens_json, total, created_at)
   */
  toDbInsertParams() {
    return [
      this.numero,
      this.cliente_nome,
      JSON.stringify(this.itens),
      this.total,
      this.created_at,
    ];
  }

  /**
   * toDbUpdateParams()
   * Retorna os valores na ORDEM esperada pelo UPDATE do repository:
   *   (numero, cliente_nome, itens_json, total, id)
   */
  toDbUpdateParams() {
    if (this.id == null) {
      throw new Error("id ausente para atualizar a nota.");
    }
    return [
      this.numero,
      this.cliente_nome,
      JSON.stringify(this.itens),
      this.total,
      this.id,
    ];
  }
}

/* =============================================================================
 * EXEMPLOS RÁPIDOS (apenas comentários, não executa daqui):
 * -----------------------------------------------------------------------------
 * // 1) Criar NF a partir de objeto "puro" (ex.: req.body),
 * //    supondo que o Service já calculou o total:
 * const nf = NotaFiscal.fromPlain({
 *   numero: "NF-2025-0001",
 *   cliente_nome: "Fulano",
 *   itens: [{ productId: 1, qtd: 2 }, { productId: 7, qtd: 1 }],
 *   total: 3.50 * 2 + 34.90 * 1, // exemplo didático; no sistema real o Service faz isso
 * });
 * console.log(nf.toPlain());
 *
 * // 2) Preparar para INSERT no SQLite:
 * const paramsInsert = nf.toDbInsertParams();
 * // -> ["NF-2025-0001", "Fulano", "[{\"productId\":1,\"qtd\":2},...]", 41.90, "2025-10-29T...Z"]
 *
 * // 3) A partir de uma linha do DB (SELECT ... FROM notas_fiscais):
 * const row = {
 *   id: 10,
 *   numero: "NF-2025-0001",
 *   cliente_nome: "Fulano",
 *   itens_json: "[{\"productId\":1,\"qtd\":2}]",
 *   total: 7.00,
 *   created_at: "2025-10-29T12:34:56.000Z"
 * };
 * const nfDb = NotaFiscal.fromDbRow(row);
 * console.log(nfDb.itens); // [{ productId: 1, qtd: 2 }]
 * =============================================================================
 */
