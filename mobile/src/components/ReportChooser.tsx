import React from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/types";
import { BottomSheet, PressableScale, Text } from "../ui";
import { ChevronRight, IconType, PackageCheck, ScanLine, SearchX } from "../ui/icons";
import { colors } from "../theme/colors";
import { radii } from "../theme/tokens";

type Choice = "ReportLost" | "ReportFound" | "QRScan";

const CHOICES: { route: Choice; title: string; body: string; icon: IconType; fg: string; bg: string }[] = [
  {
    route: "ReportLost",
    title: "I lost something",
    body: "Post a report so finders and the admin office can spot it",
    icon: SearchX,
    fg: colors.lost,
    bg: colors.lostTint,
  },
  {
    route: "ReportFound",
    title: "I found something",
    body: "Report it and help get it back to its owner",
    icon: PackageCheck,
    fg: colors.primary,
    bg: colors.primaryTint,
  },
  {
    route: "QRScan",
    title: "Scan a QR sticker",
    body: "See whose tagged item you're holding",
    icon: ScanLine,
    fg: colors.info,
    bg: colors.infoTint,
  },
];

/** "Lost, found or scan?" — the sheet behind the Report button. */
export const ReportChooser: React.FC<{ visible: boolean; onClose: () => void }> = ({ visible, onClose }) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <BottomSheet visible={visible} onClose={onClose} title="What would you like to do?">
      <View style={{ gap: 10 }}>
        {CHOICES.map((choice) => {
          const Icon = choice.icon;
          return (
            <PressableScale
              key={choice.route}
              onPress={() => {
                onClose();
                navigation.navigate(choice.route);
              }}
              scaleTo={0.98}
              accessibilityRole="button"
              style={styles.choice}
            >
              <View style={[styles.icon, { backgroundColor: choice.bg }]}>
                <Icon size={24} color={choice.fg} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="headline">{choice.title}</Text>
                <Text variant="footnote" color="textSecondary" style={{ marginTop: 2 }}>
                  {choice.body}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </PressableScale>
          );
        })}
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  icon: { width: 48, height: 48, borderRadius: radii.md, alignItems: "center", justifyContent: "center" },
});
