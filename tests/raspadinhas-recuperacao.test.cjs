const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const fonte = fs.readFileSync("js/raspadinhas-recuperacao.js", "utf8");
const clone = (valor) => JSON.parse(JSON.stringify(valor));
const registros = new Map([
  ["campanhasRaspadinhas/campanha", { ativa: true, modo: "automatico", criadoEm: 100 }],
]);
const consultas = [];
let agora = 1000000,
  sequencia = 0,
  filaTransacoes = Promise.resolve();
class Relogio extends Date {
  static now() {
    return agora;
  }
}
const snapshot = (caminho) => ({
  id: caminho.split("/").at(-1),
  exists: registros.has(caminho),
  data: () => clone(registros.get(caminho)),
});
function colecao(nome, filtros = [], limite = null, cursor = null, ordem = []) {
  return {
    doc: (id) => ({ caminho: nome + "/" + id }),
    where: (campo, op, valor) =>
      colecao(nome, [...filtros, [campo, op, valor]], limite, cursor, ordem),
    orderBy: (campo) => colecao(nome, filtros, limite, cursor, [...ordem, campo]),
    limit: (valor) => colecao(nome, filtros, valor, cursor, ordem),
    startAfter: (tempo, id) => colecao(nome, filtros, limite, { tempo, id }, ordem),
    async get() {
      if (nome !== "campanhasRaspadinhas") assert.equal(limite, 10, "Sempre limita o lote");
      consultas.push({ nome, filtros, cursor, limite });
      const campoOrdem = ordem[0];
      const docs = [...registros.keys()]
        .filter((chave) => chave.startsWith(nome + "/"))
        .map(snapshot)
        .filter((doc) =>
          filtros.every(([campo, op, valor]) => {
            const v = doc.data()[campo];
            return op === "==" ? v === valor : op === ">=" ? v >= valor : v <= valor;
          }),
        )
        .sort((a, b) => a.data()[campoOrdem] - b.data()[campoOrdem] || a.id.localeCompare(b.id))
        .filter(
          (doc) =>
            !cursor ||
            doc.data()[campoOrdem] > cursor.tempo ||
            (doc.data()[campoOrdem] === cursor.tempo && doc.id > cursor.id),
        );
      return { docs: limite ? docs.slice(0, limite) : docs };
    },
  };
}
const db = {
  collection: colecao,
  runTransaction(fn) {
    const executar = async () => {
      const escritas = [];
      const resultado = await fn({
        get: async (ref) => snapshot(ref.caminho),
        set: (ref, dados, opcoes) => escritas.push({ ref, dados, opcoes }),
      });
      for (const { ref, dados, opcoes } of escritas)
        registros.set(
          ref.caminho,
          clone(opcoes?.merge ? { ...registros.get(ref.caminho), ...dados } : dados),
        );
      return resultado;
    };
    const tarefa = filaTransacoes.then(executar);
    filaTransacoes = tarefa.catch(() => {});
    return tarefa;
  },
};
const premios = new Set();
let falhar = null,
  liberar = null;
function painel() {
  const status = { textContent: "" },
    botao = { disabled: false };
  const ctx = vm.createContext({
    db,
    Date: Relogio,
    console: { error() {} },
    codigoRaspadinha: () => String(++sequencia),
    setTimeout: () => 1,
    clearTimeout() {},
    document: { getElementById: (id) => (id === "raspa-conferir" ? botao : status) },
    async verificarRaspadinhasCompra(colecao, id) {
      if (liberar) await liberar;
      premios.add(colecao + "/" + id);
      if (id === falhar) {
        falhar = null;
        throw Error("resource-exhausted");
      }
    },
  });
  vm.runInContext(fonte, ctx);
  return { ctx, status, botao };
}
(async () => {
  for (let i = 1; i <= 25; i++)
    registros.set("pedidos/p" + String(i).padStart(2, "0"), { pagamentoConfirmadoEm: 1000 });
  let p = painel();
  await p.ctx.recuperarPendenciasRaspadinha();
  assert.equal(premios.size, 10);
  assert.equal(registros.get("config/recuperacaoRaspadinhas").cursores.pedidos.id, "p10");
  // Fecha o painel e volta no dia seguinte: não reinicia o histórico.
  agora += 86400000;
  p = painel();
  await p.ctx.recuperarPendenciasRaspadinha();
  assert.equal(premios.size, 20);
  assert.equal(registros.get("config/recuperacaoRaspadinhas").cursores.pedidos.id, "p20");
  falhar = "p22";
  await p.ctx.recuperarPendenciasRaspadinha();
  assert.equal(
    registros.get("config/recuperacaoRaspadinhas").cursores.pedidos.id,
    "p20",
    "Não avança lote que falhou",
  );
  assert.match(p.status.textContent, /pausada/);
  await p.ctx.recuperarPendenciasRaspadinha();
  assert.equal(premios.size, 25, "Repetição do lote não duplica concessões");
  assert.equal(registros.get("config/recuperacaoRaspadinhas").cursores.pedidos.id, "p25");
  assert.equal(p.botao.disabled, false);
  registros.set("pedidos/p26", { pagamentoConfirmadoEm: 2000 });
  let resolver;
  liberar = new Promise((resolve) => (resolver = resolve));
  const primeiro = p.ctx.recuperarPendenciasRaspadinha();
  // Aguarda a leitura do lote no primeiro painel antes de iniciar o segundo.
  for (let i = 0; i < 30; i++) await Promise.resolve();
  const outro = painel();
  await outro.ctx.recuperarPendenciasRaspadinha();
  assert.match(outro.status.textContent, /Outro painel/);
  liberar = null;
  resolver();
  await primeiro;
  assert.equal(premios.size, 26);
  const antes = consultas.length;
  await p.ctx.recuperarPendenciasRaspadinha();
  const recentes = consultas.slice(antes).filter((c) => c.nome === "pedidos");
  assert.equal(recentes[0].cursor.id, "p26");
  assert.equal(registros.get("config/recuperacaoRaspadinhas").travaAte, 0);
  console.log(
    "PASS: recuperação em lotes, cursor com empate de data, outro dia, falha sem avanço e exclusão mútua entre painéis.",
  );
})().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
