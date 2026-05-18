import { Button } from "@/components/ui/button";
import { CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";
import { ApiError } from "@my-notion-go/api-client";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import { KeyboardAvoidingView, Pressable, Text, View } from "@/tw";

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
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="gap-4.5">
      <View className="gap-2">
        <CardTitle selectable>{title}</CardTitle>
        <CardDescription selectable>{subtitle}</CardDescription>
      </View>

      <View className="gap-3">
        {isRegister ? (
          <Input
            accessibilityLabel={t("auth.name")}
            autoCapitalize="words"
            editable={!isSubmitting}
            onChangeText={setName}
            placeholder={t("auth.namePlaceholder")}
            value={name}
          />
        ) : null}
        <Input
          accessibilityLabel={t("auth.email")}
          autoCapitalize="none"
          autoComplete="email"
          editable={!isSubmitting}
          inputMode="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder={t("auth.emailPlaceholder")}
          value={email}
        />
        <Input
          accessibilityLabel={t("auth.password")}
          autoCapitalize="none"
          editable={!isSubmitting}
          onChangeText={setPassword}
          placeholder={passwordPlaceholder}
          secureTextEntry
          value={password}
        />
      </View>

      {errorKey ? (
        <Text accessibilityRole="alert" className="text-sm leading-5 text-notion-danger">
          {t(errorKey)}
        </Text>
      ) : null}

      <Button
        accessibilityLabel={submitLabel}
        isLoading={isSubmitting}
        label={submitLabel}
        onPress={handleSubmit}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={switchLabel}
        disabled={isSubmitting}
        onPress={() => {
          setErrorKey(null);
          setMode(isRegister ? "login" : "register");
        }}
        className="flex-row items-center justify-center gap-1.5"
      >
        <Text className="text-sm text-notion-faint">{switchPrompt}</Text>
        <Text className="text-sm font-bold text-notion-text">{switchLabel}</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}
