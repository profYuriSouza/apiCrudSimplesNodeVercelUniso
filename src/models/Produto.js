/**
 * =============================================================================
 *  src/models/Produto.js
 * -----------------------------------------------------------------------------
 *  OBJETIVO:
 *    Representar um Produto na aplicação (camada de domínio) com:
 *      - Validações simples (nome e preço).
 *      - Conversões práticas: de objeto "plano" (plain) para Produto (fromPlain)
 *        e de Produto para objeto "plano" (toPlain).
 *
 *  POR QUE UM "MODEL"?
 *    - Centraliza regras e validações do conceito "Produto".
 *    - Evita duplicar validações em vários lugares (service, controller, etc.).
 *    - Facilita testes e manutenção.
 * =============================================================================
 */

const NOME_MIN_LEN = 2; // Não faz sentido um nome com 0/1 caractere (regra didática)

/**
 * Normaliza o "id" de entrada para:
 *  - null (quando indefinido ou nulo) OU
 *  - número (quando vier como string/number).
 *
 * Mantemos esta função separada apenas para deixar a leitura do construtor
 * mais simples e direta (sem ternários encadeados).
 */
function normalizarId(valor) {
  if (valor === undefined || valor === null) return null;
  return Number(valor);
}

export class Produto {
  /**
   * CONSTRUTOR
   * Recebe um objeto com possíveis chaves: { id, nome, preco }
   * e valida/ajusta os valores antes de salvar no "this".
   */
  constructor({ id = null, nome, preco }) {
    // -----------------------------
    // 1) Nome: string não-vazia
    // -----------------------------
    const nomeStr = String(nome ?? "").trim(); // garante string e remove espaços nas pontas
    if (nomeStr.length < NOME_MIN_LEN) {
      throw new Error(
        `Nome do produto muito curto (mínimo ${NOME_MIN_LEN} caracteres).`
      );
    }

    // -----------------------------
    // 2) Preço: número >= 0
    // -----------------------------
    const precoNum = Number(preco);
    const precoEhValido = Number.isFinite(precoNum) && precoNum >= 0;
    if (!precoEhValido) {
      throw new Error("Preço inválido (use número >= 0).");
    }

    // Arredonda para 2 casas: toFixed retorna string; Number(...) volta para número.
    const precoDuasCasas = Number(precoNum.toFixed(2));

    // -----------------------------
    // 3) Atribuições finais
    // -----------------------------
    this.id = normalizarId(id);
    this.nome = nomeStr;
    this.preco = precoDuasCasas;
  }

  /**
   * fromPlain(plain)
   * Constrói um Produto a partir de um objeto "simples" (ex.: vindo de JSON/req.body).
   * Mantemos o nome dos campos para bater com o restante do projeto.
   *
   * Exemplo:
   *   Produto.fromPlain({ id: "3", nome: "Caneta", preco: "2.5" })
   */
  static fromPlain(plain = {}) {
    return new Produto({
      id: plain.id ?? null,
      nome: plain.nome,
      preco: plain.preco,
    });
  }

  /**
   * toPlain()
   * Converte a instância para um objeto "simples", pronto para:
   *  - ser serializado em JSON,
   *  - ser devolvido em respostas da API,
   *  - ser gravado no repositório de produtos (JSON).
   */
  toPlain() {
    return {
      id: this.id,
      nome: this.nome,
      preco: this.preco,
    };
  }
}

/* =============================================================================
 * EXEMPLOS RÁPIDOS (apenas comentários, não executa daqui):
 * -----------------------------------------------------------------------------
 * // Criando produto válido:
 * const p1 = new Produto({ nome: "Caderno", preco: 18.9 });
 * console.log(p1.toPlain()); // { id: null, nome: "Caderno", preco: 18.9 }
 *
 * // Validando nome curto:
 * new Produto({ nome: "A", preco: 10 }); // lança Error("Nome do produto muito curto...")
 *
 * // Validando preço inválido:
 * new Produto({ nome: "Caneta", preco: -1 }); // lança Error("Preço inválido ...")
 *
 * // Convertendo de objeto "plano" (como vem do JSON/req.body):
 * const p2 = Produto.fromPlain({ id: "5", nome: "Borracha", preco: "2.1" });
 * console.log(p2.id);    // 5 (number)
 * console.log(p2.preco); // 2.1 (arredondado para 2 casas se necessário)
 * =============================================================================
 */
