// ─────────────────────────────────────────────
// alunas.js — Lógica de alunas + cálculo de status
// IDÊNTICO ao app.py original
// ─────────────────────────────────────────────

// ── calcular_status — LÓGICA IDÊNTICA ao Python ──
function calcularStatus(aluna) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Se está marcada como paga
  if (aluna.status_pagamento === 'pago' && aluna.data_pagamento) {
    return 'pago';
  }

  // Verifica se ainda está no período gratuito dos 30 dias
  if (aluna.data_matricula) {
    try {
      const dtMatricula = parseDate(aluna.data_matricula);
      const diffDias = Math.floor((hoje - dtMatricula) / (1000 * 60 * 60 * 24));
      if (diffDias <= 30) {
        return 'periodo_30';
      }
    } catch (e) { /* ignora */ }
  }

  // Verifica atraso com base na data de vencimento
  if (aluna.data_vencimento) {
    try {
      const dtVenc = parseDate(aluna.data_vencimento);
      if (dtVenc < hoje) {
        return 'atrasado';
      }
    } catch (e) { /* ignora */ }
  }

  return 'pendente';
}

function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function formatarData(str) {
  if (!str) return '—';
  try {
    const [y, m, d] = str.split('-');
    return `${d}/${m}/${y}`;
  } catch { return str; }
}

function formatarMoeda(v) {
  return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
}

function mesLabel(mesStr) {
  if (!mesStr) return '';
  try {
    const [y, m] = mesStr.split('-');
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${meses[parseInt(m, 10) - 1]}/${y}`;
  } catch { return mesStr; }
}

function mesAbrev(mesStr) {
  if (!mesStr) return '';
  try {
    const [y, m] = mesStr.split('-');
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${meses[parseInt(m, 10) - 1]}-${y}`;
  } catch { return mesStr; }
}

function getStrMesMatricula(aluna) {
  if (!aluna.data_matricula) return '';
  return aluna.data_matricula.slice(0, 7); // YYYY-MM
}

function badgeStatus(status) {
  const map = {
    pago: '<span class="badge badge-green">✅ Pago</span>',
    periodo_30: '<span class="badge badge-blue">🕐 Período 30d</span>',
    atrasado: '<span class="badge badge-red">🔴 Atrasado</span>',
    pendente: '<span class="badge badge-orange">⏳ Pendente</span>',
  };
  return map[status] || map.pendente;
}

// ── CRUD alunas ──

async function listarAlunas() {
  const todas = await dbGetAll('alunas');
  return todas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

async function buscarAluna(id) {
  return await dbGet('alunas', id);
}

async function cadastrarAluna(dados) {
  // Validações idênticas ao Flask
  if (!dados.nome || !dados.data_vencimento || !dados.valor_mensalidade) {
    throw new Error('Preencha todos os campos obrigatórios.');
  }
  const valor = parseFloat(String(dados.valor_mensalidade).replace(',', '.'));
  if (isNaN(valor) || valor < 0) throw new Error('Valor de mensalidade inválido.');
  if (!validarData(dados.data_vencimento)) throw new Error('Data de vencimento inválida.');
  if (!validarData(dados.data_matricula)) throw new Error('Data de matrícula inválida.');

  const aluna = {
    nome: dados.nome.trim(),
    telefone: (dados.telefone || '').trim(),
    valor_mensalidade: valor,
    data_vencimento: dados.data_vencimento,
    data_matricula: dados.data_matricula || new Date().toISOString().slice(0, 10),
    status_pagamento: 'pendente',
    data_pagamento: null,
    observacoes: (dados.observacoes || '').trim(),
    frequencia: (dados.frequencia || '').trim(),
  };
  const id = await dbAdd('alunas', aluna);
  return id;
}

async function editarAluna(id, dados) {
  const atual = await dbGet('alunas', id);
  if (!atual) throw new Error('Aluna não encontrada.');

  const valor = parseFloat(String(dados.valor_mensalidade).replace(',', '.'));
  if (isNaN(valor) || valor < 0) throw new Error('Valor de mensalidade inválido.');
  if (!validarData(dados.data_vencimento)) throw new Error('Data de vencimento inválida.');
  if (!validarData(dados.data_matricula)) throw new Error('Data de matrícula inválida.');

  const atualizado = {
    ...atual,
    nome: dados.nome.trim(),
    telefone: (dados.telefone || '').trim(),
    valor_mensalidade: valor,
    data_vencimento: dados.data_vencimento,
    data_matricula: dados.data_matricula || atual.data_matricula,
    observacoes: (dados.observacoes || '').trim(),
    frequencia: (dados.frequencia || '').trim(),
  };
  await dbPut('alunas', atualizado);
}

async function excluirAluna(id) {
  await dbDelete('alunas', id);
}

async function marcarPago(id) {
  const aluna = await dbGet('alunas', id);
  if (!aluna) throw new Error('Aluna não encontrada.');
  aluna.status_pagamento = 'pago';
  aluna.data_pagamento = new Date().toISOString().slice(0, 10);
  await dbPut('alunas', aluna);
}

async function marcarPendente(id) {
  const aluna = await dbGet('alunas', id);
  if (!aluna) throw new Error('Aluna não encontrada.');
  aluna.status_pagamento = 'pendente';
  aluna.data_pagamento = null;
  await dbPut('alunas', aluna);
}

async function atualizarMensalidade(id, novoValor) {
  const aluna = await dbGet('alunas', id);
  if (!aluna) throw new Error('Aluna não encontrada.');
  const valor = parseFloat(String(novoValor).replace(',', '.'));
  if (isNaN(valor) || valor < 0) throw new Error('Valor inválido.');
  aluna.valor_mensalidade = valor;
  await dbPut('alunas', aluna);
}

function validarData(str) {
  if (!str) return false;
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(str)) return false;
  const d = new Date(str + 'T00:00:00');
  return !isNaN(d.getTime());
}

