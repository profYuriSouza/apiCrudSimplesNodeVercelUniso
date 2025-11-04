/**
 * =============================================================================
 *  src/services/UsuarioService.js
 * -----------------------------------------------------------------------------
 *  OBJETIVO DA CAMADA "SERVICE" (USUÁRIOS):
 *    - Centralizar a REGRA DE NEGÓCIO de usuários.
 *    - NÃO lidamos com HTTP (req/res) aqui → isso é papel do CONTROLLER.
 *    - NÃO falamos SQL direto → isso é papel do REPOSITORY.
 *
 *  DECISÕES IMPORTANTES:
 *    - Este service NÃO altera senha. Atualização de senha deve ser fluxo próprio
 *      (ex.: /api/auth/change-password), pois exige validações e segurança extra.
 *    - Sempre que retornamos um usuário, usamos a visão pública (toPublic()),
 *      para NUNCA expor "senha_hash".
 *
 *  CONTRATOS ESPERADOS DO REPOSITÓRIO (usuarioRepo):
 *    - findAll()                    -> Promise<Usuario[]> (Model)
 *    - findById(id)                 -> Promise<Usuario|null> (Model)
 *    - findByEmail(email)           -> Promise<Usuario|null> (Model)
 *    - update(id, { nome, email })  -> Promise<Usuario|null> (Model)
 *    - delete(id)                   -> Promise<boolean> (true=apagou, false=não existia)
 *
 *  OBSERVAÇÕES:
 *    - Em alguns projetos, a validação de e-mail/nome pode ficar no Model (Usuario),
 *      ou no Service. Aqui validamos unicidade (regra de negócio) no Service e
 *      delegamos validações de formato/conteúdo ao Model/Repository.
 * =============================================================================
 */

export class UsuarioService {
  /**
   * Construtor recebe o repositório (injeção de dependências).
   * Vantagens:
   *  - Testes: dá para injetar um repo "fake" em memória.
   *  - Flexibilidade: trocar MySQL por outro SGBD sem mexer na regra de negócio.
   */
  constructor(usuarioRepo) {
    this.usuarioRepo = usuarioRepo;
  }

  /**
   * -----------------------------------------------------------------------------
   * list()
   * -----------------------------------------------------------------------------
   * Retorna todos os usuários em visão pública.
   * Passo a passo:
   *  1) Pede ao repositório a lista (Model Usuario).
   *  2) Converte cada item para toPublic() (remove senha_hash).
   */
  async list() {
    const models = await this.usuarioRepo.findAll();
    return models.map((m) => m.toPublic());
  }

  /**
   * -----------------------------------------------------------------------------
   * get(id)
   * -----------------------------------------------------------------------------
   * Busca UM usuário por id e devolve em visão pública.
   * Se não existir, lança erro → o controller traduz para HTTP 404.
   */
  async get(id) {
    const m = await this.usuarioRepo.findById(id);
    if (!m) throw new Error("Usuário não encontrado");
    return m.toPublic();
  }

  /**
   * -----------------------------------------------------------------------------
   * update(id, { nome, email })
   * -----------------------------------------------------------------------------
   * Atualiza dados básicos (NÃO altera senha).
   * Regras de negócio aplicadas aqui:
   *  - E-mail deve ser único entre usuários (não pode colidir com outro id).
   *
   * Fluxo:
   *  1) Se veio "email", conferir se já existe outro usuário com esse e-mail.
   *  2) Pedir ao repository para atualizar (nome/email).
   *  3) Se o repo retornar null, o id não existe → erro "Usuário não encontrado".
   *  4) Retornar visão pública.
   *
   * Observações:
   *  - Dependendo do design do repo, ele pode:
   *     a) Validar formato de e-mail usando o Model Usuario; ou
   *     b) Atualizar direto e devolver o Model consolidado.
   *  - Se a equipe preferir, é possível criar um Model aqui para validar antes
   *    de enviar ao repo (ex.: new Usuario({ id, nome, email, senha_hash: atual.senha_hash }))
   *    mas isso exige primeiro carregar o "atual" do banco.
   */
  async update(id, { nome, email }) {
    // 1) Validar unicidade de e-mail (se "email" foi enviado)
    if (email) {
      const existente = await this.usuarioRepo.findByEmail(email);
      // Se encontrou alguém com o e-mail E não é o próprio usuário que estamos editando
      if (existente && Number(existente.id) !== Number(id)) {
        throw new Error("E-mail já em uso por outro usuário");
      }
    }

    // 2) Atualizar no repositório
    //    - O repo pode internamente carregar o usuário atual, aplicar mudanças,
    //      validar com o Model e persistir; no fim, retorna o Model atualizado.
    const atual = await this.usuarioRepo.update(id, { nome, email });
    if (!atual) throw new Error("Usuário não encontrado");

    // 3) Devolver visão pública
    return atual.toPublic();
  }

  /**
   * -----------------------------------------------------------------------------
   * remove(id)
   * -----------------------------------------------------------------------------
   * Tenta remover o usuário.
   * - Se o repo não apagar (id inexistente), ainda retornamos true por simplicidade.
   *   Em alguns sistemas você pode preferir lançar erro para sinalizar "não encontrado".
   * - O controller responde { ok: true } no sucesso.
   */
  async remove(id) {
    await this.usuarioRepo.delete(id);
    return true;
  }
}

/**
 * =============================================================================
 *  IDEIAS DE EXTENSÃO (quando evoluir o projeto):
 * -----------------------------------------------------------------------------
 * - Alteração de senha:
 *     * Criar fluxo dedicado: verificar senha atual, aplicar políticas (força),
 *       gerar novo hash (bcrypt) e salvar. Registrar data da troca e invalidar tokens antigos.
 *
 * - Paginação e filtros em list():
 *     * Receber query params (page, limit, q) e repassar ao repository.
 *
 * - Confirmação de e-mail:
 *     * Ao registrar, enviar token de verificação por e-mail e só liberar acesso após confirmação.
 *
 * - Unicidade em nível de BD:
 *     * Mesmo validando aqui, manter UNIQUE(email) no banco para garantir consistência
 *       em condições de corrida (duas requisições simultâneas).
 *
 * - Auditoria:
 *     * Registrar quem editou/deletou um usuário, quando, e o que mudou.
 * =============================================================================
 */
