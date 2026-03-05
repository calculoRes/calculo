// ==================== Salário Mínimo Histórico ====================
const SALARIO_MINIMO = {
  2015: 788.00, 2016: 880.00, 2017: 937.00, 2018: 954.00,
  2019: 998.00, 2020: 1045.00, 2021: 1100.00, 2022: 1212.00,
  2023: 1320.00, 2024: 1412.00, 2025: 1518.00, 2026: 1621.00
};

// Gera salários proporcionais por ano com base no salário atual e no histórico do mínimo.
// Ex: se salário atual = 3242 (2× mínimo 2026), em 2023 retorna 2640 (2× mínimo 2023).
function salariosProporcionalPorAno(anoInicio, anoFim, salarioAtual) {
  const anoAtual = new Date().getFullYear();
  const minimoAtual = SALARIO_MINIMO[anoAtual] || SALARIO_MINIMO[anoFim] || salarioAtual;
  const fator = salarioAtual / minimoAtual;
  const resultado = {};
  for (let a = anoInicio; a <= anoFim; a++) {
    const minimoAno = SALARIO_MINIMO[a];
    resultado[a] = minimoAno ? Math.round(fator * minimoAno * 100) / 100 : salarioAtual;
  }
  return resultado;
}

// ==================== Utilidades ====================
const fmt = v => v.toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL"
});
const formatarData = d => d.split("-").reverse().join("/");
const escapeHtml = str => {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
};

