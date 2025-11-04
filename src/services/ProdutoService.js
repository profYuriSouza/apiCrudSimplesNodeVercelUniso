/**
 * =============================================================================
 *  src/services/ProdutoService.js
 * -----------------------------------------------------------------------------
 *  OBJETIVO DA CAMADA "SERVICE":
 *    - Centralizar a REGRA DE NEGÓCIO dos Produtos.
 *    - Não falamos HTTP (req/res) aqui e nem acessamos arquivos diretamente.
 *      * HTTP (status code, headers) = responsabilidade do CONTROLLER.
 *      * Persistência (JSON em disco) = responsabilidade do REPOSITORY.
 *
 *  O QUE ESTE SERVICE ENTREGA PARA O CONTROLLER:
 *    - list()      → retorna TODOS os produtos em formato "plano" (toPlain()).
 *    - get(id)     → retorna UM produto por id (ou lança erro se não existir).
 *    - create(...) → valida com o Model Produto e pede para o repo salvar.
 *    - update(...) → revalida com o Model Produto e pede para o repo atualizar.
 *    - remove(id)  → pede para o repo apagar (ou lança erro se não existir).
 *
 *  OBSERVAÇÕES:
 *    - Validamos campos de domínio (nome e preço) no Model Produto.
 *    - O repository de produtos trabalha com ARQUIVO JSON e é ASSÍNCRONO
 *      (usa a API fs/promises), por isso este service usa "await".
 * =============================================================================
 */

import { Produto } from "../models/Produto.js";

export class ProdutoService {
  /**
   * Construtor recebe o repositório (injeção de dependência).
   * Por que isso é bom?
   *  - Facilita testes (podemos injetar um repo "fake" em memória).
   *  - Permite trocar a persistência (JSON → SQLite, por exemplo) sem mexer aqui.
   */
  constructor(produtoRepo) {
    this.produtoRepo = produtoRepo;
  }

  /**
   * -----------------------------------------------------------------------------
   * list()
   * -----------------------------------------------------------------------------
   * Passo a passo didático:
   *  1) Pede ao repository todos os registros (em geral, como Model Produto).
   *  2) Converte cada Model para "objeto simples" com .toPlain() (id, nome, preco).
   *  3) Devolve a lista pronta para o Controller responder em JSON.
   */
  async list() {
    const models = await this.produtoRepo.findAll(); // array de Models Produto
    return models.map((m) => m.toPlain()); // [{id, nome, preco}, ...]
  }

  /**
   * -----------------------------------------------------------------------------
   * get(id)
   * -----------------------------------------------------------------------------
   * Busca um produto pelo id.
   *  - Se não existir, lança Error("Produto não encontrado") → o Controller
   *    captura e devolve 404.
   */
  async get(id) {
    const m = await this.produtoRepo.findById(id);
    if (!m) throw new Error("Produto não encontrado");
    return m.toPlain();
  }

  /**
   * -----------------------------------------------------------------------------
   * create({ nome, preco })
   * -----------------------------------------------------------------------------
   * Passo a passo didático:
   *  1) Cria um Model Produto (o construtor valida nome/preço).
   *  2) Pede ao repository para criar (salvar no JSON).
   *  3) Retorna o objeto "plano" para o Controller.
   *
   * Observações:
   *  - Se nome ou preço vierem como string (ex.: "4.50"), o Model faz a conversão.
   *  - O repository costuma gerar o "id" novo (incremental) antes de salvar.
   */
  async create({ nome, preco }) {
    const model = new Produto({ nome, preco }); // validações no Model
    const criado = await this.produtoRepo.create(model);
    return criado.toPlain();
  }

  /**
   * -----------------------------------------------------------------------------
   * update(id, { nome, preco })
   * -----------------------------------------------------------------------------
   * Passo a passo didático:
   *  1) Confere se existe (se não existir, lança Error).
   *  2) Monta um NOVO Model Produto com os dados atualizados:
   *     - Se "nome" não foi enviado, mantém o nome atual (operador ??).
   *     - Se "preco" não foi enviado, mantém o preço atual.
   *  3) Pede ao repository para atualizar.
   *  4) Retorna o "plano".
   *
   * Observações:
   *  - Aqui usamos "validado.toPlain()" no update porque o nosso repository
   *    de produtos trabalha com objetos simples ao gravar no JSON.
   *  - Em outros repositórios (ex.: MySQL), poderíamos enviar o próprio Model.
   *    O importante é manter o "contrato" do repository consistente.
   */
  async update(id, { nome, preco }) {
    const atual = await this.produtoRepo.findById(id);
    if (!atual) throw new Error("Produto não encontrado");

    // Monta um novo Model com os valores atualizados (ou mantém os antigos)
    const validado = new Produto({
      id: Number(id),
      nome: nome ?? atual.nome,
      preco: preco ?? atual.preco,
    });

    // Nosso repository de JSON espera um objeto plano no update:
    const upd = await this.produtoRepo.update(id, validado.toPlain());
    return upd.toPlain();
  }

  /**
   * -----------------------------------------------------------------------------
   * remove(id)
   * -----------------------------------------------------------------------------
   * Pede ao repository para deletar o produto.
   *  - Se não existir, lançamos Error → Controller devolve 404.
   *  - Devolvemos "true" para o Controller responder { ok: true }.
   */
  async remove(id) {
    const ok = await this.produtoRepo.delete(id);
    if (!ok) throw new Error("Produto não encontrado");
    return true;
  }
}

/**
 * =============================================================================
 *  RESUMO PARA REVISÃO RÁPIDA:
 * -----------------------------------------------------------------------------
 *  - SERVICE: regras de negócio; trabalha com Models; conversa com o Repository.
 *  - MODEL  : valida e normaliza dados de domínio (nome, preço, etc.).
 *  - REPO   : lê/escreve na fonte de dados (JSON) e devolve Models.
 *  - CONTROLLER: traduz exceções em HTTP (400/404/500...) e envia JSON ao cliente.
 *
 *  SOBRE ERROS:
 *  - Aqui apenas "throw new Error(...)". O Controller (ou um middleware de
 *    erro global) decide o status code certo (ex.: 404 quando "não encontrado").
 *
 *  BOAS PRÁTICAS:
 *  - Manter os "contratos" dos repositórios documentados (o que cada método
 *    recebe/retorna). Assim, a equipe não se confunde ao trocar a persistência.
 * =============================================================================
 */
