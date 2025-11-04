/**
 * =============================================================================
 *  src/services/NotaFiscalService.js
 * -----------------------------------------------------------------------------
 *  OBJETIVO DA CAMADA SERVICE (para Nota Fiscal):
 *    - Conter a REGRA DE NEGÓCIO de Notas Fiscais.
 *    - Aqui NÃO falamos HTTP (req/res) e NÃO acessamos DB/arquivo diretamente.
 *      * Quem fala com DB/arquivo é o REPOSITORY.
 *      * Quem fala HTTP é o CONTROLLER.
 *
 *  O QUE ESTE SERVICE FAZ:
 *    - list()      : devolve todas as notas em formato "plain" (prontas para JSON).
 *    - get(id)     : devolve uma nota específica (404 se não existir).
 *    - create(...) : valida dados de entrada, calcula TOTAL, cria Model e manda salvar.
 *    - update(...) : revalida/recacula TOTAL, e atualiza a nota existente.
 *    - remove(id)  : apaga uma nota (erro se não existir).
 *
 *  RESPONSABILIDADE IMPORTANTE:
 *    - Calcular o TOTAL com base nos preços dos produtos (que estão no repositório
 *      de produtos, persistidos em JSON) multiplicados pela quantidade.
 *    - Validar existência dos produtos ao criar/atualizar uma nota.
 *
 *  NOTA SOBRE ASSINCRONIA:
 *    - produtoRepo (JSON em disco) é ASSÍNCRONO (usa fs/promises), por isso usamos await.
 *    - notaRepo (SQLite com better-sqlite3) é SÍNCRONO, por isso seus métodos são chamados
 *      sem await (findAll, findById, etc.).
 * =============================================================================
 */

import { NotaFiscal } from "../models/NotaFiscal.js";

export class NotaFiscalService {
  /**
   * Recebe duas dependências (injeção de dependências):
   *  - notaRepo    : lida com SQLite (create/find/update/delete)
   *  - produtoRepo : lida com JSON de produtos (find/list)
   *
   * Vantagem: facilita testes (podemos simular repositórios em memória)
   * e reduz acoplamento (trocar persistência depois fica mais simples).
   */
  constructor(notaRepo, produtoRepo) {
    this.notaRepo = notaRepo;
    this.produtoRepo = produtoRepo;
  }

  /**
   * -----------------------------------------------------------------------------
   * list()
   * -----------------------------------------------------------------------------
   * Busca TODAS as notas no repositório e converte os Models para "plain objects"
   * (objetos simples) antes de devolver para o controller responder em JSON.
   */
  async list() {
    const models = this.notaRepo.findAll(); // síncrono (SQLite via better-sqlite3)
    return models.map((m) => m.toPlain()); // converte cada Model para objeto simples
  }

  /**
   * -----------------------------------------------------------------------------
   * get(id)
   * -----------------------------------------------------------------------------
   * Busca uma nota específica pelo ID. Se não existir, disparamos o erro padrão
   * que o controller traduzirá para 404.
   */
  async get(id) {
    const m = this.notaRepo.findById(id); // síncrono
    if (!m) throw new Error("Nota não encontrada");
    return m.toPlain();
  }

  /**
   * -----------------------------------------------------------------------------
   * _calcularTotal(itens)
   * -----------------------------------------------------------------------------
   * Método interno (prefixo _) para somar (preço do produto * quantidade).
   * Regras:
   *  - Cada item deve referenciar um productId válido (existente).
   *  - A quantidade deve ser > 0.
   *  - Trabalhamos com duas casas decimais no final (toFixed(2)).
   */
  async _calcularTotal(itens) {
    let total = 0;

    // Percorremos os itens e somamos (preço * qtd)
    for (const item of itens) {
      // produtoRepo é ASSÍNCRONO (JSON em disco), por isso await:
      const prod = await this.produtoRepo.findById(item.productId);
      if (!prod) {
        // Se o produto não existir, não faz sentido prosseguir com a nota:
        throw new Error(`Produto id=${item.productId} não encontrado`);
      }

      // Converte quantidade para número e valida > 0
      const qtd = Number(item.qtd || 0);
      if (qtd <= 0) {
        throw new Error(`Quantidade inválida para produto ${prod.nome}`);
      }

      total += prod.preco * qtd; // acumula
    }

    // padroniza com 2 casas (ex.: 41.9 -> 41.90)
    return Number(total.toFixed(2));
  }

