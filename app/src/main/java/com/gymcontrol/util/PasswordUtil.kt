package com.gymcontrol.util

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64

/**
 * Utilitário de senha: hash SHA-256 com salt aleatório.
 * Formato armazenado: "salt_base64:hash_hex"
 */
object PasswordUtil {

    fun hashPassword(password: String): String {
        val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }
        val saltB64 = Base64.getEncoder().encodeToString(salt)
        val hash = sha256(saltB64 + password)
        return "$saltB64:$hash"
    }

    fun verifyPassword(password: String, storedHash: String): Boolean {
        return try {
            val parts = storedHash.split(":")
            if (parts.size != 2) return false
            val (saltB64, hash) = parts
            sha256(saltB64 + password) == hash
        } catch (e: Exception) {
            false
        }
    }

    private fun sha256(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val bytes = digest.digest(input.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }
}
