package com.gymcontrol.data.dao

import androidx.room.*
import com.gymcontrol.data.entities.Aluna
import kotlinx.coroutines.flow.Flow

@Dao
interface AlunaDao {

    // ─── Consultas básicas ───────────────────────────────────────────────────

    @Query("SELECT * FROM alunas ORDER BY nome ASC")
    fun getAllFlow(): Flow<List<Aluna>>

    @Query("SELECT * FROM alunas ORDER BY nome ASC")
    suspend fun getAll(): List<Aluna>

    @Query("SELECT * FROM alunas WHERE id = :id")
    suspend fun getById(id: Long): Aluna?

    // ─── CRUD ────────────────────────────────────────────────────────────────

    @Insert
    suspend fun insert(aluna: Aluna): Long

    @Update
    suspend fun update(aluna: Aluna)

    @Delete
    suspend fun delete(aluna: Aluna)

    @Query("DELETE FROM alunas WHERE id = :id")
    suspend fun deleteById(id: Long)

    // ─── Pagamentos ──────────────────────────────────────────────────────────

    @Query("""
        UPDATE alunas
        SET status_pagamento = 'pago', data_pagamento = :dataHoje
        WHERE id = :id
    """)
    suspend fun marcarPago(id: Long, dataHoje: String)

    @Query("""
        UPDATE alunas
        SET status_pagamento = 'pendente', data_pagamento = NULL
        WHERE id = :id
    """)
    suspend fun marcarPendente(id: Long)

    // ─── Dashboard / Estatísticas ────────────────────────────────────────────

    @Query("SELECT COUNT(*) FROM alunas")
    suspend fun countTotal(): Int

    @Query("""
        SELECT COUNT(*) FROM alunas
        WHERE status_pagamento = 'pago'
          AND substr(data_pagamento, 1, 7) = :anoMes
    """)
    suspend fun countPagasNoMes(anoMes: String): Int

    @Query("SELECT COUNT(*) FROM alunas WHERE status_pagamento = 'pendente'")
    suspend fun countPendentes(): Int

    @Query("""
        SELECT COALESCE(SUM(valor_mensalidade), 0) FROM alunas
        WHERE status_pagamento = 'pago'
          AND substr(data_pagamento, 1, 7) = :anoMes
    """)
    suspend fun totalRecebidoNoMes(anoMes: String): Double

    @Query("SELECT COALESCE(SUM(valor_mensalidade), 0) FROM alunas")
    suspend fun totalEsperado(): Double

    @Query("""
        SELECT COALESCE(SUM(valor_mensalidade), 0) FROM alunas
        WHERE status_pagamento = 'pendente'
    """)
    suspend fun totalAberto(): Double

    // ─── Relatório Mensal ────────────────────────────────────────────────────

    @Query("""
        SELECT DISTINCT substr(data_matricula, 1, 7) AS mes
        FROM alunas
        ORDER BY mes DESC
    """)
    suspend fun getMesesDisponiveis(): List<String>

    @Query("""
        SELECT * FROM alunas
        WHERE substr(data_matricula, 1, 7) = :anoMes
        ORDER BY nome ASC
    """)
    suspend fun getByMesMatricula(anoMes: String): List<Aluna>
}