  /**
   * -----------------------------------------------------------------------------
   * create({ numero, cliente_nome, itens })
   * -----------------------------------------------------------------------------
   * Fluxo:
   *   1) Validar dados mínimos: numero, cliente_nome e itens (array).
   *   2) Checar se já existe nota com esse "numero" (único).
   *   3) Calcular TOTAL chamando _calcularTotal(itens).
   *   4) Construir o Model NotaFiscal (ele valida estrutura e campos).
   *   5) Pedir ao repositório para persistir.
   *   6) Retornar o objeto "plain" para o controller responder.
   *
   * Observações:
   *   - created_at é gerado aqui em ISO (string).
   *   - O Model faz validações adicionais (ex.: itens com productId e qtd válidos).
   */
  async create({ numero, cliente_nome, itens }) {
    // 1) Validação básica
    if (!numero || !cliente_nome || !Array.isArray(itens)) {
      throw new Error("Dados inválidos da nota");
    }

    // (Opcional, mas ajuda na prática)
    // if (itens.length === 0) throw new Error("Nota sem itens não é permitida");

    // 2) Checagem de duplicidade de número
    if (this.notaRepo.findByNumero(numero)) {
      throw new Error("Número de nota já existente");
    }

    // 3) Calcular total com base nos preços atuais do JSON de produtos
    const total = await this._calcularTotal(itens);

    // 4) Monta o Model (o constructor do Model confere e normaliza dados)
    const created_at = new Date().toISOString();
    const model = new NotaFiscal({
      numero,
      cliente_nome,
      itens,
      total,
      created_at,
    });

    // 5) Persistir (síncrono) e 6) devolver "plain"
    const criada = this.notaRepo.create(model);
    return criada.toPlain();
  }

  /**
   * -----------------------------------------------------------------------------
   * update(id, { numero, cliente_nome, itens })
   * -----------------------------------------------------------------------------
   * Fluxo:
   *   1) Verificar se a nota existe.
   *   2) Se "numero" mudou, validar duplicidade.
   *   3) Recalcular TOTAL com base em "itens" (novos).
   *   4) Construir novo Model preservando created_at original.
   *   5) Pedir ao repositório para atualizar e devolver "plain".
   *
   * Observações:
   *   - Em caso de atualização parcial, usamos "??" para manter valores antigos.
   *   - Aqui estamos assumindo que "itens" SEMPRE vem no PUT (substitui).
   *     Se desejar permitir atualização parcial de itens, adaptar a lógica.
   */
  async update(id, { numero, cliente_nome, itens }) {
    // 1) Verifica existência
    const atual = this.notaRepo.findById(id); // síncrono
    if (!atual) throw new Error("Nota não encontrada");

    // 2) Se quisermos trocar o número, verificar duplicidade
    if (numero && numero !== atual.numero) {
      const duplicata = this.notaRepo.findByNumero(numero);
      if (duplicata) throw new Error("Número de nota já existente");
    }

    // 3) Recalcular total com base nos itens informados (ou manter os atuais)
    const itensParaCalculo = itens ?? atual.itens;
    const total = await this._calcularTotal(itensParaCalculo);

    // 4) Montar novo Model (preservando created_at original)
    const model = new NotaFiscal({
      id: Number(id),
      numero: numero ?? atual.numero,
      cliente_nome: cliente_nome ?? atual.cliente_nome,
      itens: itensParaCalculo,
      total,
      created_at: atual.created_at, // preservado
    });

    // 5) Persistir e devolver "plain"
    const atualizada = this.notaRepo.update(id, model);
    return atualizada.toPlain();
  }

  /**
   * -----------------------------------------------------------------------------
   * remove(id)
   * -----------------------------------------------------------------------------
   * Tenta remover a nota. Se o repositório indicar que não existia, lançar erro.
   */
  async remove(id) {
    const ok = this.notaRepo.delete(id); // síncrono
    if (!ok) throw new Error("Nota não encontrada");
    return true; // controller devolve { ok: true }
  }
}

/* =============================================================================
 * DICAS / EXTENSÕES (comentários):
 * -----------------------------------------------------------------------------
 * - Paginação e filtros em list():
 *     * No futuro, este service pode receber query params (page, limit, data inicial/final)
 *       e repassar para o repository fazer SELECT com WHERE/ORDER/LIMIT/OFFSET.
 *
 * - Regras fiscais:
 *     * Cálculo de impostos/descontos pode entrar aqui (ex.: ICMS, cupom, etc.).
 *     * Para simplificar a aula, estamos calculando apenas "preço * quantidade".
 *
 * - Concorrência e integridade:
 *     * Como o total depende de preços de produtos que estão em JSON, mudanças nos preços
 *       depois que a nota foi criada NÃO alteram a nota antiga (o total fica salvo).
 *       Esse comportamento é desejável (nota é um documento histórico).
 *
 * - Tratamento de erros:
 *     * O controller deve capturar os Error() lançados aqui e traduzir para:
 *         400 (dados inválidos), 404 (não encontrado), 409 (duplicado), 500 (genérico).
 * =============================================================================
 */
