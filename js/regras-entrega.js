/* A mesma política é usada na tela e no servidor, sempre no horário de Cuiabá. */
function horarioNoturnoEntregaUI(em = Date.now()) {
  const hora = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Cuiaba",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(em)),
  );
  return hora >= 23 || hora < 6;
}
function taxaEntregaRegraUI(km, em = Date.now()) {
  if (!Number.isFinite(km) || km < 0) throw Error("Confira a distância da entrega.");
  if (horarioNoturnoEntregaUI(em)) {
    if (km > 4)
      throw Error(
        "Devido ao horário, não conseguiremos entregar na sua localidade. Você pode pedir para retirar ou comer no local.",
      );
    return km <= 2 ? 10 : km <= 3 ? 12 : 15;
  }
  const limites = [
    [2, 6],
    [3, 7],
    [4, 8],
    [5, 10],
    [6, 11],
    [7, 13],
    [8, 14],
    [9, 15],
    [10, 16],
  ];
  let taxa = limites.find(([limite]) => km <= limite)?.[1] ?? km * 2;
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Cuiaba",
    weekday: "short",
    day: "numeric",
    month: "numeric",
  }).formatToParts(new Date(em));
  const parte = (t) => partes.find((p) => p.type === t)?.value;
  const feriados = [
    "1/1",
    "3/4",
    "8/4",
    "21/4",
    "1/5",
    "4/6",
    "7/9",
    "12/10",
    "2/11",
    "15/11",
    "20/11",
    "25/12",
  ];
  if (
    ["Sat", "Sun"].includes(parte("weekday")) ||
    feriados.includes(parte("day") + "/" + parte("month"))
  )
    taxa++;
  return Math.round((taxa + Number.EPSILON) * 100) / 100;
}
function validarMinimoEntregaUI(km, valorProdutos) {
  if (km > 11 && Math.round(Number(valorProdutos || 0) * 100) < 5000)
    throw Error(
      "Para entregas acima de 11 km, a compra mínima é R$ 50,00 em produtos, após descontos e sem a taxa de entrega. O percurso é longo e pode haver demora.",
    );
}
if (typeof module !== "undefined" && module.exports)
  module.exports = { horarioNoturnoEntregaUI, taxaEntregaRegraUI, validarMinimoEntregaUI };
