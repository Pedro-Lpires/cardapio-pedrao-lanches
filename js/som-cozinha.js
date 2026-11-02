/* Usa a fila já assinada: não abre leituras extras nem envia notificações push. */
const avisosFilaCozinhaUI = { jornada: null, iniciou: false, vistos: new Set() };
function processarSomFilaCozinhaUI(registros, jornada) {
  const estado = avisosFilaCozinhaUI;
  if (estado.jornada !== jornada) {
    estado.jornada = jornada;
    estado.iniciou = false;
    estado.vistos.clear();
  }
  const novos = registros.filter((r) => !estado.vistos.has(r.id));
  for (const r of registros) estado.vistos.add(r.id);
  if (!estado.iniciou) {
    estado.iniciou = true;
    return;
  }
  const pedidos = novos.filter(
    (r) => r.status === "aguardando" && itensChapeiroOperacao(r.itens || []).length > 0,
  );
  if (!pedidos.length) return;
  somChamadosAtendenteUI.ultimo = `${pedidos.length} nova(s) leva(s) para preparar na chapa.`;
  tocarSomChamadoAtendenteUI("atendente");
}
async function alternarSomCozinhaUI() {
  if (somChamadosAtendenteUI.iniciando) return;
  if (somChamadosAtendenteUI.ligado) {
    encerrarSomChamadosAtendenteUI();
  } else {
    await ativarSomChamadosAtendenteUI();
  }
}
