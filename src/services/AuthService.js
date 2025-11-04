/**
 * =============================================================================
 *  src/services/AuthService.js
 * -----------------------------------------------------------------------------
 *  OBJETIVO DA CAMADA "SERVICE":
 *    - Conter a REGRA DE NEGÓCIO de Autenticação/Autorização.
 *    - Aqui NÃO lidamos com HTTP (req/res) e NEM com SQL/arquivos diretamente.
 *      * Quem fala com HTTP é o CONTROLLER.
 *      * Quem fala com BD/JSON é o REPOSITORY.
 *
 *  O QUE ESTE SERVICE ENTREGA:
 *    - register({ nome, email, senha })
 *        * Gera o hash (bcrypt) da senha
 *        * Cria o usuário (via Repository)
 *        * Gera o JWT
 *        * Retorna { usuario: toPublic(), token }
 *
 *    - login({ email, senha })
 *        * Busca usuário pelo e-mail
 *        * Compara a senha informada com o hash (bcrypt.compare)
 *        * Gera JWT e retorna { usuario: toPublic(), token }
 *
 *  POR QUE "toPublic()"?
 *    - Para NUNCA vazar "senha_hash" para fora da camada de domínio.
 *
 *  OBSERVAÇÕES DE SEGURANÇA:
 *    - Mensagem de erro GENÉRICA ("Usuário/senha inválidos.") no login evita
 *      "enumeration" (não revelar se o e-mail existe ou não).
 *    - O token é assinado no utils/jwt.js com expiração (2h). Em produção,
 *      considere tokens curtos + refresh token.
 * =============================================================================
 */

import { hashSenha, compareSenha } from "../utils/crypto.js"; // bcrypt (hash/compare)
import { generateJwt } from "../utils/jwt.js"; // geração do JWT
import { Usuario } from "../models/Usuario.js"; // model com validações de domínio

export class AuthService {
  /**
   * Recebe o "usuarioRepo" (injeção de dependência)
   * - Isso facilita testes (podemos passar um repo fake/memória).
   * - Deixa o service desacoplado de um SGBD específico.
   */
  constructor(usuarioRepo) {
    this.usuarioRepo = usuarioRepo;
  }

  /**
   * ----------------------------------------------------------------------------
   * register({ nome, email, senha })
   * ----------------------------------------------------------------------------
   * Fluxo:
   *   1) Verificar se e-mail já está em uso
   *   2) Gerar hash seguro da senha (bcrypt)
   *   3) Criar o model Usuario (validações de nome/e-mail/created_at)
   *   4) Persistir via repository
   *   5) Gerar JWT com { id, email }
   *   6) Retornar visão pública + token
   *
   * Observações:
   *   - Mesmo checando "findByEmail", ainda é importante o BD ter UNIQUE(email).
   *     Em condição de corrida, o UNIQUE garante a consistência.
   */
  async register({ nome, email, senha }) {
    // 1) E-mail precisa ser único no sistema
    const jaExiste = await this.usuarioRepo.findByEmail(email);
    if (jaExiste) {
      // Mantemos mensagem clara aqui, pois é cadastro. (No login, usamos genérica.)
      throw new Error("E-mail já cadastrado.");
    }

    // 2) Gera hash da senha (NUNCA salve senha em texto)
    const senha_hash = await hashSenha(senha);

    // 3) Cria o Model (faz validações de domínio: nome, email, etc.)
    const novo = new Usuario({ nome, email, senha_hash });

    // 4) Persiste no BD (MySQL) via repository
    const criado = await this.usuarioRepo.create(novo);

    // 5) Gera o token (payload mínimo: id e email)
    //    - Evite colocar dados sensíveis no payload, pois o JWT não é criptografado.
    const token = generateJwt({ id: criado.id, email: criado.email });

    // 6) Retorna visão pública + token (sem senha_hash!)
    return { usuario: criado.toPublic(), token };
  }

  /**
   * ----------------------------------------------------------------------------
   * login({ email, senha })
   * ----------------------------------------------------------------------------
   * Fluxo:
   *   1) Buscar usuário pelo e-mail
   *   2) Comparar a senha informada com o hash do banco (bcrypt.compare)
   *   3) Se bater, gerar JWT com { id, email }
   *   4) Retornar visão pública + token
   *
   * Observações:
   *   - Mensagem de erro genérica (evita revelar se e-mail existe).
   *   - Em sistemas reais, considerar limiter (tentativas) e logs.
   */
  async login({ email, senha }) {
    // 1) Busca pelo e-mail
    const user = await this.usuarioRepo.findByEmail(email);
    if (!user) {
      // Mensagem genérica (boa prática): não entregar se "errou e-mail" ou "errou senha".
      throw new Error("Usuário/senha inválidos.");
    }

    // 2) Compara a senha informada com o hash armazenado
    const ok = await compareSenha(senha, user.senha_hash);
    if (!ok) {
      throw new Error("Usuário/senha inválidos.");
    }

    // 3) Gera token
    const token = generateJwt({ id: user.id, email: user.email });

    // 4) Retorna visão pública + token
    return { usuario: user.toPublic(), token };
  }
}

/* =============================================================================
 * DICAS / EXTENSÕES (apenas comentários):
 * -----------------------------------------------------------------------------
 * - "Esqueci minha senha":
 *     * Gerar "token de recuperação" temporário (assinado e com expiração curta),
 *       enviar por e-mail com link seguro; ao abrir o link, permitir redefinição.
 *
 * - "Refresh token":
 *     * Access token de curta duração (ex.: 15min–2h).
 *     * Refresh token mais longo, guardado com segurança (HttpOnly cookie / BD).
 *     * Endpoint /refresh para emitir novo access token quando expirar.
 *
 * - "Revogação de tokens":
 *     * Manter uma "versão de token" por usuário no BD. Ao trocar a senha,
 *       incremente a versão; tokens antigos (com versão anterior) passam a ser inválidos.
 *
 * - "Tratamento de erros":
 *     * Este service lança Error(). O controller deve capturar e traduzir para HTTP
 *       (400, 401, 409, 500...). Um middleware global de erros ajuda a padronizar.
 * =============================================================================
 */