// ── DASHBOARD: calcula todos os stats ──
async function calcularDashboard() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const mesAtual = hoje.toISOString().slice(0, 7); // YYYY-MM

  const todas = await dbGetAll('alunas');
  const totalAlunas = todas.length;

  // pagas_mes: pagas no mês atual
  const pagasMes = todas.filter(a =>
    a.status_pagamento === 'pago' &&
    a.data_pagamento &&
    a.data_pagamento.slice(0, 7) === mesAtual
  ).length;

  // pendentes: status_pagamento == 'pendente' (idêntico ao Flask)
  const pendentes = todas.filter(a => a.status_pagamento === 'pendente').length;

  // total_recebido: soma dos pagos no mês atual
  const totalRecebido = todas
    .filter(a => a.status_pagamento === 'pago' && a.data_pagamento && a.data_pagamento.slice(0, 7) === mesAtual)
    .reduce((s, a) => s + (a.valor_mensalidade || 0), 0);

  // total_esperado: soma de todas as mensalidades
  const totalEsperado = todas.reduce((s, a) => s + (a.valor_mensalidade || 0), 0);

  // valor_aberto: soma das pendentes
  const valorAberto = todas
    .filter(a => a.status_pagamento === 'pendente')
    .reduce((s, a) => s + (a.valor_mensalidade || 0), 0);

  // Listas dinâmicas
  const emPeriodo30 = [];
  const inadimplentes = [];

  for (const a of todas) {
    const statusReal = calcularStatus(a);
    if (statusReal === 'periodo_30') {
      const dtMat = parseDate(a.data_matricula);
      const diasRestantes = 30 - Math.floor((hoje - dtMat) / (1000 * 60 * 60 * 24));
      emPeriodo30.push({ ...a, dias_restantes: diasRestantes });
    } else if (statusReal === 'atrasado') {
      const dtVenc = parseDate(a.data_vencimento);
      const diasAtraso = Math.floor((hoje - dtVenc) / (1000 * 60 * 60 * 24));
      inadimplentes.push({ ...a, dias_atraso: diasAtraso });
    }
  }

  // Ordena por urgência (idêntico ao Flask)
  inadimplentes.sort((a, b) => b.dias_atraso - a.dias_atraso);
  emPeriodo30.sort((a, b) => a.dias_restantes - b.dias_restantes);

  const mesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const mesLabel = `${mesNomes[hoje.getMonth()]}/${hoje.getFullYear()}`;

  return {
    total_alunas: totalAlunas,
    pagas_mes: pagasMes,
    pendentes,
    total_recebido: totalRecebido,
    total_esperado: totalEsperado,
    valor_aberto: valorAberto,
    mes: mesLabel,
    em_periodo_30: emPeriodo30,
    inadimplentes,
  };
}
