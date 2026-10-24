/** Campanhas: canal, público, aviso ou vínculo com cupom existente. */
let publicoCampanha = [];
let cuponsCampanhaUI = [];
let historicoCampanhasUI = [],
  cursorCampanhasUI = null,
  fimCampanhasUI = false;
let publicandoCampanhaUI = false;
let revisaoCampanhaUI = 0,
  carregandoHistoricoCampanha = false;
function montarCampanhasAdmin() {
  const area = document.getElementById("area-admin-avancada");
  if (!area || document.getElementById("campanhas-admin")) return;
  const box = document.createElement("section");
  box.id = "campanhas-admin";
  box.innerHTML = `<h2>Campanhas para clientes</h2><p>Escolha onde a mensagem aparece na conta do cliente e confira os destinatários antes de enviar.</p>
  <form id="campanha-form" onsubmit="event.preventDefault();prepararCampanhaAdmin()" oninput="invalidarPreviaCampanha()" onchange="invalidarPreviaCampanha()">
  <fieldset id="campanha-campos"><legend>Nova campanha</legend>
  <label>Canal<select id="campanha-canal" onchange="atualizarCanalCampanhaUI()"><option value="admin">ADM · mensagem especial</option><option value="geral">Geral · comunicado da loja</option></select></label>
  <p id="campanha-canal-ajuda" class="campanha-ajuda"></p>
  <label>Público<select id="campanha-publico" onchange="atualizarPublicoCampanhaUI()"></select></label>
  <label id="campanha-rank-campo" hidden>Nível<select id="campanha-rank"><option>Bronze</option><option>Prata</option><option>Ouro</option><option>Diamante</option><option>Imortal</option><option>Sem nível</option></select></label>
  <label id="campanha-cliente-campo">Telefone ou código CDA<input id="campanha-cliente" placeholder="Informe a conta do cliente"></label>
  <label>Finalidade<select id="campanha-finalidade" onchange="atualizarFinalidadeCampanhaUI()"><option value="aviso">Aviso · somente mensagem</option><option value="cupom">Cupom · vincular existente</option></select></label>
  <div id="campanha-cupom-campo" hidden><label>Cupom existente<select id="campanha-codigo"><option value="">Carregue os cupons</option></select></label><button type="button" onclick="carregarCuponsCampanha()">Buscar cupons</button><p class="campanha-ajuda">Crie e configure o cupom na seção Cupons de Desconto. A campanha mantém suas condições de uso e define quem recebe a mensagem.</p></div>
  <label>Mensagem<textarea id="campanha-texto" required rows="4" placeholder="Escreva a mensagem para este público..."></textarea></label>
  <button type="submit">Conferir campanha</button></fieldset></form>
  <div id="campanha-previa" role="status" aria-live="polite"></div>
  <section class="campanha-historico"><h3>Campanhas enviadas</h3><p>Consulte mensagens dos dois canais, destinatários e situação do envio.</p>
  <button type="button" onclick="carregarHistoricoCampanhas(true)">Consultar histórico</button>
  <div class="campanha-filtros"><label>Canal<select id="campanha-filtro-canal" onchange="renderizarHistoricoCampanhas()"><option value="todos">Todos</option><option value="admin">ADM</option><option value="geral">Geral</option></select></label><label>Finalidade<select id="campanha-filtro-finalidade" onchange="renderizarHistoricoCampanhas()"><option value="todos">Todas</option><option value="aviso">Avisos</option><option value="cupom">Cupons</option></select></label></div>
  <p id="campanha-historico-status" role="status"></p><div id="campanha-historico-lista"></div><button type="button" id="campanha-mais" hidden onclick="carregarHistoricoCampanhas()">Carregar anteriores</button></section>`;
  area.prepend(box);
  atualizarCanalCampanhaUI();
}
function invalidarPreviaCampanha() {
  if (publicandoCampanhaUI) return;
  revisaoCampanhaUI++;
  window.previaCampanhaPedrao = null;
  document.getElementById("campanha-previa").textContent = "";
}
function atualizarCanalCampanhaUI() {
  const adm = document.getElementById("campanha-canal").value === "admin";
  document.getElementById("campanha-publico").innerHTML = adm
    ? '<option value="cliente">Uma pessoa</option><option value="rank">Por nível</option>'
    : '<option value="todos">Todos os clientes</option><option value="rank">Por nível</option>';
  document.getElementById("campanha-canal-ajuda").textContent = adm
    ? "Aparece em ADM, junto das mensagens especiais e raspadinhas."
    : "Aparece em Geral. Use para horários, comunicados da loja, sorteios ou divulgação de cupons.";
  atualizarPublicoCampanhaUI();
  invalidarPreviaCampanha();
}
function atualizarPublicoCampanhaUI() {
  const modo = document.getElementById("campanha-publico").value;
  document.getElementById("campanha-rank-campo").hidden = modo !== "rank";
  document.getElementById("campanha-cliente-campo").hidden = modo !== "cliente";
}
function atualizarFinalidadeCampanhaUI() {
  document.getElementById("campanha-cupom-campo").hidden =
    document.getElementById("campanha-finalidade").value !== "cupom";
}
async function carregarCuponsCampanha() {
  if (!adminAvancadoLiberado) return;
  invalidarPreviaCampanha();
  const select = document.getElementById("campanha-codigo");
  select.innerHTML = '<option value="">Buscando...</option>';
  try {
    const snap = await db.collection("cuponsDesconto").where("ativo", "==", true).get();
    cuponsCampanhaUI = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
    select.innerHTML =
      '<option value="">' +
      (cuponsCampanhaUI.length ? "Selecione o cupom" : "Nenhum cupom ativo") +
      "</option>" +
      cuponsCampanhaUI
        .map(
          (c) =>
            '<option value="' +
            escaparOperacao(c.id) +
            '">' +
            escaparOperacao(c.codigo || c.id) +
            " · " +
            escaparOperacao(c.nome || "Cupom") +
            "</option>",
        )
        .join("");
  } catch {
    select.innerHTML = '<option value="">Não foi possível buscar os cupons</option>';
  }
}
async function validarCupomCampanha(codigo, clientes) {
  const doc = await db.collection("cuponsDesconto").doc(codigo).get();
  if (!doc.exists || !doc.data().ativo)
    throw Error("O cupom não existe ou está desativado. Confira na seção Cupons.");
  const c = doc.data();
  if (
    Array.isArray(c.clientesPermitidos) &&
    clientes.some((id) => !c.clientesPermitidos.includes(id))
  )
    throw Error(
      "Este cupom não permite todas as contas escolhidas. Ajuste o público ou escolha outro cupom.",
    );
  return c;
}
async function prepararCampanhaAdmin() {
  if (!adminAvancadoLiberado || publicandoCampanhaUI) return;
  invalidarPreviaCampanha();
  const revisao = revisaoCampanhaUI;
  const box = document.getElementById("campanha-previa");
  try {
    const canal = document.getElementById("campanha-canal").value,
      modo = document.getElementById("campanha-publico").value,
      rank = document.getElementById("campanha-rank").value;
    if (
      !["admin", "geral"].includes(canal) ||
      !(canal === "admin" ? ["cliente", "rank"] : ["todos", "rank"]).includes(modo)
    )
      throw Error("Confira o canal e o público.");
    const texto = document.getElementById("campanha-texto").value.trim();
    if (!texto) throw Error("Escreva a mensagem.");
    const finalidade = document.getElementById("campanha-finalidade").value;
    if (!["aviso", "cupom"].includes(finalidade)) throw Error("Escolha Aviso ou Cupom.");
    const codigo = finalidade === "cupom" ? document.getElementById("campanha-codigo").value : "";
    if (finalidade === "cupom" && !codigo) throw Error("Escolha um cupom existente.");
    box.textContent = "Buscando destinatários...";
    let query = db.collection("clientes"),
      contas;
    if (modo === "cliente") {
      const chave = document.getElementById("campanha-cliente").value.trim();
      if (!chave) throw Error("Informe telefone ou código CDA.");
      const telefone = chave.replace(/\D/g, "");
      if (telefone.length === 11) {
        const d = await query.doc(telefone).get();
        contas = d.exists ? [{ ...d.data(), id: d.id }] : [];
      } else {
        const snap = await query.where("codigoAtivacao", "==", chave).get();
        contas = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        if (contas.length > 1) throw Error("Código CDA duplicado. Busque pelo telefone.");
      }
    } else {
      if (modo === "rank" && rank !== "Sem nível")
        query =
          rank === "Imortal"
            ? query.where("nivelCliente", "in", ["Imortal", "Lenda"])
            : query.where("nivelCliente", "==", rank);
      const snap = await query.get();
      contas = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
      if (modo === "rank")
        contas = contas.filter((c) =>
          rank === "Sem nível"
            ? !c.fidelidadeAtiva || !(c.nivelCliente || c.nivel)
            : c.fidelidadeAtiva &&
              ((c.nivelCliente || c.nivel) === "Lenda" ? "Imortal" : c.nivelCliente || c.nivel) ===
                rank,
        );
    }
    if (!contas.length) throw Error("Nenhuma conta corresponde ao público escolhido.");
    const clientes = contas.map((c) => c.id),
      cupom = codigo ? await validarCupomCampanha(codigo, clientes) : null;
    if (revisao !== revisaoCampanhaUI) return;
    publicoCampanha = contas;
    const previa = {
      canal,
      publico: modo,
      rank: modo === "rank" ? rank : "",
      finalidade,
      texto,
      cupomCodigo: codigo,
      cupomNome: cupom?.nome || "",
      cupomUso: cupom?.uso || "diversos",
      clientes,
      destinatarios: contas.map((c) => ({ id: c.id, nome: c.nome || c.id })),
      status: "preparada",
      enviados: 0,
    };
    window.previaCampanhaPedrao = previa;
    box.innerHTML =
      '<article class="campanha-previa-cartao"><h3>Conferir envio</h3><p><strong>' +
      (canal === "admin" ? "ADM" : "Geral") +
      " · " +
      (codigo ? "Cupom" : "Aviso") +
      "</strong></p><p>" +
      contas.length +
      " destinatário(s) · " +
      escaparOperacao(
        modo === "rank"
          ? rank
          : modo === "todos"
            ? "Todos os clientes"
            : contas[0].nome || contas[0].id,
      ) +
      "</p><p>" +
      contas
        .slice(0, 8)
        .map((c) => escaparOperacao(c.nome || c.id))
        .join(", ") +
      (contas.length > 8 ? "…" : "") +
      '</p><p class="campanha-texto">' +
      escaparOperacao(texto) +
      "</p>" +
      (codigo
        ? "<p>Cupom: <strong>" +
          escaparOperacao(codigo) +
          "</strong> · " +
          escaparOperacao(cupom.nome || "") +
          "</p>"
        : "") +
      (cupom?.uso === "unico"
        ? '<p class="campanha-ajuda">Código 1x: somente a primeira utilização será aceita, mesmo que esta mensagem seja enviada para várias contas.</p>'
        : "") +
      '<button type="button" id="campanha-publicar" onclick="publicarCampanhaAdmin()">Enviar campanha</button></article>';
  } catch (e) {
    if (revisao === revisaoCampanhaUI) box.textContent = e.message;
  }
}
async function publicarCampanhaAdmin() {
  const previa = window.previaCampanhaPedrao;
  if (!previa || !adminAvancadoLiberado || publicandoCampanhaUI) return;
  publicandoCampanhaUI = true;
  document.getElementById("campanha-campos").disabled = true;
  const botao = document.getElementById("campanha-publicar");
  if (botao) botao.disabled = true;
  const box = document.getElementById("campanha-previa");
  try {
    if (previa.cupomCodigo) await validarCupomCampanha(previa.cupomCodigo, previa.clientes);
    const ref = previa.id
      ? db.collection("campanhas").doc(previa.id)
      : db.collection("campanhas").doc();
    if (!previa.id) {
      previa.id = ref.id;
      previa.criadoEm = Date.now();
    }
    await ref.set({ ...previa, status: "publicando" });
    const texto = previa.texto;
    for (let i = previa.enviados || 0; i < previa.clientes.length; i += 400) {
      const lote = previa.clientes.slice(i, i + 400),
        batch = db.batch();
      lote.forEach((id) =>
        batch.set(db.collection("clientes").doc(id).collection("mensagens").doc(ref.id), {
          tipo: previa.canal || "admin",
          texto,
          remetente: "admin",
          data: new Date(previa.criadoEm).toISOString(),
          lida: false,
          campanhaId: ref.id,
          finalidade: previa.finalidade,
          cupomCodigo: previa.cupomCodigo || "",
        }),
      );
      batch.update(ref, {
        enviados: i + lote.length,
        status: i + lote.length === previa.clientes.length ? "publicada" : "publicando",
      });
      await batch.commit();
      previa.enviados = i + lote.length;
    }
    box.innerHTML =
      '<div class="campanha-envio-concluido"><strong>Campanha enviada</strong><p>' +
      "Mensagem enviada para " +
      previa.clientes.length +
      " conta(s), na aba " +
      (previa.canal === "geral" ? "Geral" : "ADM") +
      ".</p></div>";
    window.previaCampanhaPedrao = null;
  } catch (e) {
    box.innerHTML =
      "<p>" +
      escaparOperacao("Envio não concluído: " + e.message) +
      '</p><button type="button" id="campanha-publicar" onclick="publicarCampanhaAdmin()">Tentar novamente</button>';
  } finally {
    publicandoCampanhaUI = false;
    document.getElementById("campanha-campos").disabled = false;
  }
}
async function carregarHistoricoCampanhas(reiniciar = false) {
  if (!adminAvancadoLiberado || carregandoHistoricoCampanha) return;
  carregandoHistoricoCampanha = true;
  const status = document.getElementById("campanha-historico-status");
  status.textContent = "Buscando campanhas...";
  try {
    if (reiniciar) {
      historicoCampanhasUI = [];
      cursorCampanhasUI = null;
      fimCampanhasUI = false;
    }
    if (!fimCampanhasUI) {
      let query = db.collection("campanhas").orderBy("criadoEm", "desc").limit(20);
      if (cursorCampanhasUI) query = query.startAfter(cursorCampanhasUI);
      const snap = await query.get();
      historicoCampanhasUI.push(...snap.docs.map((d) => ({ ...d.data(), id: d.id })));
      cursorCampanhasUI = snap.docs.at(-1) || cursorCampanhasUI;
      fimCampanhasUI = snap.size < 20;
    }
    status.textContent =
      historicoCampanhasUI.length +
      " campanha(s) carregada(s). Os filtros se aplicam a esta lista.";
    document.getElementById("campanha-mais").hidden = fimCampanhasUI;
    renderizarHistoricoCampanhas();
  } catch {
    status.textContent = "Não foi possível carregar o histórico. Tente novamente.";
  } finally {
    carregandoHistoricoCampanha = false;
  }
}
function renderizarHistoricoCampanhas() {
  const canal = document.getElementById("campanha-filtro-canal").value,
    finalidade = document.getElementById("campanha-filtro-finalidade").value;
  const lista = historicoCampanhasUI.filter(
    (c) =>
      (canal === "todos" || (c.canal || "admin") === canal) &&
      (finalidade === "todos" ||
        (c.finalidade || (c.cupomCodigo ? "cupom" : "aviso")) === finalidade),
  );
  document.getElementById("campanha-historico-lista").innerHTML = lista.length
    ? lista
        .map(
          (c) =>
            '<article class="campanha-registro"><div class="campanha-registro-topo"><strong>' +
            ((c.canal || "admin") === "geral" ? "Geral" : "ADM") +
            " · " +
            (c.cupomCodigo ? "Cupom" : "Aviso") +
            "</strong><span>" +
            escaparOperacao(c.status === "publicada" ? "Enviada" : "Envio incompleto") +
            "</span></div><small>" +
            new Date(c.criadoEm).toLocaleString("pt-BR") +
            "</small><p>Público: " +
            escaparOperacao(
              c.publico === "rank"
                ? c.rank
                : c.publico === "cliente"
                  ? "Uma pessoa"
                  : c.publico === "todos"
                    ? "Todos os clientes"
                    : "Público selecionado",
            ) +
            " · " +
            (c.clientes || []).length +
            ' conta(s)</p><p class="campanha-texto">' +
            escaparOperacao(c.texto) +
            "</p>" +
            (c.cupomCodigo
              ? "<p>Cupom: <strong>" + escaparOperacao(c.cupomCodigo) + "</strong></p>"
              : "") +
            "<details><summary>Destinatários</summary><ul>" +
            (c.destinatarios || (c.clientes || []).map((id) => ({ id, nome: id })))
              .map(
                (d) => "<li>" + escaparOperacao(d.nome) + " · " + escaparOperacao(d.id) + "</li>",
              )
              .join("") +
            "</ul></details>" +
            (c.canal && c.status !== "publicada"
              ? '<button type="button" onclick="retomarCampanhaAdmin(\'' +
                escaparOperacao(c.id) +
                "')\">Retomar envio</button>"
              : "") +
            "</article>",
        )
        .join("")
    : "<p>Nenhuma campanha neste filtro.</p>";
}
async function retomarCampanhaAdmin(id) {
  if (!adminAvancadoLiberado || publicandoCampanhaUI) return;
  const box = document.getElementById("campanha-previa");
  try {
    const doc = await db.collection("campanhas").doc(id).get();
    if (!doc.exists || !doc.data().canal) throw Error("Campanha não encontrada.");
    const campanha = doc.data();
    if (campanha.status === "publicada") throw Error("Esta campanha já foi enviada.");
    window.previaCampanhaPedrao = { ...campanha, id: doc.id };
    box.innerHTML =
      "<p>Envio recuperado: " +
      (campanha.enviados || 0) +
      " de " +
      campanha.clientes.length +
      ' contas concluídas.</p><button id="campanha-publicar" type="button" onclick="publicarCampanhaAdmin()">Continuar envio</button>';
    box.scrollIntoView({ block: "nearest" });
  } catch (e) {
    box.textContent = e.message;
  }
}
async function historicoCompletoClienteAdmin(telefone) {
  const box = document.getElementById("pedidos-cliente-admin");
  if (!box) return;
  const aberta = box.parentElement?.matches("dialog.interface-janela") ? box.parentElement : null;
  if (aberta) return aberta.close();
  abrirJanelaElementoUI(box, "Pedidos e pagamentos");
  box.dataset.historicoCliente = telefone;
  box.innerHTML = htmlCarregandoUI("Carregando histórico…");
  try {
    const id = String(telefone).replace(/\D/g, "");
    const [pedidos, pagamentos, comandas] = await Promise.all([
      db.collection("pedidos").where("clienteId", "==", id).get(),
      db.collection("historicoPagamentosClientes").where("clienteId", "==", id).get(),
      db.collection("comandas").where("clienteId", "==", id).get(),
    ]);
    const locais = pagamentos.docs.map((d) => ({ ...d.data(), id: d.id, tipoHistorico: "local" }));
    const substituidos = new Set(locais.map((p) => p.pedidoId).filter(Boolean));
    comandas.docs.forEach((d) => {
      const c = d.data();
      if ((c.pagamentos || []).some((p) => p.tipo === "separado") && c.pedidoOrigemId)
        substituidos.add(c.pedidoOrigemId);
    });
    const lista = [
      ...locais,
      ...pedidos.docs
        .map((d) => ({
          ...d.data(),
          id: d.id,
          tipoHistorico: /local/i.test(d.data().tipo || "") ? "local" : "pedido",
        }))
        .filter((p) => !substituidos.has(p.id)),
    ];
    if (!lista.length) {
      box.innerHTML = "<p>Nenhum histórico disponível.</p>";
      return;
    }
    lista.sort((a, b) => tempoRegistroOperacao(b) - tempoRegistroOperacao(a));
    box.innerHTML =
      "<h4>Pedidos e pagamentos anteriores</h4>" +
        lista
          .map(
            (p) =>
              `<article class="registro-operacao"><h3>${p.tipoHistorico === "local" ? `Consumo no local${p.mesa ? " · Mesa " + escaparOperacao(p.mesa) : ""}` : `${/entrega/i.test(p.tipo || "") ? "Delivery" : /retirada/i.test(p.tipo || "") ? "Retirada" : "Pedido"} #${escaparOperacao(p.numero || "")}`}</h3><small>${new Date(tempoRegistroOperacao(p)).toLocaleString("pt-BR")}</small>${itensHtmlOperacao(p.itens || [], true)}<p>Total pago: <strong>${moedaOperacao(p.valorPago ?? p.valorTotal)}</strong></p><p>Benefícios: ${moedaOperacao(Number(p.descontoCupom || 0) + Number(p.descontoFidelidade || 0))}</p>${p.cupomCodigo ? `<p>Cupom: ${escaparOperacao(p.cupomCodigo)}</p>` : ""}</article>`,
          )
          .join("") || "<p>Nenhum histórico disponível.</p>";
  } catch (e) {
    box.textContent = "Não foi possível carregar o histórico: " + e.message;
  }
}
document.addEventListener("DOMContentLoaded", () => {
  montarCampanhasAdmin();
  window.listarPedidosClienteAdmin = historicoCompletoClienteAdmin;
});
