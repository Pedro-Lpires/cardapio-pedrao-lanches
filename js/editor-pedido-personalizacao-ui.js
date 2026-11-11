/* Janelas de personalização usam os campos do rascunho sem gravar no banco. */
function abrirPagamentoEditorUI(p, recebido, aoMudar, recebimentoOriginal = null) {
  const corrigindo = recebimentoOriginal !== null;
  const d = janelaEditorUI(corrigindo ? "Corrigir recebimento" : "Forma de pagamento"),
    box = d.querySelector(".editor-corpo-ui");
  const saldo = Math.max(0, calcularEdicaoPedidoUI(p).valorTotal - recebido);
  const diferenca = corrigindo
    ? centavosOperacao(recebimentoOriginal) - centavosOperacao(saldo)
    : 0;
  const cabecalho = corrigindo
    ? `<p>Já recebido <strong>${moedaOperacao(recebimentoOriginal)}</strong></p><p>Valor a distribuir <strong>${moedaOperacao(saldo)}</strong></p>${diferenca > 0 ? `<p class="editor-alerta-ui">${moedaOperacao(diferenca / 100)} ficam separados como valor a devolver. Esta correção não registra estorno.</p>` : ""}`
    : `<p>Falta receber: <strong>${moedaOperacao(saldo)}</strong></p>`;
  if (corrigindo && saldo === 0) {
    box.innerHTML = `${cabecalho}<button type="button">Separar valor a devolver</button>`;
    box.querySelector("button").onclick = () => {
      p.formas = [];
      aoMudar();
      d.close();
    };
    return;
  }
  let modo = p.formas?.length > 1 ? "misto" : "unico";
  const valores = Object.fromEntries((p.formas || []).map((f) => [f.forma, Number(f.valor)]));
  const opcoes = ["Pix", "Dinheiro", "Débito", "Crédito"];
  if (p.pagamento === "Cartão" || p.formas?.some((f) => f.forma === "Cartão"))
    opcoes.push("Cartão");
  const render = () => {
    box.innerHTML = `${cabecalho}<div class="editor-acoes-ui"><button type="button" data-modo="unico">Uma forma</button><button type="button" data-modo="misto">Mais de uma forma</button></div><form>${modo === "unico" ? `<label>Pagamento<select name="forma">${opcoes.map((v) => `<option ${v === p.pagamento ? "selected" : ""}>${v}</option>`).join("")}</select></label>` : `<div class="editor-grade-ui">${opcoes.map((v) => campoEditorUI(v + " (R$)", valores[v] || "", "number", `data-forma="${v}" min="0" step="0.01" placeholder="0,00"`)).join("")}</div>`}<p role="status"></p><footer><button type="submit">${corrigindo ? "Usar divisão" : "Usar pagamento"}</button></footer></form>`;
    box.querySelectorAll("[data-modo]").forEach(
      (b) =>
        (b.onclick = () => {
          box
            .querySelectorAll("[data-forma]")
            .forEach((x) => (valores[x.dataset.forma] = Number(x.value)));
          modo = b.dataset.modo;
          render();
        }),
    );
    box.querySelector("form").onsubmit = (e) => {
      e.preventDefault();
      const formas =
        modo === "misto"
          ? [...box.querySelectorAll("[data-forma]")]
              .map((x) => ({ forma: x.dataset.forma, valor: Number(x.value) }))
              .filter((f) => f.valor > 0)
          : [];
      if (
        modo === "misto" &&
        (formas.length < 2 ||
          centavosOperacao(formas.reduce((n, f) => n + f.valor, 0)) !== centavosOperacao(saldo))
      ) {
        box.querySelector("[role=status]").textContent = corrigindo
          ? `Informe pelo menos duas formas que somem ${moedaOperacao(saldo)}.`
          : "Informe pelo menos duas formas, somando o saldo que falta receber.";
        return;
      }
      p.formas = formas;
      p.modoPagamentoEditor = modo;
      p.pagamento =
        modo === "misto"
          ? formas.map((f) => f.forma).join(" + ")
          : box.querySelector("select").value;
      aoMudar();
      d.close();
    };
  };
  render();
}
function prepararPersonalizacoesEditorUI(box, pai) {
  // Os inputs continuam sendo a fonte do rascunho; +/− alteram esses mesmos campos.
  box.querySelectorAll("[data-extra],[data-molho]").forEach((input) => {
    input.readOnly = true;
    const controles = document.createElement("span");
    controles.className = "editor-contador-ui";
    input.before(controles);
    for (const [texto, delta] of [
      ["−", -1],
      ["+", 1],
    ]) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = texto;
      b.setAttribute(
        "aria-label",
        (delta > 0 ? "Adicionar " : "Retirar ") + (input.dataset.nome || input.dataset.molho),
      );
      b.onclick = () => {
        input.value = String(
          Math.max(0, Math.min(Number(input.max) || 99, Number(input.value) + delta)),
        );
        input.dispatchEvent(new Event("input", { bubbles: true }));
      };
      if (delta < 0) controles.append(b, input);
      else controles.append(b);
    }
  });
  box.querySelectorAll("details").forEach((details) => {
    if (details.hidden) return;
    const resumo = details.querySelector("summary"),
      titulo = resumo.textContent;
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "editor-personalizar-ui";
    const atualizar = () => {
      const qtd = [...details.querySelectorAll("[data-extra],[data-molho]")].reduce(
        (n, x) => n + Number(x.value),
        0,
      );
      botao.textContent = titulo + (qtd ? " (" + qtd + ")" : "");
    };
    details.before(botao);
    details.hidden = true;
    atualizar();
    botao.onclick = () => {
      const child = janelaEditorUI(titulo),
        corpo = child.querySelector(".editor-corpo-ui");
      details.hidden = false;
      details.open = true;
      resumo.hidden = true;
      corpo.append(details);
      if (details.querySelector("[data-gratis]")) prepararMolhosGratisEditorUI(details, child);
      child.addEventListener(
        "close",
        () => {
          botao.after(details);
          details.hidden = true;
          resumo.hidden = false;
          atualizar();
          details.dispatchEvent(new Event("input", { bubbles: true }));
        },
        { once: true },
      );
      pai.addEventListener(
        "close",
        () => {
          if (child.open) child.close();
        },
        { once: true },
      );
    };
  });
}
function prepararComboItemEditorUI(box, pai) {
  const grupos = [...box.querySelectorAll("[data-grupo]")];
  const botoes = grupos.map((g) => g.previousElementSibling);
  botoes.forEach((b) => (b.hidden = true));
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "editor-personalizar-ui";
  botao.textContent = "Acréscimos do combo";
  grupos[0].before(botao);
  botao.onclick = () => {
    const escolha = janelaEditorUI("Personalizar combo"),
      corpo = escolha.querySelector(".editor-corpo-ui");
    corpo.innerHTML =
      '<div class="editor-acoes-ui"><button type="button" data-todos>Todos os lanches</button><button type="button" data-individual>Individual</button></div><div data-lanches></div>';
    corpo.querySelector("[data-todos]").onclick = () => {
      botoes[0].onclick();
      const janela = [...document.querySelectorAll("dialog.editor-pedido-ui")].at(-1);
      janela.querySelector("h2").textContent = "Todos os lanches";
      janela.addEventListener(
        "close",
        () => {
          const primeiro = grupos[0];
          grupos.slice(1).forEach((g) => {
            g.querySelectorAll("[data-extra]").forEach((x) => {
              const origem = [...primeiro.querySelectorAll("[data-extra]")].find(
                (a) => a.dataset.extra === x.dataset.extra,
              );
              x.value = origem?.value || "0";
            });
            const obs = g.observacaoExternaUI || g.querySelector("[data-obs]");
            if (obs)
              obs.value =
                (primeiro.observacaoExternaUI || primeiro.querySelector("[data-obs]"))?.value || "";
          });
          primeiro.dispatchEvent(new Event("input", { bubbles: true }));
        },
        { once: true },
      );
    };
    corpo.querySelector("[data-individual]").onclick = () => {
      const lista = corpo.querySelector("[data-lanches]");
      lista.className = "editor-acoes-ui";
      lista.replaceChildren();
      grupos.forEach((g, n) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = "Lanche " + (n + 1);
        b.onclick = () => botoes[n].onclick();
        lista.append(b);
      });
    };
    pai.addEventListener(
      "close",
      () => {
        if (escolha.open) escolha.close();
      },
      { once: true },
    );
  };
}
function valorMolhosGratisEditorUI(g = {}) {
  if (g.tipo === "semmolho") return "";
  const nomes = ["Maionese", "Ketchup", "Mostarda", "Barbecue"];
  const texto = String(g.texto || "").toLowerCase();
  const escolhidos = nomes.filter(
    (nome) =>
      (g.molhos || []).includes(nome) || g.molho === nome || texto.includes(nome.toLowerCase()),
  );
  return (g.tipo === "doisiguais" || g.tipo === "iguais" || /^2\s/.test(texto)) &&
    escolhidos.length === 1
    ? "2:" + escolhidos[0]
    : escolhidos.join("+");
}
function prepararMolhosGratisEditorUI(details, pai) {
  details.querySelectorAll("[data-gratis] select").forEach((select) => {
    if (select.dataset.preparado) return;
    select.dataset.preparado = "sim";
    select.hidden = true;
    const label = select.closest(".editor-molho-unidade-ui");
    const escolhas = document.createElement("div");
    escolhas.className = "editor-acoes-ui";
    label.append(escolhas);
    const status = document.createElement("small");
    label.append(status);
    const atualizar = () =>
      (status.textContent = select.selectedOptions[0]?.textContent || "Sem molho");
    atualizar();
    for (const [texto, com] of [
      ["Sem molho", false],
      ["Com molho", true],
    ]) {
      const opcao = document.createElement("label");
      opcao.className = "editor-molho-opcao-ui";
      const b = document.createElement("input");
      b.type = "radio";
      b.name = "molho-unidade-" + [...details.querySelectorAll("select")].indexOf(select);
      b.value = com ? "com" : "sem";
      b.checked = com === Boolean(select.value);
      opcao.append(b, texto);
      escolhas.append(opcao);
      b.onclick = () => {
        if (!com) {
          select.value = "";
          atualizar();
          return;
        }
        const child = janelaEditorUI("Como deseja os molhos?"),
          box = child.querySelector(".editor-corpo-ui");
        box.innerHTML =
          '<div class="editor-acoes-ui"><button data-opcao="diferentes" type="button">1 de cada</button><button data-opcao="iguais" type="button">2 iguais</button></div><div data-lista class="editor-molhos-grade-ui"></div>';
        box.querySelectorAll("[data-opcao]").forEach(
          (tipo) =>
            (tipo.onclick = () => {
              const iguais = tipo.dataset.opcao === "iguais",
                lista = box.querySelector("[data-lista]");
              if (!iguais) {
                const nomes = ["Maionese", "Ketchup", "Mostarda", "Barbecue"];
                let escolhidos = select.value.startsWith("2:")
                  ? []
                  : select.value.split("+").filter(Boolean);
                lista.className = "editor-molhos-grade-ui";
                lista.innerHTML = nomes
                  .map(
                    (nome) =>
                      `<label class="editor-molho-opcao-ui"><input type="checkbox" data-nome="${nome}" ${escolhidos.includes(nome) ? "checked" : ""}>${nome}</label>`,
                  )
                  .join("");
                lista.querySelectorAll("input").forEach(
                  (opt) =>
                    (opt.onchange = () => {
                      const nome = opt.dataset.nome;
                      escolhidos = opt.checked
                        ? [...escolhidos.filter((n) => n !== nome), nome]
                        : escolhidos.filter((n) => n !== nome);
                      select.value = nomes.filter((n) => escolhidos.includes(n)).join("+");
                      atualizar();
                    }),
                );
                return;
              }
              lista.innerHTML = [...select.options]
                .filter((o) => o.value && o.value.startsWith("2:") === iguais)
                .map(
                  (o) =>
                    `<label class="editor-molho-opcao-ui"><input type="radio" name="molho-igual" data-valor="${escaparOperacao(o.value)}" ${o.value === select.value ? "checked" : ""}>${escaparOperacao(o.textContent)}</label>`,
                )
                .join("");
              lista.className = "editor-molhos-grade-ui";
              lista.querySelectorAll("input").forEach(
                (opt) =>
                  (opt.onchange = () => {
                    select.value = opt.dataset.valor;
                    atualizar();
                  }),
              );
            }),
        );
        const botoesTipo = [...box.querySelectorAll("[data-opcao]")];
        botoesTipo.forEach((botao) =>
          botao.addEventListener("click", () => {
            botoesTipo.forEach((outro) =>
              outro.setAttribute("aria-pressed", String(outro === botao)),
            );
          }),
        );
        box
          .querySelector(
            `[data-opcao="${select.value.startsWith("2:") ? "iguais" : "diferentes"}"]`,
          )
          .click();
        child.addEventListener(
          "close",
          () => {
            escolhas
              .querySelectorAll("input")
              .forEach(
                (input) => (input.checked = (input.value === "com") === Boolean(select.value)),
              );
            atualizar();
          },
          { once: true },
        );
        pai.addEventListener(
          "close",
          () => {
            if (child.open) child.close();
          },
          { once: true },
        );
      };
    }
  });
}
