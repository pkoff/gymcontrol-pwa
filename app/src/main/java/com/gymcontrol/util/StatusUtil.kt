package com.gymcontrol.util

import com.gymcontrol.data.entities.Aluna
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

/**
 * Replica exatamente a lógica de `calcular_status()` do Flask:
 *
 * - "pago"       → status_pagamento == "pago" e data_pagamento preenchida
 * - "periodo_30" → dentro dos primeiros 30 dias após a matrícula (sem pagamento)
 * - "atrasado"   → data_vencimento já passou e ainda pendente
 * - "pendente"   → pendente normal (dentro do prazo)
 */
object StatusUtil {

    private val fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd")

    enum class Status { PAGO, PERIODO_30, ATRASADO, PENDENTE }

    /**
     * Calcula o status real de uma aluna.
     * @param aluna  entidade Aluna do Room
     * @param hoje   data de referência (padrão: hoje)
     */
    fun calcular(aluna: Aluna, hoje: LocalDate = LocalDate.now()): Status {
        // 1. Pago no mês corrente
        if (aluna.statusPagamento == "pago" && aluna.dataPagamento != null) {
            return Status.PAGO
        }

        // 2. Período gratuito dos 30 dias pós-matrícula
        try {
            val dtMatricula = LocalDate.parse(aluna.dataMatricula, fmt)
            val dias = ChronoUnit.DAYS.between(dtMatricula, hoje)
            if (dias <= 30) return Status.PERIODO_30
        } catch (_: Exception) {}

        // 3. Verifica atraso pelo vencimento
        try {
            val dtVenc = LocalDate.parse(aluna.dataVencimento, fmt)
            if (dtVenc.isBefore(hoje)) return Status.ATRASADO
        } catch (_: Exception) {}

        return Status.PENDENTE
    }

    fun calcularLabel(aluna: Aluna): String = when (calcular(aluna)) {
        Status.PAGO       -> "pago"
        Status.PERIODO_30 -> "periodo_30"
        Status.ATRASADO   -> "atrasado"
        Status.PENDENTE   -> "pendente"
    }

    /**
     * Calcula dias restantes no período de 30 dias.
     */
    fun diasRestantesPeriodo30(aluna: Aluna, hoje: LocalDate = LocalDate.now()): Long {
        return try {
            val dtMatricula = LocalDate.parse(aluna.dataMatricula, fmt)
            val diasPassados = ChronoUnit.DAYS.between(dtMatricula, hoje)
            maxOf(0L, 30L - diasPassados)
        } catch (_: Exception) { 0L }
    }

    /**
     * Calcula dias de atraso.
     */
    fun diasAtraso(aluna: Aluna, hoje: LocalDate = LocalDate.now()): Long {
        return try {
            val dtVenc = LocalDate.parse(aluna.dataVencimento, fmt)
            maxOf(0L, ChronoUnit.DAYS.between(dtVenc, hoje))
        } catch (_: Exception) { 0L }
    }

    /**
     * Formata data "YYYY-MM-DD" para "DD/MM/YYYY" (equivalente a formatar_data do Flask).
     */
    fun formatarData(dataIso: String?): String {
        if (dataIso.isNullOrBlank()) return "—"
        return try {
            val d = LocalDate.parse(dataIso, fmt)
            "${d.dayOfMonth.toString().padStart(2,'0')}/${d.monthValue.toString().padStart(2,'0')}/${d.year}"
        } catch (_: Exception) { dataIso }
    }

    /**
     * Data atual no formato ISO "YYYY-MM-DD".
     */
    fun hoje(): String = LocalDate.now().format(fmt)

    /**
     * Mês atual no formato "YYYY-MM".
     */
    fun mesAtual(): String = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM"))
}
