// ─────────────────────────────────────────────
// app.js — Roteador principal e controlador UI
// ─────────────────────────────────────────────

let _currentPage = null;
let _editandoId = null;
let _relatorioMesFiltro = null;

// ── Flash messages ──
function flash(msg, tipo = 'success') {
  const container = document.getElementById('flash-container');
  if (!container) return;
  const div = document.createElement('div');
  div.className = `flash flash-${tipo}`;
  div.textContent = msg;
  container.appendChild(div);
  setTimeout(() => {
    div.style.opacity = '0';
    div.style.transform = 'translateY(-10px)';
    setTimeout(() => div.remove(), 400);
  }, 4000);
}

// ── Roteador de páginas ──
function showPage(page, params = {}) {
  if (!isLoggedIn() && page !== 'login') {
    page = 'login';
  }
  if (isLoggedIn() && page === 'login') {
    page = 'dashboard';
  }

  _currentPage = page;

  // Esconde todas as páginas
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');

  // Atualiza nav
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const navLink = document.querySelector(`.nav-link[data-page="${page}"]`);
  if (navLink) navLink.classList.add('active');

  // Mostra/esconde navbar
  const navbar = document.getElementById('navbar');
  if (navbar) navbar.style.display = isLoggedIn() ? 'flex' : 'none';

  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) {
    pageEl.style.display = 'block';
    renderPage(page, params);
  }
}

async function renderPage(page, params = {}) {
  try {
    switch (page) {
      case 'login':
        renderLogin();
        break;
      case 'dashboard':
        await renderDashboard();
        break;
      case 'alunas':
        await renderAlunas();
        break;
      case 'nova-aluna':
        _editandoId = params.id || null;
        await renderFormAluna(params.id);
        break;
      case 'relatorio':
        await renderRelatorio(_relatorioMesFiltro);
        break;
      case 'restaurar':
        renderRestaurar();
        break;
    }
  } catch (err) {
    flash('Erro: ' + err.message, 'danger');
    console.error(err);
  }
}

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────
function renderLogin() {
  // Página já está no HTML
}

