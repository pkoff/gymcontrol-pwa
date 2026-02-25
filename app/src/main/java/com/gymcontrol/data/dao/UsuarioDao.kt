package com.gymcontrol.data.dao

import androidx.room.*
import com.gymcontrol.data.entities.Usuario

@Dao
interface UsuarioDao {

    @Query("SELECT * FROM usuarios WHERE username = :username LIMIT 1")
    suspend fun getByUsername(username: String): Usuario?

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(usuario: Usuario): Long

    @Query("SELECT COUNT(*) FROM usuarios")
    suspend fun count(): Int

    @Query("UPDATE usuarios SET password_hash = :novoHash WHERE username = :username")
    suspend fun updatePassword(username: String, novoHash: String)
}
