/**
 * =============================================================================
 *  src/repositories/ProdutoJsonRepository.js
 * -----------------------------------------------------------------------------
 *  OBJETIVO (CAMADA REPOSITORY):
 *    - Isolar o ACESSO A DADOS de "Produto" quando a fonte é um ARQUIVO JSON.
 *    - Converter objetos "planos" (vindos do JSON) <→ Models (Produto).
 *
 *  POR QUE USAR UM "REPOSITORY"?
 *    - Para que o restante da aplicação (services/controllers) não saiba "como"
 *      e "onde" os dados estão salvos. Hoje é JSON; amanhã pode virar SQLite/MySQL.
 *    - Mantém o código testável e com baixo acoplamento.
 *
 *  COMO ESTE REPOSITÓRIO FUNCIONA:
 *    - Lê e escreve o arquivo inteiro a cada operação (simples e didático).
 *    - Ao LER: transforma cada item do JSON em um Model Produto (Produto.fromPlain).
 *    - Ao ESCREVER: recebe um Model/objeto e grava apenas dados "planos" (toPlain()).
 *
 *  LIMITAÇÕES/OBSERVAÇÕES (didáticas):
 *    - JSON em disco NÃO é um banco transacional. Em produção, cuidado com:
 *       * Concorrência (duas escritas simultâneas podem corromper o arquivo).
 *       * Tamanho do arquivo (grande demais fica lento para ler/escrever).
 *       * Falhas no meio da escrita (arquivo pode ficar "meio salvo").
 *    - Para mitigar:
 *       * Escrita "atômica": escrever em arquivo temporário e renomear no final.
 *       * Travamento (lock) simples em memória (fila) para serializar escritas.
 *       * Migrar para SQLite/MySQL quando o projeto exigir robustez.
 * =============================================================================
 */

import { readJson, writeJson } from "../utils/fsJson.js";
import { Produto } from "../models/Produto.js";

export class ProdutoJsonRepository {
  /**
   * filePath → caminho do arquivo JSON (ex.: "./produtos.json")
   * É a "fonte de dados" deste repositório.
   */
  constructor(filePath) {
    this.filePath = filePath;
  }

  /**
   * -----------------------------------------------------------------------------
   * _readAllPlain()
   * -----------------------------------------------------------------------------
   * Lê o arquivo JSON e retorna a LISTA "crua" (objetos simples).
   * Ex.: [ { id: 1, nome: "Caneta", preco: 3.5 }, ... ]
   *
   * *Método "privado" por convenção (underscore), pois só a camada interna usa.
   */
  async _readAllPlain() {
    return readJson(this.filePath);
  }

  /**
   * -----------------------------------------------------------------------------
   * _writeAllPlain(lista)
   * -----------------------------------------------------------------------------
   * Recebe uma lista "plana" (sem métodos/classes) e grava no JSON.
   */
  async _writeAllPlain(lista) {
    return writeJson(this.filePath, lista);
  }

  /**
   * -----------------------------------------------------------------------------
   * findAll()
   * -----------------------------------------------------------------------------
   * Retorna TODOS os produtos como **Models** (Produto).
   * Passos:
   *   1) Lê o JSON (lista plana).
   *   2) Converte cada item para Model com Produto.fromPlain().
   */
  async findAll() {
    const plain = await this._readAllPlain();
    return plain.map((p) => Produto.fromPlain(p));
  }

  /**
   * -----------------------------------------------------------------------------
   * findById(id)
   * -----------------------------------------------------------------------------
   * Busca UM produto pelo id e retorna como **Model**.
   * Se não existir, retorna null.
   */
  async findById(id) {
    const plain = await this._readAllPlain();
    const found = plain.find((p) => Number(p.id) === Number(id));
    return found ? Produto.fromPlain(found) : null;
  }

