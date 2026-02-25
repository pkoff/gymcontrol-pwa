package com.gymcontrol.util

import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.gymcontrol.data.database.GymDatabase
import com.gymcontrol.repository.GymRepository
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

/**
 * Gera backup .zip contendo:
 *   - backup_academia_YYYY-MM-DD.db   (banco SQLite Room)
 *   - relatorio_mensal_YYYY-MM-DD.xlsx (planilha Excel)
 *
 * Salva em Downloads usando MediaStore (API 29+) ou File API (API < 29).
 *
 * Também provê função para restaurar banco a partir de .zip ou .db.
 */
object BackupManager {

    /**
     * Gera e salva o backup na pasta Downloads.
     * @return caminho/URI do arquivo salvo, ou null em caso de erro.
     */
    suspend fun gerarBackup(context: Context, repository: GymRepository): String? {
        return try {
            val hoje = StatusUtil.hoje()
            val nomeArquivo = "gymcontrol_backup_$hoje.zip"

            // Conteúdo do ZIP
            val zipBytes = criarZipBytes(context, repository, hoje)

            salvarNaDownloads(context, nomeArquivo, zipBytes)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    private suspend fun criarZipBytes(
        context: Context,
        repository: GymRepository,
        hoje: String
    ): ByteArray {
        val baos = ByteArrayOutputStream()
        ZipOutputStream(baos).use { zos ->

            // ── Banco de dados ────────────────────────────────────────────────
            val dbPath = GymDatabase.getDatabasePath(context)
            val dbFile = File(dbPath)
            if (dbFile.exists()) {
                zos.putNextEntry(ZipEntry("backup_academia_$hoje.db"))
                zos.write(dbFile.readBytes())
                zos.closeEntry()
            }

            // Arquivos auxiliares do Room (WAL / SHM) se existirem
            listOf("$dbPath-wal", "$dbPath-shm").forEach { path ->
                val f = File(path)
                if (f.exists()) {
                    val nome = f.name.replace(dbFile.name, "backup_academia_$hoje.db")
                    zos.putNextEntry(ZipEntry(nome))
                    zos.write(f.readBytes())
                    zos.closeEntry()
                }
            }

            // ── Planilha Excel ────────────────────────────────────────────────
            val excelBytes = ExcelExporter.gerarExcel(repository)
            zos.putNextEntry(ZipEntry("relatorio_mensal_$hoje.xlsx"))
            zos.write(excelBytes)
            zos.closeEntry()
        }
        return baos.toByteArray()
    }

    private fun salvarNaDownloads(context: Context, nomeArquivo: String, data: ByteArray): String? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // API 29+ — MediaStore
            val resolver = context.contentResolver
            val contentValues = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, nomeArquivo)
                put(MediaStore.Downloads.MIME_TYPE, "application/zip")
                put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
            }
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
                ?: return null
            resolver.openOutputStream(uri)?.use { it.write(data) }
            "Downloads/$nomeArquivo"
        } else {
            // API < 29 — File API clássica
            val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            downloadsDir.mkdirs()
            val file = File(downloadsDir, nomeArquivo)
            FileOutputStream(file).use { it.write(data) }
            file.absolutePath
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RESTAURAÇÃO DO BANCO
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Restaura banco a partir de InputStream de arquivo .zip (com .db dentro) ou .db direto.
     * @param inputStream  stream do arquivo enviado pelo usuário
     * @param isZip        true se o arquivo é .zip, false se é .db direto
     * @return mensagem de sucesso ou erro
     */
    fun restaurarBanco(context: Context, inputStream: InputStream, isZip: Boolean): String {
        return try {
            val dbBytes: ByteArray = if (isZip) {
                // Extrai o .db do ZIP
                var found: ByteArray? = null
                ZipInputStream(inputStream).use { zis ->
                    var entry = zis.nextEntry
                    while (entry != null) {
                        if (entry.name.endsWith(".db")) {
                            found = zis.readBytes()
                            break
                        }
                        entry = zis.nextEntry
                    }
                }
                found ?: return "❌ Nenhum arquivo .db encontrado no ZIP."
            } else {
                inputStream.readBytes()
            }

            // Validação: assinatura SQLite
            if (!dbBytes.take(16).toByteArray()
                    .toString(Charsets.ISO_8859_1)
                    .startsWith("SQLite format 3")) {
                return "❌ Arquivo não é um banco SQLite válido."
            }

            // Fecha o banco atual antes de substituir
            GymDatabase.getInstance(context).close()

            val dbPath = GymDatabase.getDatabasePath(context)
            val dbFile = File(dbPath)

            // Backup automático do banco atual
            if (dbFile.exists()) {
                val bkp = File("${dbPath}.bkp_${StatusUtil.hoje()}")
                dbFile.copyTo(bkp, overwrite = true)
            }

            // Substitui o banco
            dbFile.writeBytes(dbBytes)

            "✅ Banco restaurado com sucesso!"
        } catch (e: Exception) {
            "❌ Erro ao restaurar: ${e.message}"
        }
    }
}
