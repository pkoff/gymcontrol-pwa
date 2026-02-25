package com.gymcontrol.data.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Entidade Room para autenticação local.
 * Senha armazenada como hash BCrypt-like via MessageDigest SHA-256 + salt.
 */
@Entity(
    tableName = "usuarios",
    indices = [Index(value = ["username"], unique = true)]
)
data class Usuario(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    @ColumnInfo(name = "username")
    val username: String,

    @ColumnInfo(name = "password_hash")
    val passwordHash: String   // SHA-256(salt + password), formato "salt:hash"
)
