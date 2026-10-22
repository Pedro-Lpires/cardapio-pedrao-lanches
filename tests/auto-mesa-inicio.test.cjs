const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const registros = new Map();
let numero = 6,
  escritas = 0,
  identificacoes = 0,
  bloqueios = 0;
const area = { innerHTML: "" };
const doc = (id) => ({ id, exists: registros.has(id), data: () => registros.get(id) });
const ref = (id) => ({ id, get: async () => doc(id) });
const contexto = vm.createContext({
  document: { getElementById: () => area },
  obterNumeroMesaDaUrl: () => numero,
  htmlCarregandoUI: () => "Carregando mesa",
  lerComPrazoUI: (promessa) => promessa,
  recuperarSessaoAutoatendimento: async () => null,
  mostrarIdentificacaoAutoatendimento: () => identificacoes++,
  mostrarMesaBloqueadaAutoatendimento: () => bloqueios++,
  mesaAutoatendimentoId: null,
  mesaAutoatendimentoAtual: null,
  db: {
    collection: () => ({
      where: (_, __, n) => ({
        limit: () => ({
          get: async () => ({
            docs: [...registros.keys()].filter((id) => registros.get(id).numero === n).map(doc),
          }),
        }),
      }),
      doc: ref,
    }),
    runTransaction: async (fn) =>
      fn({
        get: (r) => r.get(),
        set: (r, dados) => {
          escritas++;
          registros.set(r.id, dados);
        },
      }),
  },
});
const fonte = fs.readFileSync("js/autoatendimento.js", "utf8");
vm.runInContext(
  fonte.slice(
    fonte.indexOf("async function iniciarAutoatendimento("),
    fonte.indexOf("async function recuperarSessaoAutoatendimento("),
  ),
  contexto,
);
(async () => {
  await contexto.iniciarAutoatendimento();
  assert.equal(contexto.mesaAutoatendimentoAtual.numero, 6);
  assert.equal(identificacoes, 1);
  assert.equal(escritas, 1);
  await contexto.iniciarAutoatendimento();
  assert.equal(escritas, 1);
  registros.clear();
  registros.set("mesa-legada", { numero: 6, ocupada: true, detalhe: "preservar" });
  await contexto.iniciarAutoatendimento();
  assert.equal(bloqueios, 1);
  assert.equal(escritas, 1);
  assert.equal(contexto.mesaAutoatendimentoId, "mesa-legada");
  assert.equal(registros.get("mesa-legada").detalhe, "preservar");
  numero = 21;
  await contexto.iniciarAutoatendimento();
  assert.equal(escritas, 1);
  assert.match(area.innerHTML, /não está cadastrada/);
  console.log(
    "PASS: mesa 6 criada no primeiro QR, repetição sem duplicar, mesa ocupada preservada e criação limitada às vinte mesas.",
  );
})().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
