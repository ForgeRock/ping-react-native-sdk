# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.

# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }

# Ping Identity native modules
-keep class com.pingidentity.** { *; }
