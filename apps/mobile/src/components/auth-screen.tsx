import { useAuthStore } from "@/stores/auth-store";
import { ApiError } from "@my-notion-go/api-client";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";

type AuthMode = "login" | "register";

function getAuthErrorKey(error: unknown) {
  if (error instanceof ApiError && error.status === 0) {
    return "auth.networkFailed";
  }
  if (error instanceof ApiError && error.status === 401) {
    return "auth.invalidCredentials";
  }
  if (error instanceof ApiError && error.status === 409) {
    return "auth.emailExists";
  }
  return "auth.requestFailed";
}

export function AuthScreen() {
  const { t } = useTranslation();
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegister = mode === "register";
  const title = isRegister ? t("auth.registerTitle") : t("auth.loginTitle");
  const subtitle = isRegister ? t("auth.registerSubtitle") : t("auth.loginSubtitle");
  const passwordPlaceholder = isRegister ? t("auth.registerPasswordPlaceholder") : t("auth.loginPasswordPlaceholder");
  const submitLabel = isSubmitting ? t("auth.processing") : isRegister ? t("auth.registerSubmit") : t("auth.loginSubmit");
  const switchPrompt = isRegister ? t("auth.hasAccount") : t("auth.noAccount");
  const switchLabel = isRegister ? t("auth.signIn") : t("auth.signUp");

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  async function handleSubmit() {
    setErrorKey(null);
    if (!normalizedEmail.includes("@")) {
      setErrorKey("auth.invalidEmail");
      return;
    }
    if (!password) {
      setErrorKey("auth.requiredPassword");
      return;
    }
    if (isRegister && password.length < 8) {
      setErrorKey("auth.minPassword");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isRegister) {
        await register({ email: normalizedEmail, name: name.trim() || undefined, password });
      } else {
        await login({ email: normalizedEmail, password });
      }
    } catch (error) {
      setErrorKey(getAuthErrorKey(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ gap: 18 }}>
      <View style={{ gap: 8 }}>
        <Text selectable style={{ color: "#1C1917", fontSize: 30, fontWeight: "700", lineHeight: 36 }}>
          {title}
        </Text>
        <Text selectable style={{ color: "#57534E", fontSize: 16, lineHeight: 23 }}>
          {subtitle}
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        {isRegister ? (
          <TextInput
            accessibilityLabel={t("auth.name")}
            autoCapitalize="words"
            editable={!isSubmitting}
            onChangeText={setName}
            placeholder={t("auth.namePlaceholder")}
            style={inputStyle}
            value={name}
          />
        ) : null}
        <TextInput
          accessibilityLabel={t("auth.email")}
          autoCapitalize="none"
          autoComplete="email"
          editable={!isSubmitting}
          inputMode="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder={t("auth.emailPlaceholder")}
          style={inputStyle}
          value={email}
        />
        <TextInput
          accessibilityLabel={t("auth.password")}
          autoCapitalize="none"
          editable={!isSubmitting}
          onChangeText={setPassword}
          placeholder={passwordPlaceholder}
          secureTextEntry
          style={inputStyle}
          value={password}
        />
      </View>

      {errorKey ? (
        <Text accessibilityRole="alert" style={{ color: "#B91C1C", fontSize: 14, lineHeight: 20 }}>
          {t(errorKey)}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={submitLabel}
        disabled={isSubmitting}
        onPress={handleSubmit}
        style={{
          alignItems: "center",
          borderRadius: 999,
          backgroundColor: isSubmitting ? "#78716C" : "#1C1917",
          paddingHorizontal: 18,
          paddingVertical: 14,
        }}
      >
        <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>{submitLabel}</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={switchLabel}
        disabled={isSubmitting}
        onPress={() => {
          setErrorKey(null);
          setMode(isRegister ? "login" : "register");
        }}
        style={{ alignItems: "center", flexDirection: "row", gap: 6, justifyContent: "center" }}
      >
        <Text style={{ color: "#78716C", fontSize: 14 }}>{switchPrompt}</Text>
        <Text style={{ color: "#1C1917", fontSize: 14, fontWeight: "700" }}>{switchLabel}</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const inputStyle = {
  borderColor: "#D6D3D1",
  borderRadius: 16,
  borderWidth: 1,
  color: "#1C1917",
  fontSize: 16,
  paddingHorizontal: 14,
  paddingVertical: 13,
} as const;
