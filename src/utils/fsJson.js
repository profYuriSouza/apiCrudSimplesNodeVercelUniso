/**
 * =============================================================================
 *  utils/fsJson.js
 * -----------------------------------------------------------------------------
 *  Pequeno utilitário para trabalhar com ARQUIVOS JSON usando a API de PROMISES
 *  do Node (fs/promises). Aqui centralizamos três operações comuns:
 *
 *   1) ensureJsonFile(filePath, defaultContent)
 *      - Garante que o arquivo JSON exista. Se NÃO existir, cria com um conteúdo
 *        padrão (array/objeto). Se já existir, não mexe em nada.
 *
 *   2) readJson(filePath)
 *      - Lê o arquivo em UTF-8 e faz JSON.parse. Retorna o objeto/array.
 *        Caso o arquivo esteja vazio ou corrompido, o parse pode falhar.
 *
 *   3) writeJson(filePath, data)
 *      - Serializa "data" em JSON usando identação de 2 espaços e grava em UTF-8.
 *
 *  Por que centralizar isso?
 *    - Evita código repetido nas camadas de repositório.
 *    - Mantém o comportamento consistente (encoding, identação, etc.).
 *    - Facilita adicionar melhorias futuras (ex.: escrita atômica, validações).
 *
 *  Dicas importantes:
 *    - JSON *não* é banco de dados. É ótimo para protótipos/didática, mas cuidado:
 *      concorrência, tamanho do arquivo e corrupção por travamentos são problemas comuns.
 *    - Em cenários reais, prefira um SGBD (SQLite/MySQL/Postgres) para dados críticos.
 *    - Se você precisar de escrita "atômica" (mais segura), pode:
 *        1) escrever em um arquivo temporário (ex.: file.tmp)
 *        2) chamar fs.rename(file.tmp, filePath) — renomear no fim
 *      Assim reduz risco de ficar com JSON "meio escrito" caso o processo caia.
 * =============================================================================
 */

import fs from "fs/promises"; // API moderna baseada em Promises (sem callbacks)

/**
 * -----------------------------------------------------------------------------
 * ensureJsonFile(filePath, defaultContent = [])
 * -----------------------------------------------------------------------------
 * Verifica se o arquivo existe. Se NÃO existir, cria com "defaultContent".
 *
 * Parâmetros:
 *  - filePath       : caminho do arquivo JSON (ex.: "./produtos.json")
 *  - defaultContent : conteúdo inicial — tipicamente [] (array) ou {} (objeto)
 *
 * Como funciona:
 *  - fs.access(filePath) → dispara erro se o arquivo não existir (ou sem permissão)
 *  - No catch, gravamos um novo arquivo com o conteúdo padrão (serializado em JSON)
 *
 * Observação:
 *  - JSON.stringify(defaultContent, null, 2) → "2" controla a identação do arquivo,
 *    deixando legível para humanos (útil em aula e versionamento).
 *  - Encoding "utf-8" garante o padrão de leitura/escrita de texto.
 */
export async function ensureJsonFile(filePath, defaultContent = []) {
  try {
    // Tenta acessar o arquivo (verifica existência/permissão).
    // Se não lançar erro, assumimos que o arquivo já existe e NÃO precisamos criar.
    await fs.access(filePath);
  } catch {
    // Se cair aqui, é porque o arquivo não existe (ou não acessível).
    // Vamos criar o arquivo com o conteúdo padrão (por padrão, um array vazio).
    await fs.writeFile(
      filePath,
      JSON.stringify(defaultContent, null, 2), // identação de 2 espaços
      "utf-8"
    );
  }
}

/**
 * -----------------------------------------------------------------------------
 * readJson(filePath)
 * -----------------------------------------------------------------------------
 * Lê o arquivo e faz parse para objeto/array.
 *
 * Retorno:
 *  - Qualquer tipo válido de JSON (Array, Object, string, number...). No nosso
 *    projeto, esperamos tipicamente Array ou Object.
 *
 * Erros comuns:
 *  - Se o arquivo estiver VAZIO ou com JSON inválido, JSON.parse lança erro.
 *    Em situação de produção, você poderia envolver em try/catch e padronizar
 *    a resposta (ex.: retornar []), mas aqui preferimos "falhar rápido" para
 *    evidenciar problemas de dados durante o desenvolvimento.
 */
export async function readJson(filePath) {
  // Lê todo o conteúdo do arquivo como string UTF-8
  const raw = await fs.readFile(filePath, "utf-8");

  // Se o arquivo estiver vazio, "raw" vira "" (string vazia).
  // JSON.parse("") lança erro, por isso esse fallback ajuda em casos simples:
  return JSON.parse(raw || "[]");
}

/**
 * -----------------------------------------------------------------------------
 * writeJson(filePath, data)
 * -----------------------------------------------------------------------------
 * Serializa "data" como JSON e grava no arquivo com identação de 2 espaços.
 *
 * Parâmetros:
 *  - filePath: caminho do arquivo JSON
 *  - data    : qualquer valor JSON-serializável (Array/Object geralmente)
 *
 * Observações:
 *  - A gravação sobrescreve o arquivo existente. Se deseja preservar histórico,
 *    faça backup antes ou use versionamento (git).
 *  - Para "escrita atômica", considere escrever em arquivo temporário e renomear
 *    ao final (estratégia explicada no cabeçalho deste arquivo).
 */
export async function writeJson(filePath, data) {
  await fs.writeFile(
    filePath,
    JSON.stringify(data, null, 2), // identação facilita revisão em aula
    "utf-8"
  );
}

/**
 * -----------------------------------------------------------------------------
 * Exemplos de uso rápido (em comentários):
 * -----------------------------------------------------------------------------
 *
 *  // Garante que o arquivo exista com array inicial vazio
 *  await ensureJsonFile('./produtos.json', []);
 *
 *  // Lê a lista de produtos (array de objetos)
 *  const produtos = await readJson('./produtos.json');
 *
 *  // Adiciona um novo produto e salva
 *  produtos.push({ id: 4, nome: 'Apontador', preco: 4.50 });
 *  await writeJson('./produtos.json', produtos);
 *
 *  // Erros de JSON inválido:
 *  //  - Se alguém editar manualmente o arquivo e "quebrar" o JSON, readJson()
 *  //    vai lançar erro. Nessa hora, reabra o arquivo, conserte a sintaxe e salve.
 */