document.addEventListener('DOMContentLoaded', async () => {
  await openDB();

  // Registra Service Worker
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/service-worker.js');
    } catch (e) {
      console.log('SW não registrado:', e);
    }
  }

  // Inicia na página correta
  showPage(isLoggedIn() ? 'dashboard' : 'login');
});

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────
async function renderDashboard() {
  const stats = await calcularDashboard();
  const c = document.getElementById('dashboard-content');
  if (!c) return;

  const pct = stats.total_esperado > 0
    ? ((stats.total_recebido / stats.total_esperado) * 100).toFixed(1)
    : 0;

  const barraProgresso = stats.total_esperado > 0 ? `
    <div class="card progress-section">
      <h3>Progresso de Arrecadação — ${stats.mes}</h3>
      <div class="progress-bar-container">
        <div class="progress-bar" style="width: ${pct}%"></div>
      </div>
      <p class="progress-label">${pct}% arrecadado (${formatarMoeda(stats.total_recebido)} de ${formatarMoeda(stats.total_esperado)})</p>
    </div>` : '';

  const periodo30HTML = stats.em_periodo_30.length > 0 ? `
    <div class="card alert-card alert-card-blue">
      <h3>🕐 Dentro do Período de 30 dias (${stats.em_periodo_30.length})</h3>
      <p class="card-desc">Alunas que ainda estão no período inicial e não precisam pagar ainda.</p>
      <div class="table-responsive">
        <table class="table">
          <thead><tr><th>Nome</th><th>Telefone</th><th>Data Matrícula</th><th>Valor</th><th>Dias Restantes</th></tr></thead>
          <tbody>
            ${stats.em_periodo_30.map(a => `
              <tr>
                <td><strong>${esc(a.nome)}</strong></td>
                <td>${esc(a.telefone || '—')}</td>
                <td>${formatarData(a.data_matricula)}</td>
                <td>${formatarMoeda(a.valor_mensalidade)}</td>
                <td><span class="badge badge-blue">${a.dias_restantes} dias</span></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>` : '';

  const inadimpHTML = stats.inadimplentes.length > 0 ? `
    <div class="card alert-card alert-card-red">
      <h3>🔴 Alunas Inadimplentes (${stats.inadimplentes.length})</h3>
      <p class="card-desc">Alunas com pagamento em atraso. Requer atenção imediata.</p>
      <div class="table-responsive">
        <table class="table">
          <thead><tr><th>Nome</th><th>Telefone</th><th>Vencimento</th><th>Valor</th><th>Dias em Atraso</th><th>Ação</th></tr></thead>
          <tbody>
            ${stats.inadimplentes.map(a => `
              <tr>
                <td><strong>${esc(a.nome)}</strong></td>
                <td>${esc(a.telefone || '—')}</td>
                <td>${formatarData(a.data_vencimento)}</td>
                <td>${formatarMoeda(a.valor_mensalidade)}</td>
                <td><span class="badge badge-red">${a.dias_atraso} dias</span></td>
                <td><button class="btn btn-sm btn-green" onclick="acaoMarcarPago(${a.id})">💰 Registrar Pago</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>` : '';

  const tudoEmDia = stats.inadimplentes.length === 0 && stats.em_periodo_30.length === 0 ? `
    <div class="card alert-card alert-card-green">
      <h3>✅ Tudo em dia!</h3>
      <p class="card-desc">Nenhuma aluna inadimplente e nenhuma no período inicial no momento.</p>
    </div>` : '';

  c.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Dashboard</h1>
        <p class="page-subtitle">Resumo de ${stats.mes}</p>
      </div>
      <button class="btn btn-primary" onclick="showPage('nova-aluna')">➕ Nova Aluna</button>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">👩‍🎓</div>
        <div class="stat-info">
          <span class="stat-value">${stats.total_alunas}</span>
          <span class="stat-label">Total de Alunas</span>
        </div>
      </div>
      <div class="stat-card stat-green">
        <div class="stat-icon">✅</div>
        <div class="stat-info">
          <span class="stat-value">${stats.pagas_mes}</span>
          <span class="stat-label">Pagaram este mês</span>
        </div>
      </div>
      <div class="stat-card stat-red">
        <div class="stat-icon">⏳</div>
        <div class="stat-info">
          <span class="stat-value">${stats.pendentes}</span>
          <span class="stat-label">Pendentes</span>
        </div>
      </div>
      <div class="stat-card stat-blue">
        <div class="stat-icon">💰</div>
        <div class="stat-info">
          <span class="stat-value">${formatarMoeda(stats.total_recebido)}</span>
          <span class="stat-label">Recebido no mês</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📋</div>
        <div class="stat-info">
          <span class="stat-value">${formatarMoeda(stats.total_esperado)}</span>
          <span class="stat-label">Total esperado</span>
        </div>
      </div>
      <div class="stat-card stat-orange">
        <div class="stat-icon">🔴</div>
        <div class="stat-info">
          <span class="stat-value">${formatarMoeda(stats.valor_aberto)}</span>
          <span class="stat-label">Em aberto</span>
        </div>
      </div>
    </div>

    ${barraProgresso}
    ${periodo30HTML}
    ${inadimpHTML}
    ${tudoEmDia}

    <div class="quick-actions card">
      <h3>Ações Rápidas</h3>
      <div class="quick-links">
        <button class="quick-link" onclick="showPage('alunas')"><span>👩</span> Ver todas as alunas</button>
        <button class="quick-link" onclick="showPage('nova-aluna')"><span>➕</span> Cadastrar nova aluna</button>
        <button class="quick-link" onclick="showPage('relatorio')"><span>📅</span> Relatório mensal</button>
        <button class="quick-link" onclick="acaoBackupZip()"><span>💾</span> Baixar backup ZIP</button>
        <button class="quick-link" onclick="showPage('restaurar')"><span>🔄</span> Restaurar banco</button>
      </div>
    </div>
  `;

  // atualiza subtítulo do dashboard
  document.getElementById('dashboard-subtitle').textContent = `Resumo de ${stats.mes}`;
}

// ─────────────────────────────────────────────
// ALUNAS
// ─────────────────────────────────────────────
async function renderAlunas() {
  const lista = await listarAlunas();
  const c = document.getElementById('alunas-content');
  if (!c) return;

  document.getElementById('alunas-count').textContent = `${lista.length} aluna(s) no sistema`;

  if (lista.length === 0) {
    c.innerHTML = `
      <div class="empty-state card">
        <div class="empty-icon">👩‍🎓</div>
        <h3>Nenhuma aluna cadastrada ainda</h3>
        <p>Comece cadastrando sua primeira aluna!</p>
        <button class="btn btn-primary" onclick="showPage('nova-aluna')">➕ Cadastrar Aluna</button>
      </div>`;
    return;
  }

  const linhas = lista.map(a => {
    const sr = calcularStatus(a);
    return `
      <tr data-search="${esc((a.nome + ' ' + (a.telefone || '')).toLowerCase())}">
        <td><strong>${esc(a.nome)}</strong></td>
        <td>${esc(a.telefone || '—')}</td>
        <td>${formatarData(a.data_matricula)}</td>
        <td>${formatarData(a.data_vencimento)}</td>
        <td>${formatarMoeda(a.valor_mensalidade)}</td>
        <td>${badgeStatus(sr)}</td>
        <td>${formatarData(a.data_pagamento)}</td>
        <td class="actions">
          ${a.status_pagamento === 'pendente'
            ? `<button class="btn btn-sm btn-green" onclick="acaoMarcarPago(${a.id})">💰 Pago</button>`
            : `<button class="btn btn-sm btn-orange" onclick="acaoMarcarPendente(${a.id})">↩ Reverter</button>`}
          <button class="btn btn-sm btn-blue" onclick="showPage('nova-aluna', {id: ${a.id}})">✏️ Editar</button>
          <button class="btn btn-sm btn-red" onclick="acaoExcluir(${a.id}, '${esc(a.nome)}')">🗑 Excluir</button>
        </td>
      </tr>`;
  }).join('');

  c.innerHTML = `
    <div class="card table-card">
      <div class="search-bar">
        <input type="text" id="searchInput" placeholder="🔍 Buscar aluna..." oninput="filtrarTabelaAlunas()">
      </div>
      <div class="table-responsive">
        <table class="table" id="tabelaAlunas">
          <thead>
            <tr>
              <th>Nome</th><th>Telefone</th><th>Matrícula</th>
              <th>Vencimento</th><th>Valor</th><th>Status</th>
              <th>Pago em</th><th>Ações</th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>
    </div>`;
}

function filtrarTabelaAlunas() {
  const q = document.getElementById('searchInput')?.value.toLowerCase() || '';
  document.querySelectorAll('#tabelaAlunas tbody tr').forEach(tr => {
    tr.style.display = tr.dataset.search.includes(q) ? '' : 'none';
  });
}

function filtrarTabelaRelatorio() {
  const q = document.getElementById('searchRelatorio')?.value.toLowerCase() || '';
  document.querySelectorAll('#tabelaRelatorio tbody tr').forEach(tr => {
    tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

// ─────────────────────────────────────────────
// FORM NOVA/EDITAR ALUNA
// ─────────────────────────────────────────────
async function renderFormAluna(id) {
  const c = document.getElementById('form-aluna-content');
  if (!c) return;

  const hoje = new Date().toISOString().slice(0, 10);
  let aluna = null;
  let editando = false;

  if (id) {
    aluna = await buscarAluna(id);
    editando = !!aluna;
  }

  document.getElementById('form-aluna-title').textContent = editando ? 'Editar Aluna' : 'Nova Aluna';
  document.getElementById('form-aluna-subtitle').textContent = editando ? 'Altere os dados abaixo' : 'Preencha os dados da nova aluna';

  c.innerHTML = `
    <div class="card form-card">
      <form id="formAluna" onsubmit="submitFormAluna(event)">
        <div class="form-grid">
          <div class="form-group">
            <label for="f-nome">Nome completo *</label>
            <input type="text" id="f-nome" name="nome" value="${esc(aluna?.nome || '')}" placeholder="Ex: Maria Silva" required>
          </div>
          <div class="form-group">
            <label for="f-telefone">Telefone</label>
            <input type="tel" id="f-telefone" name="telefone" value="${esc(aluna?.telefone || '')}" placeholder="(00) 00000-0000">
          </div>
          <div class="form-group">
            <label for="f-valor">Valor da Mensalidade (R$) *</label>
            <input type="number" id="f-valor" name="valor_mensalidade" step="0.01" min="0"
              value="${aluna ? Number(aluna.valor_mensalidade).toFixed(2) : ''}" placeholder="0.00" required>
          </div>
          <div class="form-group">
            <label for="f-frequencia">Frequência</label>
            <input type="text" id="f-frequencia" name="frequencia" value="${esc(aluna?.frequencia || '')}" placeholder="Ex: 3x por semana">
          </div>
          <div class="form-group">
            <label for="f-matricula">Data de Matrícula *</label>
            <input type="date" id="f-matricula" name="data_matricula"
              value="${aluna?.data_matricula || hoje}" required>
          </div>
          <div class="form-group">
            <label for="f-vencimento">Data de Vencimento *</label>
            <input type="date" id="f-vencimento" name="data_vencimento"
              value="${aluna?.data_vencimento || ''}" required>
          </div>
          <div class="form-group" style="grid-column: 1 / -1;">
            <label for="f-obs">Observações</label>
            <textarea id="f-obs" name="observacoes" rows="3" style="padding:.65rem .9rem;border-radius:8px;border:1px solid var(--border);background:var(--bg);font-size:.9rem;outline:none;width:100%;font-family:inherit;resize:vertical;" placeholder="Observações opcionais...">${esc(aluna?.observacoes || '')}</textarea>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" onclick="showPage('alunas')">Cancelar</button>
          <button type="submit" class="btn btn-primary">
            ${editando ? '💾 Salvar Alterações' : '✅ Cadastrar Aluna'}
          </button>
        </div>
      </form>
    </div>`;
}

async function submitFormAluna(e) {
  e.preventDefault();
  const form = e.target;
  const dados = {
    nome: form.nome.value,
    telefone: form.telefone.value,
    valor_mensalidade: form.valor_mensalidade.value,
    data_matricula: form.data_matricula.value,
    data_vencimento: form.data_vencimento.value,
    frequencia: form.frequencia.value,
    observacoes: form.observacoes.value,
  };

  try {
    if (_editandoId) {
      await editarAluna(_editandoId, dados);
      flash(`Aluna ${dados.nome} atualizada! ✅`, 'success');
    } else {
      await cadastrarAluna(dados);
      flash(`Aluna ${dados.nome} cadastrada com sucesso! ✅`, 'success');
    }
    _editandoId = null;
    showPage('alunas');
  } catch (err) {
    flash(err.message, 'danger');
  }
}

// ─────────────────────────────────────────────
// AÇÕES
// ─────────────────────────────────────────────
async function acaoMarcarPago(id) {
  try {
    await marcarPago(id);
    flash('Pagamento registrado! 💰', 'success');
    renderPage(_currentPage);
  } catch (err) { flash(err.message, 'danger'); }
}

async function acaoMarcarPendente(id) {
  try {
    await marcarPendente(id);
    flash('Status revertido para pendente.', 'warning');
    renderAlunas();
  } catch (err) { flash(err.message, 'danger'); }
}

async function acaoExcluir(id, nome) {
  if (!confirm(`⚠️ Tem certeza que deseja excluir a aluna "${nome}"?\n\nEsta ação não pode ser desfeita.`)) return;
  try {
    await excluirAluna(id);
    flash(`Aluna ${nome} excluída.`, 'info');
    renderAlunas();
  } catch (err) { flash(err.message, 'danger'); }
}

// ─────────────────────────────────────────────
// RELATÓRIO
// ─────────────────────────────────────────────
async function renderRelatorio(mesFiltro) {
  const dados = await calcularRelatorio(mesFiltro);
  _relatorioMesFiltro = dados.mes_filtro;

  const c = document.getElementById('relatorio-content');
  if (!c) return;

  const opcoesMeses = dados.meses.map(m =>
    `<option value="${m}" ${m === dados.mes_filtro ? 'selected' : ''}>${m} — ${mesLabel(m)}</option>`
  ).join('');

  let tabelaHTML = '';
  let statsHTML = '';

  if (dados.mes_filtro && dados.alunas.length > 0) {
    const r = dados.resumo;
    statsHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">👩‍🎓</div>
          <div class="stat-info">
            <span class="stat-value">${r.total}</span>
            <span class="stat-label">Matrículas em ${dados.mes_label}</span>
          </div>
        </div>
        <div class="stat-card stat-green">
          <div class="stat-icon">✅</div>
          <div class="stat-info"><span class="stat-value">${r.pagas}</span><span class="stat-label">Pagas</span></div>
        </div>
        <div class="stat-card stat-red">
          <div class="stat-icon">🔴</div>
          <div class="stat-info"><span class="stat-value">${r.atrasadas}</span><span class="stat-label">Atrasadas</span></div>
        </div>
        <div class="stat-card stat-blue">
          <div class="stat-icon">🕐</div>
          <div class="stat-info"><span class="stat-value">${r.periodo_30}</span><span class="stat-label">Período 30 dias</span></div>
        </div>
        <div class="stat-card stat-orange">
          <div class="stat-icon">⏳</div>
          <div class="stat-info"><span class="stat-value">${r.pendentes}</span><span class="stat-label">Pendentes</span></div>
        </div>
        <div class="stat-card stat-green">
          <div class="stat-icon">💰</div>
          <div class="stat-info">
            <span class="stat-value">${formatarMoeda(r.valor_arrecadado)}</span>
            <span class="stat-label">Arrecadado</span>
          </div>
        </div>
      </div>`;

    const linhas = dados.alunas.map(a => `
      <tr>
        <td><strong>${esc(a.nome)}</strong></td>
        <td>${esc(a.telefone || '—')}</td>
        <td>${formatarMoeda(a.valor_mensalidade)}</td>
        <td>${formatarData(a.data_matricula)}</td>
        <td>${formatarData(a.data_vencimento)}</td>
        <td>${formatarData(a.data_pagamento)}</td>
        <td>${badgeStatus(a.status_real)}</td>
      </tr>`).join('');

    tabelaHTML = `
      <div class="card table-card">
        <div class="search-bar" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem;">
          <input type="text" id="searchRelatorio" placeholder="🔍 Buscar aluna..." oninput="filtrarTabelaRelatorio()">
          <span class="page-subtitle">${dados.mes_label}</span>
        </div>
        <div class="table-responsive">
          <table class="table" id="tabelaRelatorio">
            <thead>
              <tr><th>Nome</th><th>Telefone</th><th>Valor</th><th>Data Matrícula</th><th>Data Vencimento</th><th>Dia Pagamento</th><th>Status</th></tr>
            </thead>
            <tbody>${linhas}</tbody>
          </table>
        </div>
      </div>`;
  } else if (dados.mes_filtro && dados.alunas.length === 0) {
    tabelaHTML = `
      <div class="empty-state card">
        <div class="empty-icon">📭</div>
        <h3>Nenhuma aluna matriculada em ${dados.mes_label}</h3>
        <p>Selecione outro mês ou cadastre novas alunas.</p>
      </div>`;
  } else if (dados.meses.length === 0) {
    tabelaHTML = `
      <div class="empty-state card">
        <div class="empty-icon">📋</div>
        <h3>Nenhum dado registrado ainda</h3>
        <p>Cadastre alunas para visualizar o relatório mensal.</p>
        <button class="btn btn-primary" onclick="showPage('nova-aluna')">➕ Cadastrar Aluna</button>
      </div>`;
  }

  c.innerHTML = `
    <div class="card">
      <h3>Filtrar por Mês</h3>
      <div class="filtro-form">
        <div class="filtro-row">
          <select class="select-input" onchange="mudarMesRelatorio(this.value)">
            <option value="">— Selecione um mês —</option>
            ${opcoesMeses}
          </select>
        </div>
      </div>
    </div>
    ${statsHTML}
    ${tabelaHTML}`;
}

function mudarMesRelatorio(mes) {
  _relatorioMesFiltro = mes;
  renderRelatorio(mes);
}

// ─────────────────────────────────────────────
// RESTAURAR
// ─────────────────────────────────────────────
function renderRestaurar() {
  // Já está no HTML estático
}

// ─────────────────────────────────────────────
// BACKUP / EXPORTAÇÃO
// ─────────────────────────────────────────────
async function acaoBackupZip() {
  try {
    flash('Gerando backup ZIP...', 'info');
    const { blob, nome } = await gerarBackupZip();
    baixarArquivo(blob, nome);
    flash('Backup gerado com sucesso! 💾', 'success');
  } catch (err) {
    flash('Erro ao gerar backup: ' + err.message, 'danger');
  }
}

async function acaoExportarExcel() {
  try {
    flash('Gerando Excel...', 'info');
    const { buf, nome } = await exportarExcel();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    baixarArquivo(blob, nome);
    flash('Excel exportado com sucesso!', 'success');
  } catch (err) {
    flash('Erro ao exportar Excel: ' + err.message, 'danger');
  }
}

async function acaoExportarJSON() {
  try {
    const { blob, nome } = await exportarJSON();
    baixarArquivo(blob, nome);
    flash('JSON exportado com sucesso!', 'success');
  } catch (err) {
    flash('Erro: ' + err.message, 'danger');
  }
}

async function acaoRestaurarJSON(input) {
  const arquivo = input.files[0];
  if (!arquivo) return;

  // Mostra preview
  const preview = document.getElementById('file-preview');
  if (preview) {
    preview.style.display = 'block';
    preview.textContent = `📂 ${arquivo.name}`;
  }
}

async function submitRestaurar(e) {
  e.preventDefault();
  const input = document.getElementById('arquivo-restaurar');
  if (!input || !input.files[0]) {
    flash('Nenhum arquivo selecionado.', 'danger');
    return;
  }

  if (!confirm('⚠️ Isso substituirá TODOS os dados atuais. Deseja continuar?')) return;

  try {
    const { ok, total } = await restaurarDeJSON(input.files[0]);
    flash(`✅ Banco restaurado com sucesso! ${total} alunas importadas.`, 'success');
    showPage('dashboard');
  } catch (err) {
    flash('Erro ao restaurar: ' + err.message, 'danger');
  }
}

// ─────────────────────────────────────────────
// LOGIN / LOGOUT
// ─────────────────────────────────────────────
async function submitLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;

  const result = await doLogin(username, password);
  if (result.ok) {
    flash('Login realizado com sucesso! 👋', 'success');
    showPage('dashboard');
  } else {
    flash(result.error, 'danger');
  }
}

function doLogout() {
  clearSession();
  flash('Você saiu do sistema.', 'info');
  showPage('login');
}

// ─────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
