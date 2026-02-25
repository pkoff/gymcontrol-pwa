package com.gymcontrol.repository

import android.content.Context
import com.gymcontrol.data.database.GymDatabase
import com.gymcontrol.data.entities.Aluna
import com.gymcontrol.data.entities.Usuario
import com.gymcontrol.util.PasswordUtil
import com.gymcontrol.util.StatusUtil
import kotlinx.coroutines.flow.Flow
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/**
 * Repositório central — abstrai toda a lógica de acesso ao banco Room.
 * As Activities/ViewModels interagem apenas com esta classe.
 */
class GymRepository(context: Context) {

    private val db = GymDatabase.getInstance(context)
    private val alunaDao = db.alunaDao()
    private val usuarioDao = db.usuarioDao()

    // ─────────────────────────────────────────────────────────────────────────
    // AUTENTICAÇÃO
    // ─────────────────────────────────────────────────────────────────────────

    suspend fun login(username: String, password: String): Boolean {
        val user = usuarioDao.getByUsername(username) ?: return false
        return PasswordUtil.verifyPassword(password, user.passwordHash)
    }

    suspend fun getUsuario(username: String): Usuario? =
        usuarioDao.getByUsername(username)

    // ─────────────────────────────────────────────────────────────────────────
    // ALUNAS — CRUD
    // ─────────────────────────────────────────────────────────────────────────

    fun getAllAlunasFlow(): Flow<List<Aluna>> = alunaDao.getAllFlow()

    suspend fun getAllAlunas(): List<Aluna> = alunaDao.getAll()

    suspend fun getAlunaById(id: Long): Aluna? = alunaDao.getById(id)

    suspend fun insertAluna(aluna: Aluna): Long = alunaDao.insert(aluna)

    suspend fun updateAluna(aluna: Aluna) = alunaDao.update(aluna)

    suspend fun deleteAluna(id: Long) = alunaDao.deleteById(id)

    // ─────────────────────────────────────────────────────────────────────────
    // PAGAMENTOS
    // ─────────────────────────────────────────────────────────────────────────

    suspend fun marcarPago(id: Long) = alunaDao.marcarPago(id, StatusUtil.hoje())

    suspend fun marcarPendente(id: Long) = alunaDao.marcarPendente(id)

    // ─────────────────────────────────────────────────────────────────────────
    // DASHBOARD — ESTATÍSTICAS
    // ─────────────────────────────────────────────────────────────────────────

    data class DashboardStats(
        val totalAlunas: Int,
        val pagasMes: Int,
        val pendentes: Int,
        val totalRecebido: Double,
        val totalEsperado: Double,
        val valorAberto: Double,
        val emPeriodo30: List<AlunaComDias>,
        val inadimplentes: List<AlunaComDias>,
        val mesLabel: String
    )

    data class AlunaComDias(
        val aluna: Aluna,
        val diasRestantes: Long = 0,
        val diasAtraso: Long = 0
    )

    suspend fun getDashboardStats(): DashboardStats {
        val mesAtual = StatusUtil.mesAtual()
        val hoje = LocalDate.now()
        val fmtMes = DateTimeFormatter.ofPattern("MMMM/yyyy", java.util.Locale("pt", "BR"))
        val mesLabel = hoje.format(fmtMes)
            .replaceFirstChar { it.uppercase() }

        val total = alunaDao.countTotal()
        val pagasMes = alunaDao.countPagasNoMes(mesAtual)
        val pendentes = alunaDao.countPendentes()
        val totalRecebido = alunaDao.totalRecebidoNoMes(mesAtual)
        val totalEsperado = alunaDao.totalEsperado()
        val valorAberto = alunaDao.totalAberto()

        val todas = alunaDao.getAll()
        val emPeriodo30 = mutableListOf<AlunaComDias>()
        val inadimplentes = mutableListOf<AlunaComDias>()

        for (a in todas) {
            when (StatusUtil.calcular(a, hoje)) {
                StatusUtil.Status.PERIODO_30 -> emPeriodo30.add(
                    AlunaComDias(a, diasRestantes = StatusUtil.diasRestantesPeriodo30(a, hoje))
                )
                StatusUtil.Status.ATRASADO -> inadimplentes.add(
                    AlunaComDias(a, diasAtraso = StatusUtil.diasAtraso(a, hoje))
                )
                else -> {}
            }
        }

        emPeriodo30.sortBy { it.diasRestantes }
        inadimplentes.sortByDescending { it.diasAtraso }

        return DashboardStats(
            totalAlunas = total,
            pagasMes = pagasMes,
            pendentes = pendentes,
            totalRecebido = totalRecebido,
            totalEsperado = totalEsperado,
            valorAberto = valorAberto,
            emPeriodo30 = emPeriodo30,
            inadimplentes = inadimplentes,
            mesLabel = mesLabel
        )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RELATÓRIO MENSAL
    // ─────────────────────────────────────────────────────────────────────────

    data class RelatorioMes(
        val mes: String,
        val mesLabel: String,
        val alunas: List<AlunaComStatus>,
        val totalAlunas: Int,
        val pagas: Int,
        val atrasadas: Int,
        val periodo30: Int,
        val pendentes: Int,
        val valorArrecadado: Double
    )

    data class AlunaComStatus(
        val aluna: Aluna,
        val statusReal: String
    )

    suspend fun getMesesDisponiveis(): List<String> = alunaDao.getMesesDisponiveis()

    suspend fun getRelatorioMes(anoMes: String): RelatorioMes {
        val rows = alunaDao.getByMesMatricula(anoMes)
        val alunas = rows.map { AlunaComStatus(it, StatusUtil.calcularLabel(it)) }

        val pagas = alunas.count { it.statusReal == "pago" }
        val atrasadas = alunas.count { it.statusReal == "atrasado" }
        val p30 = alunas.count { it.statusReal == "periodo_30" }
        val pend = alunas.count { it.statusReal == "pendente" }
        val valor = rows.filter { it.statusPagamento == "pago" }.sumOf { it.valorMensalidade }

        val mesLabel = try {
            val d = LocalDate.parse("$anoMes-01",
                DateTimeFormatter.ofPattern("yyyy-MM-dd"))
            d.format(DateTimeFormatter.ofPattern("MMMM/yyyy",
                java.util.Locale("pt","BR")))
                .replaceFirstChar { it.uppercase() }
        } catch (_: Exception) { anoMes }

        return RelatorioMes(
            mes = anoMes,
            mesLabel = mesLabel,
            alunas = alunas,
            totalAlunas = alunas.size,
            pagas = pagas,
            atrasadas = atrasadas,
            periodo30 = p30,
            pendentes = pend,
            valorArrecadado = valor
        )
    }
}
