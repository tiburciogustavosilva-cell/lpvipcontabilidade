(() => {
  "use strict";
  const V = window.VIP || {};
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, txt) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  };
  const calmo = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- WhatsApp e links (config.js) ---------- */
  const zap = (txt) =>
    `https://wa.me/${(V.whatsapp || "").replace(/\D/g, "")}?text=${encodeURIComponent(txt)}`;
  const externo = (a, url) => { a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; };
  document.querySelectorAll("[data-wa]").forEach((a) => externo(a, zap(a.dataset.wa)));
  document.querySelectorAll("[data-url]").forEach((a) => {
    if (V[a.dataset.url]) externo(a, V[a.dataset.url]);
  });
  if (!V.whatsapp) console.warn("VIP: preencha o número de WhatsApp em config.js");

  /* ---------- Header ---------- */
  const header = $(".header");
  const sentinela = el("div");
  sentinela.style.cssText = "position:absolute;top:0;height:12px;width:1px;pointer-events:none";
  document.body.prepend(sentinela);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((es) => header.classList.toggle("is-scrolled", !es[0].isIntersecting)).observe(sentinela);
  }

  /* "#topo" aponta para o header fixo, então a rolagem é manual. */
  document.querySelectorAll('a[href="#topo"]').forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    scrollTo({ top: 0, behavior: calmo ? "auto" : "smooth" });
    history.pushState(null, "", "#topo");
  }));

  /* Menu mobile */
  const navToggle = $("#navToggle"), nav = $("#nav");
  const setNav = (abrir) => {
    nav.classList.toggle("is-open", abrir);
    navToggle.setAttribute("aria-expanded", String(abrir));
    navToggle.setAttribute("aria-label", abrir ? "Fechar menu de navegação" : "Abrir menu de navegação");
  };
  navToggle.addEventListener("click", () => setNav(!nav.classList.contains("is-open")));
  nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setNav(false)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("is-open")) { setNav(false); navToggle.focus(); }
  });

  /* ---------- Agenda de obrigações ---------- */
  const DIA = 864e5;
  const pascoa = (y) => { // algoritmo de Meeus/Butcher
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = b >> 2, e = b % 4, f = Math.floor((b + 8) / 25),
      g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = c >> 2, k = c % 4,
      l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), n = h + l - 7 * m + 114;
    return Date.UTC(y, Math.floor(n / 31) - 1, (n % 31) + 1);
  };
  const FIXOS = [[1, 1], [4, 21], [5, 1], [9, 7], [10, 12], [11, 2], [11, 15], [11, 20], [12, 25]];
  const cache = {};
  const feriados = (y) => cache[y] ||= (() => {
    const p = pascoa(y), fixos = FIXOS.map(([m, d]) => Date.UTC(y, m - 1, d));
    return {
      nacionais: new Set([...fixos, p - 2 * DIA]),
      // sem expediente bancário: carnaval, Corpus Christi e 31/12
      bancarios: new Set([...fixos, p - 2 * DIA, p - 48 * DIA, p - 47 * DIA, p + 60 * DIA, Date.UTC(y, 11, 31)])
    };
  })();
  const util = (t) => {
    const d = new Date(t);
    return d.getUTCDay() % 6 !== 0 && !feriados(d.getUTCFullYear()).bancarios.has(t);
  };
  const antecipar = (t) => { while (!util(t)) t -= DIA; return t; };
  // No 5º dia útil dos salários o sábado conta; domingo e feriado, não.
  const quintoUtil = (y, m) => {
    let t = Date.UTC(y, m, 1) - DIA, n = 5;
    while (n) {
      t += DIA;
      if (new Date(t).getUTCDay() !== 0 && !feriados(y).nacionais.has(t)) n--;
    }
    return t;
  };

  function obrigacoes(y, m) {
    const fixo = (d, nome, txt) => {
      const base = Date.UTC(y, m, d), t = antecipar(base);
      return { t, nome, txt, aj: t === base ? "" : `Dia ${d} não é útil: antecipa para o dia ${new Date(t).getUTCDate()}.` };
    };
    const L = [
      { t: quintoUtil(y, m), nome: "Salários", txt: "Pagamento dos funcionários até o 5º dia útil." },
      fixo(20, "FGTS Digital", "Depósito do FGTS dos funcionários."),
      fixo(20, "INSS e IRRF", "DARF da folha e das retenções do mês anterior."),
      fixo(20, "PIS, Cofins e CSLL retidos", "Retenções sobre serviços contratados pelo condomínio."),
      fixo(25, "PIS sobre a folha", "Contribuição do condomínio sobre a folha do mês anterior."),
      { t: antecipar(Date.UTC(y, m + 1, 0)), nome: "DCTFWeb", txt: "Declaração dos débitos federais do mês anterior, no último dia útil." }
    ];
    if (m === 10) L.push(fixo(30, "13º salário", "Prazo final da 1ª parcela."));
    if (m === 11) L.push(fixo(20, "13º salário", "Prazo final da 2ª parcela."));
    return L.sort((a, b) => a.t - b.t);
  }

  const agora = new Date();
  const hoje = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate());
  let salto = 0;

  /* Cartão "Próximo prazo" do hero: primeiro vencimento de hoje em diante */
  if ($("#prazo")) {
    const y = agora.getFullYear(), m = agora.getMonth();
    const o = [...obrigacoes(y, m), ...obrigacoes(y + (m === 11), (m + 1) % 12)].find((x) => x.t >= hoje);
    const d = new Date(o.t), opt = { timeZone: "UTC" };
    $("#prazoDia").textContent = d.getUTCDate();
    $("#prazoMes").textContent = d.toLocaleDateString("pt-BR", { ...opt, month: "short" }).replace(".", "");
    $("#prazoNome").textContent = o.nome;
    const falta = Math.round((o.t - hoje) / DIA);
    $("#prazoRot").textContent = falta === 0 ? "Vence hoje" : `Próximo prazo, em ${falta} dia${falta > 1 ? "s" : ""}`;
    $("#prazo").setAttribute("aria-label", `Próximo prazo: ${o.nome}, ${d.toLocaleDateString("pt-BR", { ...opt, day: "numeric", month: "long" })}. Ver agenda.`);
    $("#prazo").hidden = false;
  }

  function desenhar() {
    const ref = new Date(Date.UTC(agora.getFullYear(), agora.getMonth() + salto, 1));
    const y = ref.getUTCFullYear(), m = ref.getUTCMonth();
    const nome = ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
    $("#mesNome").textContent = nome[0].toUpperCase() + nome.slice(1);
    $("#mesAnt").disabled = salto <= 0;
    $("#mesProx").disabled = salto >= 11;

    const L = obrigacoes(y, m), vence = new Set(L.map((o) => o.t)), celas = {};
    const g = $("#calGrade");
    g.replaceChildren();
    ["D", "S", "T", "Q", "Q", "S", "S"].forEach((d) => g.append(el("b", "", d)));
    for (let i = 0; i < ref.getUTCDay(); i++) g.append(el("div", "dia dia--off"));
    const total = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    for (let d = 1; d <= total; d++) {
      const t = Date.UTC(y, m, d), c = el("div", "dia", d);
      if (vence.has(t)) c.classList.add("dia--v");
      else if (!util(t)) c.classList.add("dia--off");
      if (t === hoje) c.classList.add("dia--hoje");
      celas[t] = c;
      g.append(c);
    }
    while (g.children.length % 7) g.append(el("div", "dia dia--off"));

    const l = $("#calLista");
    l.replaceChildren();
    L.forEach((o) => {
      const li = el("li", o.t < hoje ? "foi" : ""), c = el("div"), p = el("p", "", o.txt);
      li.append(el("b", "", String(new Date(o.t).getUTCDate()).padStart(2, "0")));
      if (o.aj) p.append(" ", el("em", "", o.aj));
      c.append(el("strong", "", o.nome), p);
      li.append(c);
      li.addEventListener("pointerenter", () => celas[o.t].classList.add("dia--foco"));
      li.addEventListener("pointerleave", () => celas[o.t].classList.remove("dia--foco"));
      l.append(li);
    });
  }
  if ($("#calGrade")) {
    $("#mesAnt").addEventListener("click", () => { salto--; desenhar(); });
    $("#mesProx").addEventListener("click", () => { salto++; desenhar(); });
    desenhar();
  }

  /* ---------- Rodapé ---------- */
  if (V.privacidade && $("#privacidade")) $("#privacidade").hidden = false;
  [
    [V.telefone, V.telefone && `tel:+55${V.telefone.replace(/\D/g, "")}`],
    [V.email, V.email && `mailto:${V.email}`],
    [V.instagram && "Instagram @" + V.instagram.replace(/\/+$/, "").split("/").pop(), V.instagram],
    [V.endereco, V.endereco && ($("#endereco") ? "#endereco" : "../index.html#endereco")],
    [V.horario]
  ].filter((x) => x[0]).forEach(([valor, href]) => {
    const li = el("li"), v = el(href ? "a" : "span", "", valor);
    if (href) /^http/.test(href) ? externo(v, href) : (v.href = href);
    li.append(v);
    $("#dados").append(li);
  });
  if (V.endereco && $("#enderecoTxt")) $("#enderecoTxt").textContent = V.endereco;
  $("#legal").textContent = [V.responsavel, V.crc, V.cnpj && `CNPJ ${V.cnpj}`].filter(Boolean).join(" | ");
  $("#anoAtual").textContent = agora.getFullYear();

  /* ---------- Revelação ao rolar ----------
     .reveal só some com a classe "js" (ver <head>). */
  const itens = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    itens.forEach((x) => x.classList.add("is-visible"));
    return;
  }
  const obs = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("is-visible");
    obs.unobserve(e.target);
  }), { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
  itens.forEach((x) => obs.observe(x));
})();
