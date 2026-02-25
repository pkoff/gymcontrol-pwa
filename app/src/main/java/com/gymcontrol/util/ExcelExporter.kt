package com.gymcontrol.util

import com.gymcontrol.data.entities.Aluna
import com.gymcontrol.repository.GymRepository
import org.apache.poi.ss.usermodel.*
import org.apache.poi.xssf.usermodel.XSSFWorkbook
import java.io.ByteArrayOutputStream
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/**
 * Gera planilha Excel (.xlsx) com Apache POI.
 * Estrutura: uma aba por mês de matrícula + aba de Resumo Geral.
 * Espelha _gerar_excel_relatorio() do Flask.
 */
object ExcelExporter {

    private val statusMap = mapOf(
        "pago"       to "✅ Pago",
        "periodo_30" to "🕐 Período 30 dias",
        "atrasado"   to "🔴 Atrasado",
        "pendente"   to "⏳ Pendente"
    )

    suspend fun gerarExcel(repository: GymRepository): ByteArray {
        val wb = XSSFWorkbook()

        val meses = repository.getMesesDisponiveis()
        val relatorios = meses.map { repository.getRelatorioMes(it) }

        // ── Estilos ──────────────────────────────────────────────────────────
        val headerStyle = wb.createCellStyle().apply {
            fillForegroundColor = IndexedColors.VIOLET.index
            fillPattern = FillPatternType.SOLID_FOREGROUND
            val font = wb.createFont().apply {
                bold = true
                color = IndexedColors.WHITE.index
            }
            setFont(font)
            alignment = HorizontalAlignment.CENTER
        }

        val titleStyle = wb.createCellStyle().apply {
            val font = wb.createFont().apply {
                bold = true
                fontHeightInPoints = 14
            }
            setFont(font)
        }

        // ── Aba de Resumo Geral (índice 0) ───────────────────────────────────
        val wsResumo = wb.createSheet("Resumo Geral")

        var rowIdx = 0
        wsResumo.createRow(rowIdx++).apply {
            createCell(0).apply {
                setCellValue("GymControl — Relatório Mensal")
                cellStyle = titleStyle
            }
        }
        wsResumo.createRow(rowIdx++).createCell(0)
            .setCellValue("Gerado em: ${StatusUtil.formatarData(StatusUtil.hoje())}")
        wsResumo.createRow(rowIdx++) // linha vazia

        val cabResumo = arrayOf("Mês", "Total Alunas", "Pagas", "Atrasadas", "Período 30d", "Valor Arrecadado")
        wsResumo.createRow(rowIdx++).apply {
            cabResumo.forEachIndexed { i, v ->
                createCell(i).apply {
                    setCellValue(v)
                    cellStyle = headerStyle
                }
            }
        }

        for (rel in relatorios) {
            wsResumo.createRow(rowIdx++).apply {
                createCell(0).setCellValue(rel.mesLabel)
                createCell(1).setCellValue(rel.totalAlunas.toDouble())
                createCell(2).setCellValue(rel.pagas.toDouble())
                createCell(3).setCellValue(rel.atrasadas.toDouble())
                createCell(4).setCellValue(rel.periodo30.toDouble())
                createCell(5).setCellValue(rel.valorArrecadado)
            }
        }
        autoSizeColumns(wsResumo, cabResumo.size)

        // ── Abas por mês ─────────────────────────────────────────────────────
        val cabMes = arrayOf(
            "Nome", "Telefone", "Valor Mensalidade",
            "Data Matrícula", "Data Vencimento", "Data Pagamento",
            "Status BD", "Status Real"
        )

        for (rel in relatorios.reversed()) {
            val sheetName = rel.mesLabel.take(31).replace("/", "-")
            val ws = wb.createSheet(sheetName)

            ws.createRow(0).apply {
                cabMes.forEachIndexed { i, v ->
                    createCell(i).apply {
                        setCellValue(v)
                        cellStyle = headerStyle
                    }
                }
            }

            rel.alunas.forEachIndexed { idx, acs ->
                val a = acs.aluna
                ws.createRow(idx + 1).apply {
                    createCell(0).setCellValue(a.nome)
                    createCell(1).setCellValue(a.telefone ?: "")
                    createCell(2).setCellValue(a.valorMensalidade)
                    createCell(3).setCellValue(StatusUtil.formatarData(a.dataMatricula))
                    createCell(4).setCellValue(StatusUtil.formatarData(a.dataVencimento))
                    createCell(5).setCellValue(StatusUtil.formatarData(a.dataPagamento))
                    createCell(6).setCellValue(a.statusPagamento)
                    createCell(7).setCellValue(statusMap[acs.statusReal] ?: acs.statusReal)
                }
            }
            autoSizeColumns(ws, cabMes.size)
        }

        val out = ByteArrayOutputStream()
        wb.write(out)
        wb.close()
        return out.toByteArray()
    }

    private fun autoSizeColumns(sheet: Sheet, numCols: Int) {
        for (i in 0 until numCols) {
            sheet.autoSizeColumn(i)
            val width = sheet.getColumnWidth(i)
            sheet.setColumnWidth(i, minOf(width + 1024, 15000))
        }
    }
}
