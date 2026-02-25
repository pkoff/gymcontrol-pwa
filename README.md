# GymControl Android APK

Sistema de controle de academia totalmente offline para Android.
Convertido de Flask/Python → Kotlin/Room/WebView.

---

## 📁 Estrutura do Projeto

```
GymControl/
├── app/
│   ├── src/main/
│   │   ├── AndroidManifest.xml
│   │   ├── assets/app/
│   │   │   └── index.html              ← Interface completa (SPA)
│   │   ├── java/com/gymcontrol/
│   │   │   ├── data/
│   │   │   │   ├── entities/
│   │   │   │   │   ├── Aluna.kt        ← Entidade Room
│   │   │   │   │   └── Usuario.kt      ← Entidade Room
│   │   │   │   ├── dao/
│   │   │   │   │   ├── AlunaDao.kt     ← DAO completo
│   │   │   │   │   └── UsuarioDao.kt
│   │   │   │   └── database/
│   │   │   │       └── GymDatabase.kt  ← Singleton Room Database
│   │   │   ├── repository/
│   │   │   │   └── GymRepository.kt   ← Lógica de negócios central
│   │   │   ├── bridge/
│   │   │   │   └── JsBridge.kt        ← Ponte JavaScript ↔ Kotlin
│   │   │   ├── ui/
│   │   │   │   ├── login/
│   │   │   │   │   └── LoginActivity.kt
│   │   │   │   └── MainActivity.kt     ← Hospeda WebView
│   │   │   └── util/
│   │   │       ├── StatusUtil.kt       ← Cálculo de status (≡ calcular_status Python)
│   │   │       ├── PasswordUtil.kt     ← Hash SHA-256 + salt
│   │   │       ├── ExcelExporter.kt    ← Geração .xlsx com Apache POI
│   │   │       └── BackupManager.kt    ← Geração .zip + restauração
│   │   └── res/
│   │       ├── layout/
│   │       │   ├── activity_login.xml
│   │       │   └── activity_main.xml
│   │       ├── values/
│   │       │   ├── strings.xml
│   │       │   └── themes.xml
│   │       └── drawable/
│   │           ├── card_background.xml
│   │           └── input_background.xml
│   ├── build.gradle
│   └── proguard-rules.pro
├── build.gradle
├── settings.gradle
├── gradle.properties
└── gradle/wrapper/
    └── gradle-wrapper.properties
```

---

## ⚙️ Pré-requisitos (Windows)

1. **Android Studio Hedgehog** ou superior
   → https://developer.android.com/studio

2. **JDK 17** (já incluído no Android Studio)

3. **Android SDK** (instalado automaticamente pelo Android Studio)
   - SDK Platform: Android 14 (API 34)
   - Build Tools: 34.0.0
   - Min SDK: 26 (Android 8.0)

---

## 🚀 Como abrir e compilar no Android Studio (Windows)

### Passo 1 — Abrir o projeto
1. Abra o **Android Studio**
2. `File → Open` → selecione a pasta `GymControl/`
3. Aguarde o Gradle sincronizar (pode demorar na primeira vez)

### Passo 2 — Criar ícones do app (necessário para compilar)
O projeto usa `@mipmap/ic_launcher` e `@mipmap/ic_launcher_round`.
Você precisa adicioná-los:

**Opção A (recomendado):**
- Clique com botão direito em `res/` → `New → Image Asset`
- Configure um ícone para o app (pode usar emoji 🏋️ ou qualquer imagem)
- Isso criará automaticamente todas as resoluções

**Opção B (rápida para testes):**
- Copie ícones de qualquer projeto Android para `res/mipmap-*/`
- Ou use os ícones padrão do Android Studio

### Passo 3 — Gerar APK de debug (para testes)
1. Menu: `Build → Build Bundle(s) / APK(s) → Build APK(s)`
2. Aguarde a compilação
3. Clique em **"locate"** na notificação que aparecer
4. APK estará em: `app/build/outputs/apk/debug/app-debug.apk`

### Passo 4 — Gerar APK de release (para distribuição)
1. Menu: `Build → Generate Signed Bundle / APK`
2. Selecione **APK**
3. Crie uma nova keystore (ou use uma existente)
4. Selecione `release` como build variant
5. APK estará em: `app/build/outputs/apk/release/app-release.apk`

---

## 📱 Como instalar no celular

### Via USB (modo desenvolvedor):
1. Ative o **Modo Desenvolvedor** no celular:
   - `Configurações → Sobre o telefone → Número da versão` (toque 7x)
2. Ative **Depuração USB** em `Configurações → Opções do desenvolvedor`
3. Conecte o celular ao PC via USB
4. No Android Studio: `Run → Run 'app'`

### Via arquivo APK:
1. Copie o `app-debug.apk` para o celular (WhatsApp, cabo USB, etc.)
2. No celular: `Configurações → Segurança → Instalar apps de fontes desconhecidas`
3. Abra o APK e instale

---

## 🔑 Login padrão
- **Usuário:** admin
- **Senha:** admin123

---

## 💾 Funcionalidades implementadas

| Funcionalidade Flask | Android |
|---|---|
| Login com hash de senha | ✅ SHA-256 + salt (PasswordUtil) |
| Cadastro/edição/exclusão de alunas | ✅ Room + JsBridge |
| Cálculo automático de status | ✅ StatusUtil.kt (≡ calcular_status) |
| Dashboard com estatísticas | ✅ via getDashboard() |
| Lista: período 30 dias | ✅ incluída no dashboard |
| Lista: inadimplentes | ✅ incluída no dashboard |
| Relatório mensal filtrável | ✅ por mês de matrícula |
| Registrar pagamento / reverter | ✅ marcarPago / marcarPendente |
| Exportação Excel (.xlsx) | ✅ Apache POI, abas por mês |
| Backup .zip (DB + Excel) | ✅ salvo na pasta Downloads |
| Restauração de banco | ✅ de .zip ou .db |
| Funcionamento 100% offline | ✅ sem dependência de rede |
| Sessão de login persistida | ✅ SharedPreferences |

---

## 🔧 Configurações adicionais

### Alterar senha do admin
Adicione uma tela de configurações ou modifique `GymDatabase.kt`:
```kotlin
// No bloco onCreate do Callback, altere a senha:
val hash = PasswordUtil.hashPassword("SUA_NOVA_SENHA")
```

### Adicionar mais usuários
Use `UsuarioDao.insert()` via Repository.

### Logs de debug
Para ver logs do WebView no Logcat:
```kotlin
// Em MainActivity.setupWebView(), adicione:
WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
```
Depois inspecione via Chrome em: `chrome://inspect`

---

## 📦 Dependências principais

| Biblioteca | Versão | Uso |
|---|---|---|
| Room | 2.6.1 | Banco de dados SQLite |
| Apache POI | 5.2.5 | Geração de planilha .xlsx |
| Gson | 2.10.1 | Serialização JSON para JS Bridge |
| Kotlin Coroutines | 1.7.3 | Operações assíncronas |
| Security Crypto | 1.1.0 | Criptografia auxiliar |

---

## ⚠️ Possíveis erros de compilação

### "Could not resolve org.apache.poi"
→ Aguarde o Gradle sincronizar completamente (requer internet na primeira build)

### "Unresolved reference: mipmap/ic_launcher"
→ Crie os ícones conforme o **Passo 2** acima

### "minSdkVersion too low"
→ Já configurado para API 26 (Android 8.0+), compatível com ~95% dos dispositivos

### Build lenta na primeira vez
→ Normal. O Gradle precisa baixar as dependências (~200MB). Builds subsequentes são rápidas.
