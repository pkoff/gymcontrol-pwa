// ─────────────────────────────────────────────
// relatorios.js — Relatórios mensais
// LÓGICA IDÊNTICA ao app.py original
// ─────────────────────────────────────────────

async function calcularRelatorio(mesFiltro) {
  const todas = await dbGetAll('alunas');

  // Todos os meses com matrículas (como no Flask: strftime('%Y-%m', data_matricula))
  const mesesSet = new Set();
  for (const a of todas) {
    if (a.data_matricula) {
      mesesSet.add(a.data_matricula.slice(0, 7));
    }
  }
  // Ordenados DESC (mais recente primeiro)
  const mesesDisponiveis = Array.from(mesesSet).sort((a, b) => b.localeCompare(a));

  if (!mesFiltro && mesesDisponiveis.length > 0) {
    mesFiltro = mesesDisponiveis[0];
  }

  let alunasMes = [];
  let resumo = {
    total: 0,
    pagas: 0,
    atrasadas: 0,
    periodo_30: 0,
    pendentes: 0,
    valor_arrecadado: 0,
  };

  if (mesFiltro) {
    // Filtra alunas do mês — idêntico ao WHERE strftime('%Y-%m', data_matricula) = ?
    const rows = todas
      .filter(a => a.data_matricula && a.data_matricula.slice(0, 7) === mesFiltro)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    for (const a of rows) {
      const sr = calcularStatus(a);
      alunasMes.push({ ...a, status_real: sr });
      resumo.total++;
      if (sr === 'pago') {
        resumo.pagas++;
        resumo.valor_arrecadado += (a.valor_mensalidade || 0);
      } else if (sr === 'atrasado') {
        resumo.atrasadas++;
      } else if (sr === 'periodo_30') {
        resumo.periodo_30++;
      } else {
        resumo.pendentes++;
      }
    }
  }

  return {
    meses: mesesDisponiveis,
    mes_filtro: mesFiltro,
    mes_label: mesFiltro ? mesLabel(mesFiltro) : '',
    alunas: alunasMes,
    resumo,
  };
}

// ── Resumo geral por todos os meses (para Excel) ──
async function calcularResumoGeral() {
  const todas = await dbGetAll('alunas');

  const mesesSet = new Set();
  for (const a of todas) {
    if (a.data_matricula) mesesSet.add(a.data_matricula.slice(0, 7));
  }
  const mesesDisponiveis = Array.from(mesesSet).sort();

  const resultado = [];
  for (const mes of mesesDisponiveis) {
    const alunasMes = todas.filter(a => a.data_matricula && a.data_matricula.slice(0, 7) === mes);
    const total = alunasMes.length;
    const pagas = alunasMes.filter(a => a.status_pagamento === 'pago').length;
    const atrasadas = alunasMes.filter(a => calcularStatus(a) === 'atrasado').length;
    const p30 = alunasMes.filter(a => calcularStatus(a) === 'periodo_30').length;
    const valor = alunasMes
      .filter(a => a.status_pagamento === 'pago')
      .reduce((s, a) => s + (a.valor_mensalidade || 0), 0);

    resultado.push({
      mes,
      mes_label: mesLabel(mes),
      mes_abrev: mesAbrev(mes),
      total,
      pagas,
      atrasadas,
      periodo_30: p30,
      pendentes: total - pagas - atrasadas - p30,
      valor_arrecadado: valor,
      alunas: alunasMes,
    });
  }

  return resultado;
}
