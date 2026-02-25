package com.gymcontrol.data.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Entidade Room que espelha a tabela `alunas` do Flask/SQLite original.
 *
 * Campos:
 * - id                 → chave primária autoincrement
 * - nome               → nome completo
 * - telefone           → telefone (opcional)
 * - valorMensalidade   → valor da mensalidade em R$
 * - dataVencimento     → data de vencimento do pagamento (ISO 8601: "YYYY-MM-DD")
 * - dataMatricula      → data de matrícula (padrão: hoje)
 * - statusPagamento    → "pendente" | "pago"
 * - dataPagamento      → data em que o pagamento foi registrado (null se pendente)
 */
@Entity(tableName = "alunas")
data class Aluna(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    @ColumnInfo(name = "nome")
    val nome: String,

    @ColumnInfo(name = "telefone")
    val telefone: String? = null,

    @ColumnInfo(name = "valor_mensalidade")
    val valorMensalidade: Double,

    @ColumnInfo(name = "data_vencimento")
    val dataVencimento: String,          // "YYYY-MM-DD"

    @ColumnInfo(name = "data_matricula")
    val dataMatricula: String,           // "YYYY-MM-DD"

    @ColumnInfo(name = "status_pagamento")
    val statusPagamento: String = "pendente",   // "pendente" | "pago"

    @ColumnInfo(name = "data_pagamento")
    val dataPagamento: String? = null    // "YYYY-MM-DD" ou null
)