// Formata número para exibição monetária no input: 1234.5 -> "1.234,50"
const fmtMoney = v => {
  if (v === "" || v == null) return "";
  const num = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(num)) return "";
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// Extrai número de string monetária: "1.234,50" -> 1234.5
const parseMoney = str => {
  if (!str) return "";
  const clean = str.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(clean);
  return isNaN(num) ? "" : String(num);
};
const parseDate = str => {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const diasNoMes = (ano, mes) => new Date(ano, mes + 1, 0).getDate();

// Cria data clampeando o dia ao último dia do mês (evita overflow do JS)
const dataClamped = (ano, mes, dia) => {
  const maxDia = diasNoMes(ano, mes);
  return new Date(ano, mes, Math.min(dia, maxDia));
};
const diffAnos = (start, end) => {
  let anos = end.getFullYear() - start.getFullYear();
  const aniv = dataClamped(end.getFullYear(), start.getMonth(), start.getDate());
  if (end < aniv) anos--;
  return Math.max(anos, 0);
};

// Estima o FGTS acumulado usando salários por ano × 8% × meses efetivos.
// Itera mês a mês com rateio proporcional nos meses parciais (primeiro e último).
// Inclui FGTS sobre 13º (8% sobre a fração proporcional do salário por ano).
// salariosPorAno: objeto { ano: valor } ou número (salário fixo para todos os anos).
function estimarFGTS(dataContratacao, dataDemissao, salariosPorAno) {
  const inicio = parseDate(dataContratacao);
  const fim = parseDate(dataDemissao);

  // Compatibilidade: aceita número simples (salário fixo para todos os anos)
  const salarioFixo = typeof salariosPorAno === "number" ? salariosPorAno : null;
  const getSalario = ano => salarioFixo != null ? salarioFixo : (salariosPorAno[ano] || 0);

  // Acumulador por ano
  const porAno = {};

  // Iterar mês a mês
  let cursor = new Date(inicio);
  while (cursor <= fim) {
    const ano = cursor.getFullYear();
    const mes = cursor.getMonth();
    const diasNoMesAtual = diasNoMes(ano, mes);
    const salario = getSalario(ano);

    // Calcular dias efetivos neste mês
    const primeiroDia = (ano === inicio.getFullYear() && mes === inicio.getMonth())
      ? inicio.getDate() : 1;
    const ultimoDia = (ano === fim.getFullYear() && mes === fim.getMonth())
      ? fim.getDate() : diasNoMesAtual;
    const diasEfetivos = ultimoDia - primeiroDia + 1;
    const fracao = diasEfetivos / diasNoMesAtual;

    const depositoMes = Math.round(salario * 0.08 * fracao * 100) / 100;

    if (!porAno[ano]) {
      porAno[ano] = { depositosSoma: 0, mesesEfetivos: 0 };
    }
    porAno[ano].depositosSoma += depositoMes;
    porAno[ano].mesesEfetivos += fracao;

    // Avançar para o próximo mês (dia 1)
    cursor = new Date(ano, mes + 1, 1);
  }

  const detalhes = [];
  let total = 0;

  for (const ano of Object.keys(porAno).map(Number).sort()) {
    const info = porAno[ano];
    const salario = getSalario(ano);
    const depositoMensal = Math.round(salario * 0.08 * 100) / 100;
    const depositosSoma = Math.round(info.depositosSoma * 100) / 100;
    // FGTS sobre 13º: 8% de (mesesEfetivos/12 * salário)
    const fgts13 = Math.round(salario * (info.mesesEfetivos / 12) * 0.08 * 100) / 100;
    const subtotal = Math.round((depositosSoma + fgts13) * 100) / 100;
    total += subtotal;

    detalhes.push({
      ano,
      salario,
      meses: Math.round(info.mesesEfetivos * 100) / 100,
      depositoMensal,
      fgts13,
      subtotal,
    });
  }

  total = Math.round(total * 100) / 100;
  return { total, detalhes };
}

// ==================== Tabela INSS 2026 (progressiva) ====================
// Portaria Interministerial MPS/MF nº 13/2026
const FAIXAS_INSS = [{
  teto: 1621.00,
  aliq: 0.075
}, {
  teto: 2902.84,
  aliq: 0.09
}, {
  teto: 4354.27,
  aliq: 0.12
}, {
  teto: 8475.55,
  aliq: 0.14
}];
function calcINSS(base) {
  if (base <= 0) return 0;
  let desconto = 0;
  let anterior = 0;
  for (const faixa of FAIXAS_INSS) {
    if (base <= anterior) break;
    const faixaBase = Math.min(base, faixa.teto) - anterior;
    desconto += faixaBase * faixa.aliq;
    anterior = faixa.teto;
  }
  return desconto;
}

// ==================== Tabela IRRF 2026 (progressiva + redutor) ====================
const FAIXAS_IRRF = [{
  teto: 2428.80,
  aliq: 0,
  deducao: 0
}, {
  teto: 2826.65,
  aliq: 0.075,
  deducao: 182.16
}, {
  teto: 3751.05,
  aliq: 0.15,
  deducao: 394.16
}, {
  teto: 4664.68,
  aliq: 0.225,
  deducao: 675.49
}, {
  teto: Infinity,
  aliq: 0.275,
  deducao: 908.73
}];
function calcIRRF(base) {
  if (base <= 0) return 0;
  let irrf = 0;
  for (const f of FAIXAS_IRRF) {
    if (base <= f.teto) {
      irrf = base * f.aliq - f.deducao;
      break;
    }
  }
  // Redutor 2026: isenção até R$ 5.000, redução parcial até R$ 7.350
  let redutor = 0;
  if (base <= 5000) {
    redutor = irrf; // isento
  } else if (base <= 7350) {
    redutor = Math.max(0, 978.62 - 0.133145 * base);
  }
  return Math.max(0, irrf - redutor);
}

// ==================== Motor de cálculo ====================
function calcularRescisao(dados) {
  const {
    salario,
    dataContratacao,
    dataDemissao,
    tipoRescisao,
    feriasVencidas,
    saldoFGTS,
    avisoPrevioTrabalhado
  } = dados;
  const inicio = parseDate(dataContratacao);
  const fim = parseDate(dataDemissao);
  const salarioDia = salario / 30;

  // [FIX #7] Saldo de salário — cap em 30 dias
  const diasTrabalhados = Math.min(fim.getDate(), 30);
  const saldoSalario = salarioDia * diasTrabalhados;

  // Anos completos de serviço
  const anosServico = diffAnos(inicio, fim);

  // Aviso prévio indenizado (dias)
  let diasAvisoPrevio = 0;
  let avisoPrevioIndenizado = 0;
  // [FIX #3] Desconto aviso prévio para pedido de demissão
  let descontoAvisoPrevio = 0;
  if (!avisoPrevioTrabalhado) {
    if (tipoRescisao === "sem_justa_causa") {
      diasAvisoPrevio = Math.min(30 + anosServico * 3, 90);
      avisoPrevioIndenizado = salarioDia * diasAvisoPrevio;
    } else if (tipoRescisao === "acordo_mutuo") {
      diasAvisoPrevio = Math.min(30 + anosServico * 3, 90);
      avisoPrevioIndenizado = salarioDia * diasAvisoPrevio * 0.5;
    } else if (tipoRescisao === "pedido_demissao") {
      descontoAvisoPrevio = salarioDia * 30;
    }
  }

  // Data de referência para proporcionais (projeta aviso prévio indenizado)
  const dataRef = new Date(fim);
  if (diasAvisoPrevio > 0 && !avisoPrevioTrabalhado) {
    dataRef.setDate(dataRef.getDate() + diasAvisoPrevio);
  }

  // [FIX #1] 13º proporcional — respeita ano de contratação
  let mesesDecimo = 0;
  if (tipoRescisao !== "justa_causa") {
    const anoRef = dataRef.getFullYear();
    const anoInicio = inicio.getFullYear();
    if (anoRef > anoInicio) {
      // Contratado em ano anterior: contar desde janeiro
      mesesDecimo = dataRef.getMonth() + (dataRef.getDate() >= 15 ? 1 : 0);
    } else {
      // Contratado no mesmo ano: contar desde o mês de contratação
      mesesDecimo = dataRef.getMonth() - inicio.getMonth();
      if (dataRef.getDate() >= 15) mesesDecimo++;
      // Verificar se o primeiro mês teve >= 15 dias trabalhados
      const diasNoMesContratacao = diasNoMes(anoInicio, inicio.getMonth());
      const diasTrabPrimeiroMes = diasNoMesContratacao - inicio.getDate() + 1;
      if (diasTrabPrimeiroMes < 15) mesesDecimo--;
    }
    mesesDecimo = Math.max(0, Math.min(12, mesesDecimo));
  }
  const decimoTerceiro = salario / 12 * mesesDecimo;

  // Férias vencidas + 1/3 (devidas em qualquer tipo de rescisão)
  let feriasVencidasValor = 0;
  if (feriasVencidas > 0) {
    feriasVencidasValor = feriasVencidas * (salario + salario / 3);
  }

  // [FIX #2] Férias proporcionais + 1/3 — regra dos 15 dias implementada
  let mesesFeriasProp = 0;
  if (tipoRescisao !== "justa_causa") {
    const diaAniv = inicio.getDate();
    const mesAniv = inicio.getMonth();
    let ultimoAniv = dataClamped(dataRef.getFullYear(), mesAniv, diaAniv);
    if (ultimoAniv > dataRef) {
      ultimoAniv = dataClamped(dataRef.getFullYear() - 1, mesAniv, diaAniv);
    }

    // Contar meses completos desde o último aniversário
    let cursor = new Date(ultimoAniv);
    let m = 0;
    while (true) {
      const proxMes = cursor.getMonth() + 1;
      const proxAno = cursor.getFullYear() + (proxMes > 11 ? 1 : 0);
      const proximo = dataClamped(proxAno, proxMes % 12, diaAniv);
      if (proximo <= dataRef) {
        m++;
        cursor = proximo;
      } else {
        // Período parcial: verificar regra dos 15 dias
        const diffMs = dataRef - cursor;
        const diasParciais = Math.round(diffMs / (1000 * 60 * 60 * 24));
        if (diasParciais >= 15) m++;
        break;
      }
    }
    mesesFeriasProp = Math.min(m, 12);
  }
  const feriasPropBase = salario / 12 * mesesFeriasProp;
  const feriasPropValor = feriasPropBase + feriasPropBase / 3;

  // FGTS sobre verbas rescisórias (8%) — depositado na conta vinculada
  const baseFGTS = saldoSalario + decimoTerceiro + avisoPrevioIndenizado;
  const fgtsVerbas = baseFGTS * 0.08;

  // Multa FGTS
  const totalFGTSAcumulado = (saldoFGTS || 0) + fgtsVerbas;
  // [FIX #5] Percentual correto por tipo
  let percMultaFGTS = 0;
  if (tipoRescisao === "sem_justa_causa") percMultaFGTS = 40;else if (tipoRescisao === "acordo_mutuo") percMultaFGTS = 20;
  const multaFGTS = totalFGTSAcumulado * (percMultaFGTS / 100);

  // [FIX #4] INSS sobre saldo de salário E sobre 13º (separados)
  const inssSalario = calcINSS(saldoSalario);
  const inssDecimo = calcINSS(decimoTerceiro);

  // IRRF sobre saldo de salário e sobre 13º (separados)
  // Férias e aviso prévio indenizado são isentos de IRRF
  const irrfSalario = calcIRRF(saldoSalario - inssSalario);
  const irrfDecimo = calcIRRF(decimoTerceiro - inssDecimo);

  // [FIX #6] Separação: verbas diretas vs. FGTS depositado
  const totalVerbasBrutas = saldoSalario + avisoPrevioIndenizado + decimoTerceiro + feriasVencidasValor + feriasPropValor;
  const totalDescontos = inssSalario + inssDecimo + irrfSalario + irrfDecimo + descontoAvisoPrevio;
  const totalLiquidoDireto = totalVerbasBrutas - totalDescontos;
  const totalFGTSDepositado = fgtsVerbas + multaFGTS;
  const totalGeral = totalLiquidoDireto + totalFGTSDepositado;
  return {
    saldoSalario,
    diasTrabalhados,
    avisoPrevioIndenizado,
    diasAvisoPrevio,
    descontoAvisoPrevio,
    decimoTerceiro,
    mesesDecimo,
    feriasVencidasValor,
    feriasVencidasQtd: feriasVencidas,
    feriasPropValor,
    mesesFeriasProp,
    fgtsVerbas,
    multaFGTS,
    percMultaFGTS,
    inssSalario,
    inssDecimo,
    irrfSalario,
    irrfDecimo,
    totalVerbasBrutas,
    totalDescontos,
    totalLiquidoDireto,
    totalFGTSDepositado,
    totalGeral,
    // Alias para tabela de registros
    totalLiquido: totalLiquidoDireto
  };
}

// ==================== Motor de cálculo PJ ====================
const TIPOS_RESCISAO_PJ = [{
  value: "contratante",
  label: "Contratante encerrou"
}, {
  value: "prestador",
  label: "Prestador encerrou"
}, {
  value: "termino",
  label: "Término do contrato"
}, {
  value: "acordo_mutuo_pj",
  label: "Acordo mútuo"
}];
function calcularRescisaoPJ(dados) {
  const {
    salario,
    dataContratacao,
    dataDemissao,
    tipoRescisaoPJ,
    multaContratualPerc,
    diasAvisoPrevioPJ,
    avisoPrevioCumpridoPJ,
    incluir13PJ,
    incluirFeriasPJ
  } = dados;
  const inicio = parseDate(dataContratacao);
  const fim = parseDate(dataDemissao);
  const valorDia = salario / 30;

  // Saldo de pagamento
  const diasTrabalhados = Math.min(fim.getDate(), 30);
  const saldoPagamento = valorDia * diasTrabalhados;

  // Multa contratual
  const perc = parseFloat(multaContratualPerc) || 0;
  let multaContratualCredito = 0;
  let multaContratualDesconto = 0;
  if (tipoRescisaoPJ === "contratante" && perc > 0) {
    multaContratualCredito = salario * (perc / 100);
  } else if (tipoRescisaoPJ === "prestador" && perc > 0) {
    multaContratualDesconto = salario * (perc / 100);
  }

  // Aviso prévio
  const dias = parseInt(diasAvisoPrevioPJ) || 0;
  let avisoPrevioCredito = 0;
  let avisoPrevioDesconto = 0;
  if (!avisoPrevioCumpridoPJ) {
    if (tipoRescisaoPJ === "contratante") {
      avisoPrevioCredito = valorDia * dias;
    } else if (tipoRescisaoPJ === "prestador") {
      avisoPrevioDesconto = valorDia * dias;
    }
  }

  // 13º proporcional (opcional — previsto em contrato)
  let decimoTerceiro = 0;
  let mesesDecimo = 0;
  if (incluir13PJ) {
    const anoFim = fim.getFullYear();
    const anoInicio = inicio.getFullYear();
    if (anoFim > anoInicio) {
      mesesDecimo = fim.getMonth() + (fim.getDate() >= 15 ? 1 : 0);
    } else {
      mesesDecimo = fim.getMonth() - inicio.getMonth();
      if (fim.getDate() >= 15) mesesDecimo++;
      const diasNoMesContratacao = diasNoMes(anoInicio, inicio.getMonth());
      const diasTrabPrimeiroMes = diasNoMesContratacao - inicio.getDate() + 1;
      if (diasTrabPrimeiroMes < 15) mesesDecimo--;
    }
    mesesDecimo = Math.max(0, Math.min(12, mesesDecimo));
    decimoTerceiro = salario / 12 * mesesDecimo;
  }

  // Férias proporcionais + 1/3 (opcional — previsto em contrato)
  let feriasPropValor = 0;
  let mesesFeriasProp = 0;
  if (incluirFeriasPJ) {
    const diaAniv = inicio.getDate();
    const mesAniv = inicio.getMonth();
    let ultimoAniv = dataClamped(fim.getFullYear(), mesAniv, diaAniv);
    if (ultimoAniv > fim) {
      ultimoAniv = dataClamped(fim.getFullYear() - 1, mesAniv, diaAniv);
    }
    let cursor = new Date(ultimoAniv);
    let m = 0;
    while (true) {
      const proxMes = cursor.getMonth() + 1;
      const proxAno = cursor.getFullYear() + (proxMes > 11 ? 1 : 0);
      const proximo = dataClamped(proxAno, proxMes % 12, diaAniv);
      if (proximo <= fim) {
        m++;
        cursor = proximo;
      } else {
        const diffMs = fim - cursor;
        const diasParciais = Math.round(diffMs / (1000 * 60 * 60 * 24));
        if (diasParciais >= 15) m++;
        break;
      }
    }
    mesesFeriasProp = Math.min(m, 12);
    const feriasPropBase = salario / 12 * mesesFeriasProp;
    feriasPropValor = feriasPropBase + feriasPropBase / 3;
  }
  const totalCreditos = saldoPagamento + multaContratualCredito + avisoPrevioCredito + decimoTerceiro + feriasPropValor;
  const totalDescontos = multaContratualDesconto + avisoPrevioDesconto;
  const totalLiquidoDireto = totalCreditos - totalDescontos;
  return {
    saldoPagamento,
    diasTrabalhados,
    multaContratualCredito,
    multaContratualDesconto,
    multaContratualPerc: perc,
    avisoPrevioCredito,
    avisoPrevioDesconto,
    diasAvisoPrevioPJ: dias,
    decimoTerceiro,
    mesesDecimo,
    feriasPropValor,
    mesesFeriasProp,
    totalCreditos,
    totalDescontos,
    totalLiquidoDireto,
    totalFGTSDepositado: 0,
    totalGeral: totalLiquidoDireto,
    // Aliases for table
    totalLiquido: totalLiquidoDireto
  };
}

// ==================== Constantes e utilitários compartilhados ====================
const TIPOS_RESCISAO = [{
  value: "sem_justa_causa",
  label: "Sem justa causa"
}, {
  value: "justa_causa",
  label: "Por justa causa"
}, {
  value: "pedido_demissao",
  label: "Pedido de demissão"
}, {
  value: "acordo_mutuo",
  label: "Acordo mútuo"
}];
const tipoLabel = dados => {
  const regime = dados.regime || "clt";
  if (regime === "pj") return TIPOS_RESCISAO_PJ.find(t => t.value === dados.tipoRescisaoPJ)?.label || dados.tipoRescisaoPJ;
  return TIPOS_RESCISAO.find(t => t.value === dados.tipoRescisao)?.label || dados.tipoRescisao;
};
