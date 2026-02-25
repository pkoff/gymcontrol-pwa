package com.gymcontrol.bridge

import android.content.Context
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.google.gson.Gson
import com.gymcontrol.data.entities.Aluna
import com.gymcontrol.repository.GymRepository
import com.gymcontrol.util.BackupManager
import com.gymcontrol.util.StatusUtil
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Ponte JavaScript ↔ Kotlin.
 *
 * Registre no WebView com:
 *   webView.addJavascriptInterface(JsBridge(context, webView, repository, scope), "Android")
 *
 * No HTML/JS, chame:
 *   Android.getDashboard()      → retorna JSON
 *   Android.getAlunas()         → retorna JSON
 *   Android.salvarAluna(json)   → cria/edita aluna
 *   Android.excluirAluna(id)    → exclui aluna
 *   Android.marcarPago(id)      → registra pagamento
 *   Android.marcarPendente(id)  → reverte pagamento
 *   Android.getRelatorio(mes)   → relatório do mês "YYYY-MM"
 *   Android.getMeses()          → lista de meses disponíveis
 *   Android.gerarBackup()       → gera ZIP e retorna caminho
 *
 * Cada método chama de volta:
 *   window.AndroidCallback.onResult(method, jsonResult)
 */
class JsBridge(
    private val context: Context,
    private val webView: WebView,
    private val repository: GymRepository,
    private val scope: CoroutineScope
) {
    private val gson = Gson()

    // ── Helpers ──────────────────────────────────────────────────────────────

    private fun callback(method: String, data: Any?) {
        val json = gson.toJson(data ?: mapOf("ok" to true))
        val js = "window.AndroidCallback.onResult('$method', ${json});"
        scope.launch(Dispatchers.Main) {
            webView.evaluateJavascript(js, null)
        }
    }

    private fun error(method: String, msg: String) {
        val json = gson.toJson(mapOf("error" to msg))
        val js = "window.AndroidCallback.onResult('$method', $json);"
        scope.launch(Dispatchers.Main) {
            webView.evaluateJavascript(js, null)
        }
    }

    // ── Dashboard ─────────────────────────────────────────────────────────────

    @JavascriptInterface
    fun getDashboard() {
        scope.launch(Dispatchers.IO) {
            try {
                val stats = repository.getDashboardStats()
                val map = mapOf(
                    "totalAlunas"   to stats.totalAlunas,
                    "pagasMes"      to stats.pagasMes,
                    "pendentes"     to stats.pendentes,
                    "totalRecebido" to stats.totalRecebido,
                    "totalEsperado" to stats.totalEsperado,
                    "valorAberto"   to stats.valorAberto,
                    "mesLabel"      to stats.mesLabel,
                    "emPeriodo30"   to stats.emPeriodo30.map { alunaComDiasToMap(it, false) },
                    "inadimplentes" to stats.inadimplentes.map { alunaComDiasToMap(it, true) }
                )
                callback("getDashboard", map)
            } catch (e: Exception) {
                error("getDashboard", e.message ?: "Erro desconhecido")
            }
        }
    }

    // ── Alunas ────────────────────────────────────────────────────────────────

    @JavascriptInterface
    fun getAlunas() {
        scope.launch(Dispatchers.IO) {
            try {
                val lista = repository.getAllAlunas().map { alunaToMap(it) }
                callback("getAlunas", lista)
            } catch (e: Exception) {
                error("getAlunas", e.message ?: "Erro")
            }
        }
    }

    @JavascriptInterface
    fun getAluna(id: Long) {
        scope.launch(Dispatchers.IO) {
            try {
                val aluna = repository.getAlunaById(id)
                callback("getAluna", aluna?.let { alunaToMap(it) } ?: mapOf("error" to "Não encontrada"))
            } catch (e: Exception) {
                error("getAluna", e.message ?: "Erro")
            }
        }
    }

    /**
     * Cria ou atualiza uma aluna.
     * JSON esperado:
     * {
     *   "id": 0,  // 0 = nova aluna
     *   "nome": "Maria",
     *   "telefone": "11999999999",
     *   "valorMensalidade": 80.0,
     *   "dataVencimento": "2024-03-15",
     *   "dataMatricula": "2024-02-15"
     * }
     */
    @JavascriptInterface
    fun salvarAluna(json: String) {
        scope.launch(Dispatchers.IO) {
            try {
                @Suppress("UNCHECKED_CAST")
                val map = gson.fromJson(json, Map::class.java) as Map<String, Any>
                val id = (map["id"] as? Double)?.toLong() ?: 0L
                val aluna = Aluna(
                    id = id,
                    nome = map["nome"] as? String ?: "",
                    telefone = map["telefone"] as? String,
                    valorMensalidade = (map["valorMensalidade"] as? Double) ?: 0.0,
                    dataVencimento = map["dataVencimento"] as? String ?: StatusUtil.hoje(),
                    dataMatricula = map["dataMatricula"] as? String ?: StatusUtil.hoje(),
                    statusPagamento = "pendente"
                )
                if (id == 0L) {
                    val newId = repository.insertAluna(aluna)
                    callback("salvarAluna", mapOf("ok" to true, "id" to newId, "acao" to "criada"))
                } else {
                    repository.updateAluna(aluna)
                    callback("salvarAluna", mapOf("ok" to true, "id" to id, "acao" to "editada"))
                }
            } catch (e: Exception) {
                error("salvarAluna", e.message ?: "Erro ao salvar")
            }
        }
    }

    @JavascriptInterface
    fun excluirAluna(id: Long) {
        scope.launch(Dispatchers.IO) {
            try {
                repository.deleteAluna(id)
                callback("excluirAluna", mapOf("ok" to true, "id" to id))
            } catch (e: Exception) {
                error("excluirAluna", e.message ?: "Erro ao excluir")
            }
        }
    }

    @JavascriptInterface
    fun marcarPago(id: Long) {
        scope.launch(Dispatchers.IO) {
            try {
                repository.marcarPago(id)
                callback("marcarPago", mapOf("ok" to true, "id" to id))
            } catch (e: Exception) {
                error("marcarPago", e.message ?: "Erro")
            }
        }
    }

    @JavascriptInterface
    fun marcarPendente(id: Long) {
        scope.launch(Dispatchers.IO) {
            try {
                repository.marcarPendente(id)
                callback("marcarPendente", mapOf("ok" to true, "id" to id))
            } catch (e: Exception) {
                error("marcarPendente", e.message ?: "Erro")
            }
        }
    }

    // ── Relatório ─────────────────────────────────────────────────────────────

    @JavascriptInterface
    fun getMeses() {
        scope.launch(Dispatchers.IO) {
            try {
                val meses = repository.getMesesDisponiveis()
                callback("getMeses", meses)
            } catch (e: Exception) {
                error("getMeses", e.message ?: "Erro")
            }
        }
    }

    @JavascriptInterface
    fun getRelatorio(mes: String) {
        scope.launch(Dispatchers.IO) {
            try {
                val rel = repository.getRelatorioMes(mes)
                val map = mapOf(
                    "mes"             to rel.mes,
                    "mesLabel"        to rel.mesLabel,
                    "totalAlunas"     to rel.totalAlunas,
                    "pagas"           to rel.pagas,
                    "atrasadas"       to rel.atrasadas,
                    "periodo30"       to rel.periodo30,
                    "pendentes"       to rel.pendentes,
                    "valorArrecadado" to rel.valorArrecadado,
                    "alunas"          to rel.alunas.map { acs ->
                        alunaToMap(acs.aluna) + mapOf("statusReal" to acs.statusReal)
                    }
                )
                callback("getRelatorio", map)
            } catch (e: Exception) {
                error("getRelatorio", e.message ?: "Erro")
            }
        }
    }

    // ── Backup ────────────────────────────────────────────────────────────────

    @JavascriptInterface
    fun gerarBackup() {
        scope.launch(Dispatchers.IO) {
            try {
                val caminho = BackupManager.gerarBackup(context, repository)
                if (caminho != null) {
                    callback("gerarBackup", mapOf("ok" to true, "caminho" to caminho))
                } else {
                    error("gerarBackup", "Falha ao gerar backup")
                }
            } catch (e: Exception) {
                error("gerarBackup", e.message ?: "Erro no backup")
            }
        }
    }

    // ── Helpers internos ─────────────────────────────────────────────────────

    private fun alunaToMap(a: Aluna): Map<String, Any?> = mapOf(
        "id"               to a.id,
        "nome"             to a.nome,
        "telefone"         to (a.telefone ?: ""),
        "valorMensalidade" to a.valorMensalidade,
        "dataVencimento"   to a.dataVencimento,
        "dataMatricula"    to a.dataMatricula,
        "statusPagamento"  to a.statusPagamento,
        "dataPagamento"    to (a.dataPagamento ?: ""),
        "statusReal"       to StatusUtil.calcularLabel(a),
        "dataVencimentoFmt" to StatusUtil.formatarData(a.dataVencimento),
        "dataMatriculaFmt"  to StatusUtil.formatarData(a.dataMatricula),
        "dataPagamentoFmt"  to StatusUtil.formatarData(a.dataPagamento)
    )

    private fun alunaComDiasToMap(
        item: GymRepository.AlunaComDias,
        comAtraso: Boolean
    ): Map<String, Any?> {
        val base = alunaToMap(item.aluna).toMutableMap()
        if (comAtraso) base["diasAtraso"] = item.diasAtraso
        else base["diasRestantes"] = item.diasRestantes
        return base
    }
}
