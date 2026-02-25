package com.gymcontrol.data.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import com.gymcontrol.data.dao.AlunaDao
import com.gymcontrol.data.dao.UsuarioDao
import com.gymcontrol.data.entities.Aluna
import com.gymcontrol.data.entities.Usuario
import com.gymcontrol.util.PasswordUtil
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@Database(
    entities = [Aluna::class, Usuario::class],
    version = 1,
    exportSchema = false
)
abstract class GymDatabase : RoomDatabase() {

    abstract fun alunaDao(): AlunaDao
    abstract fun usuarioDao(): UsuarioDao

    companion object {
        @Volatile
        private var INSTANCE: GymDatabase? = null

        fun getInstance(context: Context): GymDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: buildDatabase(context).also { INSTANCE = it }
            }
        }

        private fun buildDatabase(context: Context): GymDatabase {
            return Room.databaseBuilder(
                context.applicationContext,
                GymDatabase::class.java,
                "gymcontrol.db"
            )
                .addCallback(object : Callback() {
                    override fun onCreate(db: SupportSQLiteDatabase) {
                        super.onCreate(db)
                        // Cria usuário admin padrão ao criar o banco pela primeira vez
                        CoroutineScope(Dispatchers.IO).launch {
                            val instance = getInstance(context)
                            val hash = PasswordUtil.hashPassword("admin123")
                            instance.usuarioDao().insert(
                                Usuario(username = "admin", passwordHash = hash)
                            )
                        }
                    }
                })
                .build()
        }

        /**
         * Retorna o caminho físico do arquivo .db no dispositivo.
         * Usado para geração de backup ZIP.
         */
        fun getDatabasePath(context: Context): String {
            return context.getDatabasePath("gymcontrol.db").absolutePath
        }
    }
}
