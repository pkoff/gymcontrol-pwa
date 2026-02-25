package com.gymcontrol.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.*
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.gymcontrol.R
import com.gymcontrol.bridge.JsBridge
import com.gymcontrol.repository.GymRepository
import com.gymcontrol.ui.login.LoginActivity
import com.gymcontrol.util.BackupManager

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var repository: GymRepository
    private lateinit var bridge: JsBridge

    // Launcher para selecionar arquivo de restauração
    private val filePickerLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let { processRestoreFile(it) }
    }

    // Launcher para permissão de armazenamento
    private val storagePermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (!granted) {
            Toast.makeText(this, "Permissão de armazenamento negada", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        supportActionBar?.hide()

        repository = GymRepository(this)

        // Solicita permissão de armazenamento se necessário (API < 29)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE)
                != PackageManager.PERMISSION_GRANTED) {
                storagePermissionLauncher.launch(Manifest.permission.WRITE_EXTERNAL_STORAGE)
            }
        }

        setupWebView()
    }

    @Suppress("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView = findViewById(R.id.webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            cacheMode = WebSettings.LOAD_NO_CACHE
        }

        // JS Bridge
        bridge = JsBridge(this, webView, repository, lifecycleScope)
        webView.addJavascriptInterface(bridge, "Android")

        // WebViewClient customizado
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                // Injeta callbacks de navegação
                injectNavigation()
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                // Intercepta ações nativas
                when {
                    url.startsWith("gymcontrol://logout") -> {
                        logout()
                        return true
                    }
                    url.startsWith("gymcontrol://backup") -> {
                        requestBackup()
                        return true
                    }
                    url.startsWith("gymcontrol://restaurar") -> {
                        filePickerLauncher.launch("*/*")
                        return true
                    }
                }
                return false
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onJsAlert(view: WebView, url: String, message: String, result: JsResult): Boolean {
                AlertDialog.Builder(this@MainActivity)
                    .setMessage(message)
                    .setPositiveButton("OK") { _, _ -> result.confirm() }
                    .show()
                return true
            }

            override fun onJsConfirm(view: WebView, url: String, message: String, result: JsResult): Boolean {
                AlertDialog.Builder(this@MainActivity)
                    .setMessage(message)
                    .setPositiveButton("Confirmar") { _, _ -> result.confirm() }
                    .setNegativeButton("Cancelar") { _, _ -> result.cancel() }
                    .show()
                return true
            }
        }

        // Carrega o app HTML principal
        webView.loadUrl("file:///android_asset/app/index.html")
    }

    private fun injectNavigation() {
        // Exponemos variáveis globais para o HTML saber que está no Android
        val js = """
            window.IS_ANDROID = true;
            if (typeof window.AndroidCallback === 'undefined') {
                window.AndroidCallback = {
                    listeners: {},
                    onResult: function(method, data) {
                        if (this.listeners[method]) {
                            this.listeners[method](data);
                            delete this.listeners[method];
                        }
                    },
                    once: function(method, cb) {
                        this.listeners[method] = cb;
                    }
                };
            }
        """.trimIndent()
        webView.evaluateJavascript(js, null)
    }

    private fun requestBackup() {
        lifecycleScope.launchWhenStarted {
            Toast.makeText(this@MainActivity, "Gerando backup...", Toast.LENGTH_SHORT).show()
            val caminho = BackupManager.gerarBackup(this@MainActivity, repository)
            if (caminho != null) {
                Toast.makeText(
                    this@MainActivity,
                    "✅ Backup salvo em:\n$caminho",
                    Toast.LENGTH_LONG
                ).show()
            } else {
                Toast.makeText(this@MainActivity, "❌ Falha ao gerar backup", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun processRestoreFile(uri: Uri) {
        val fileName = uri.lastPathSegment ?: ""
        val isZip = fileName.endsWith(".zip", ignoreCase = true)
        val isDb = fileName.endsWith(".db", ignoreCase = true)

        if (!isZip && !isDb) {
            Toast.makeText(this, "Arquivo inválido. Use .zip ou .db", Toast.LENGTH_SHORT).show()
            return
        }

        AlertDialog.Builder(this)
            .setTitle("Restaurar Backup")
            .setMessage("⚠️ Isso substituirá TODOS os dados atuais. Deseja continuar?")
            .setPositiveButton("Restaurar") { _, _ ->
                lifecycleScope.launchWhenStarted {
                    val stream = contentResolver.openInputStream(uri)
                    if (stream != null) {
                        val msg = BackupManager.restaurarBanco(this@MainActivity, stream, isZip)
                        stream.close()
                        Toast.makeText(this@MainActivity, msg, Toast.LENGTH_LONG).show()
                        if (msg.startsWith("✅")) {
                            // Reinicia o app para reabrir o banco restaurado
                            recreate()
                        }
                    }
                }
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun logout() {
        getSharedPreferences("gymcontrol_prefs", MODE_PRIVATE)
            .edit()
            .putBoolean("logged_in", false)
            .apply()
        startActivity(Intent(this, LoginActivity::class.java))
        finish()
    }

    // Bloqueia o back button para não sair sem querer
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            AlertDialog.Builder(this)
                .setMessage("Deseja sair do GymControl?")
                .setPositiveButton("Sair") { _, _ -> super.onBackPressed() }
                .setNegativeButton("Cancelar", null)
                .show()
        }
    }
}