  /**
   * -----------------------------------------------------------------------------
   * create(produtoModel)
   * -----------------------------------------------------------------------------
   * Cria um novo produto no JSON.
   * Regras/Passos:
   *   1) Lê a lista atual.
   *   2) Gera um NOVO ID (simples): max(id) + 1 (ou 1 se estiver vazio).
   *   3) Monta um NOVO Model Produto com { id, nome, preco }.
   *   4) Empurra o objeto PLANO (toPlain) para a lista e grava.
   *   5) Retorna o **Model** recém-criado.
   *
   * Observações:
   *   - A geração de id com Math.max é didática; em ambientes concorrentes/bancos,
   *     o id deve ser gerado pelo SGBD (AUTO_INCREMENT/SEQUENCE).
   */
  async create(produtoModel) {
    const lista = await this._readAllPlain();

    // Calcula novo id incremental simples
    const novoId = lista.length
      ? Math.max(...lista.map((p) => Number(p.id))) + 1
      : 1;

    // Cria um Model novo para garantir validação/normalização do domínio
    const novo = new Produto({
      id: novoId,
      nome: produtoModel.nome,
      preco: produtoModel.preco,
    });

    // Grava em formato "plano" (serializável)
    lista.push(novo.toPlain());
    await this._writeAllPlain(lista);

    // Retorna o Model (útil para o service/controller)
    return novo;
  }

  /**
   * -----------------------------------------------------------------------------
   * update(id, { nome, preco })
   * -----------------------------------------------------------------------------
   * Atualiza UM produto existente.
   * Passos:
   *   1) Lê a lista.
   *   2) Procura o índice pelo id.
   *   3) Se não achou, retorna null (service lida com "404").
   *   4) Monta um NOVO Model (preserva valores antigos quando não enviados).
   *   5) Substitui na lista e grava.
   *   6) Retorna o **Model** atualizado.
   */
  async update(id, { nome, preco }) {
    const lista = await this._readAllPlain();

    // Encontrar o índice do item a atualizar
    const idx = lista.findIndex((p) => Number(p.id) === Number(id));
    if (idx < 0) return null;

    // Estado atual (plano) antes da atualização
    const atual = lista[idx];

    // Cria um NOVO Model validando/normalizando o domínio
    const atualizado = new Produto({
      id: Number(id),
      nome: nome ?? atual.nome,
      preco: preco ?? atual.preco,
    });

    // Substitui pelo "plano" e salva
    lista[idx] = atualizado.toPlain();
    await this._writeAllPlain(lista);

    // Retorna o Model resultante
    return atualizado;
  }

  /**
   * -----------------------------------------------------------------------------
   * delete(id)
   * -----------------------------------------------------------------------------
   * Remove UM produto pelo id.
   * Retorno:
   *   - true  → se removeu
   *   - false → se não existia
   */
  async delete(id) {
    const lista = await this._readAllPlain();

    // Filtra tudo que NÃO é o id a ser removido
    const filtrado = lista.filter((p) => Number(p.id) !== Number(id));

    // Se o tamanho mudou, é porque alguém foi removido
    const mudou = filtrado.length !== lista.length;

    if (mudou) {
      await this._writeAllPlain(filtrado);
    }

    return mudou;
  }
}

/**
 * =============================================================================
 *  DICAS / EXTENSÕES (quando quiser evoluir):
 * -----------------------------------------------------------------------------
 *  1) Escrita atômica:
 *     - Em vez de escrever direto no arquivo final:
 *         await writeJson(file.tmp, lista);
 *         await fs.rename(file.tmp, filePath);
 *       Assim reduz risco de “arquivo quebrado” em queda de energia/travamento.
 *
 *  2) Lock simples (fila de operações):
 *     - Criar uma fila interna (Promise chain) para serializar writes e evitar
 *       que duas escritas concorram (especialmente em servidores com várias reqs).
 *
 *  3) Índices e buscas:
 *     - Se buscas por nome forem frequentes, pode manter um índice em memória
 *       (Map por nome → id) durante o ciclo do servidor (com cuidado com writes).
 *
 *  4) Migração para DB relacional:
 *     - Quando exigir concorrência, múltiplos processos e integridade forte,
 *       migrar para SQLite/MySQL junto com um Repository equivalente.
 * =============================================================================
 */
