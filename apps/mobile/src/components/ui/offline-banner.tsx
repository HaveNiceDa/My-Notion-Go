import { useTranslation } from "react-i18next";
import { Animated, Easing, StyleSheet, Text } from "react-native";
import { useEffect, useRef } from "react";

type OfflineBannerProps = {
  visible: boolean;
};

export function OfflineBanner({ visible }: OfflineBannerProps) {
  const { t } = useTranslation();
  const heightAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heightAnim, {
        toValue: visible ? 28 : 0,
        duration: 200,
        easing: Easing.ease,
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: visible ? 1 : 0,
        duration: 200,
        easing: Easing.ease,
        useNativeDriver: false,
      }),
    ]).start();
  }, [visible, heightAnim, opacityAnim]);

  return (
    <Animated.View style={{ height: heightAnim, opacity: opacityAnim }}>
      <Text style={styles.text}>{t("network.offline")}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  text: {
    backgroundColor: "#ededeb",
    color: "#787774",
    fontSize: 11,
    lineHeight: 28,
    textAlign: "center",
  },
});
