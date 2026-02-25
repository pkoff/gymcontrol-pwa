# Add project specific ProGuard rules here.
# Keep Room entities
-keep class com.gymcontrol.data.entities.** { *; }

# Keep JS Bridge methods (called via reflection)
-keep class com.gymcontrol.bridge.JsBridge { *; }
-keepclassmembers class com.gymcontrol.bridge.JsBridge {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep POI
-dontwarn org.apache.poi.**
-dontwarn org.apache.xmlbeans.**
-keep class org.apache.poi.** { *; }
