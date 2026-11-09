const { createHmac, timingSafeEqual } = require("node:crypto");
const { ErroRecuperacao } = require("./recuperacao-acesso.cjs");
const { horarioNoturnoEntregaUI } = require("../../js/regras-entrega.js");

const ORIGEM_ENTREGA = { latitude: -15.553076945525193, longitude: -56.05602240360688 };
const VALIDADE_COTACAO_MS = 15 * 60_000;
const LIMITE_DIARIO_ROTAS = 2500;
const coordenadas = ({ latitude, longitude }) => `${latitude},${longitude}`;
const modoEntrega = (em) => (horarioNoturnoEntregaUI(em) ? "drive" : "motorcycle");

function criarLimitadorFreteRota(db) {
  return async (em) => {
    const dia = new Date(em).toISOString().slice(0, 10);
    const ref = db.collection("config").doc("usoFreteRotas");
    await db.runTransaction(async (t) => {
      const uso = (await t.get(ref)).data();
      const quantidade = uso?.dia === dia ? uso.quantidade : 0;
      if (quantidade >= LIMITE_DIARIO_ROTAS)
        throw new ErroRecuperacao(
          429,
          "O cálculo de entrega atingiu o limite de hoje. Fale com a loja ou escolha retirada.",
        );
      t.set(ref, { dia, quantidade: quantidade + 1 });
    });
  };
}

function criarFreteRota({ apiKey, chave, consumirConsulta, fetchHttp = fetch }) {
  if (!apiKey || chave.length < 32) throw Error("Configure as chaves do cálculo de entrega.");

  function assinar(ponto, modo, expira, metros) {
    return createHmac("sha256", chave)
      .update(
        `frete-geoapify:v1:${coordenadas(ORIGEM_ENTREGA)}:${coordenadas(ponto)}:${modo}:${expira}:${metros}`,
      )
      .digest("base64url");
  }

  return {
    async cotar(ponto, em) {
      await consumirConsulta(em);
      const modo = modoEntrega(em);
      const url = new URL("https://api.geoapify.com/v1/routing");
      url.search = new URLSearchParams({
        waypoints: `${coordenadas(ORIGEM_ENTREGA)}|${coordenadas(ponto)}`,
        mode: modo,
        format: "geojson",
        units: "metric",
        apiKey,
      });
      let metros;
      try {
        const resposta = await fetchHttp(url, {
          redirect: "error",
          signal: AbortSignal.timeout(5000),
        });
        if (!resposta.ok) throw Error();
        const rota = (await resposta.json()).features?.[0]?.properties;
        metros = rota?.distance;
        if (!Number.isFinite(metros) || metros < 0) throw Error();
      } catch {
        throw new ErroRecuperacao(
          503,
          "Não foi possível calcular a rota de entrega. Tente novamente, fale com a loja ou escolha retirada.",
        );
      }
      const expira = em + VALIDADE_COTACAO_MS;
      return {
        distanciaKm: metros / 1000,
        comprovante: `${expira}:${metros}:${assinar(ponto, modo, expira, metros)}`,
      };
    },
    conferir(ponto, comprovante, em) {
      const campos =
        typeof comprovante === "string" &&
        comprovante.length <= 120 &&
        /^([0-9]{13}):([0-9]+(?:\.[0-9]+)?):([A-Za-z0-9_-]{43})$/.exec(comprovante);
      if (campos) {
        const [, expira, metros, assinatura] = campos;
        const esperada = assinar(ponto, modoEntrega(em), expira, metros);
        if (Number(expira) > em && timingSafeEqual(Buffer.from(assinatura), Buffer.from(esperada)))
          return Number(metros) / 1000;
      }
      throw new ErroRecuperacao(
        409,
        "A cotação da entrega precisa ser atualizada. Volte e toque em Finalizar pedido para calcular de novo.",
      );
    },
  };
}

module.exports = { ORIGEM_ENTREGA, criarFreteRota, criarLimitadorFreteRota };
