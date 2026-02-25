// ─────────────────────────────────────────────
// backup.js — Exportação Excel + Backup ZIP
// Substitui openpyxl + zipfile do Python
// ─────────────────────────────────────────────

async function exportarExcel() {
  const todas = await dbGetAll('alunas');
  const hoje = new Date().toISOString().slice(0, 10);

  // Cria workbook
  const wb = XLSX.utils.book_new();

  // ── Aba Resumo Geral (idêntico ao Flask) ──
  const resumoGeral = await calcularResumoGeral();

  const resumoRows = [
    ['GymControl — Relatório Mensal'],
    [`Gerado em: ${formatarData(hoje)}`],
    [],
    ['Mês', 'Total Alunas', 'Pagas', 'Atrasadas', 'Período 30d', 'Valor Arrecadado'],
  ];

  for (const r of resumoGeral) {
    resumoRows.push([
      r.mes_label,
      r.total,
      r.pagas,
      r.atrasadas,
      r.periodo_30,
      r.valor_arrecadado,
    ]);
  }

  const wsResumo = XLSX.utils.aoa_to_sheet(resumoRows);
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Geral');

  // ── Abas por mês (idêntico ao Flask) ──
  const statusMap = {
    pago: 'Pago',
    periodo_30: 'Período 30 dias',
    atrasado: 'Atrasado',
    pendente: 'Pendente',
  };

  const cabecalhos = [
    'Nome', 'Telefone', 'Valor Mensalidade',
    'Data Matrícula', 'Data Vencimento', 'Data Pagamento',
    'Status Pagamento', 'Status Real'
  ];

  for (const r of resumoGeral) {
    const rows = [cabecalhos];
    const alunasMes = r.alunas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    for (const a of alunasMes) {
      const sr = calcularStatus(a);
      rows.push([
        a.nome,
        a.telefone || '',
        a.valor_mensalidade,
        formatarData(a.data_matricula),
        formatarData(a.data_vencimento),
        formatarData(a.data_pagamento),
        a.status_pagamento,
        statusMap[sr] || sr,
      ]);
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const sheetName = mesAbrev(r.mes).slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  // Gera buffer
  const excelBuf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return { buf: excelBuf, nome: `relatorio_mensal_${hoje}.xlsx` };
}

async function exportarJSON() {
  const todas = await dbGetAll('alunas');
  const hoje = new Date().toISOString().slice(0, 10);
  const json = JSON.stringify({ alunas: todas, exportado_em: hoje }, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  return { blob, nome: `backup_gymcontrol_${hoje}.json` };
}

async function gerarBackupZip() {
  const hoje = new Date().toISOString().slice(0, 10);
  const zip = new JSZip();

  // JSON do banco (substitui .db)
  const todas = await dbGetAll('alunas');
  const jsonStr = JSON.stringify({ alunas: todas, exportado_em: hoje }, null, 2);
  zip.file(`backup_academia_${hoje}.json`, jsonStr);

  // Excel
  const { buf, nome: nomeExcel } = await exportarExcel();
  zip.file(nomeExcel, buf);

  const conteudo = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return { blob: conteudo, nome: `gymcontrol_backup_${hoje}.zip` };
}

function baixarArquivo(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function restaurarDeJSON(arquivo) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target.result);
        // Validação: deve ter array alunas
        if (!json.alunas || !Array.isArray(json.alunas)) {
          throw new Error('Arquivo inválido: não contém array "alunas".');
        }
        await dbImportAll(json);
        resolve({ ok: true, total: json.alunas.length });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
    reader.readAsText(arquivo);
  });
}
