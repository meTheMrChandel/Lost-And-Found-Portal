import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Camera, CameraView } from "expo-camera";
import { useNavigation } from "@react-navigation/native";
import { itemsApi, QRScanResult } from "../../api/items";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import { colors } from "../../theme/colors";

export const QRScanScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState<boolean>(false);
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<QRScanResult | null>(null);

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    };
    getCameraPermissions();
  }, []);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned || scanning) return;
    setScanned(true);
    setScanning(true);

    try {
      // Extract UUID from QR URL (e.g. https://.../scan/f47ac10b-58cc-4372-a567-0e02b2c3d479)
      const parts = data.split("/");
      const uuid = parts[parts.length - 1];

      const result = await itemsApi.scanQR(uuid);
      setScanResult(result);
    } catch (err: any) {
      Alert.alert(
        "Invalid Sticker",
        "Could not verify this QR code as an active IIT Ropar valuable sticker.",
        [{ text: "Scan Again", onPress: () => setScanned(false) }]
      );
    } finally {
      setScanning(false);
    }
  };

  const handleReportFoundFromScan = () => {
    if (!scanResult) return;
    navigation.navigate("ReportFound");
  };

  if (hasPermission === null) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.text}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emoji}>📷</Text>
        <Text style={styles.title}>Camera Access Required</Text>
        <Text style={styles.subtitle}>
          Camera permission is required to scan QR stickers attached to campus valuables.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Scanner Viewport */}
      {!scanResult ? (
        <View style={styles.cameraContainer}>
          <CameraView
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Scanner Overlay Frame */}
          <View style={styles.overlay}>
            <View style={styles.targetFrame}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <Text style={styles.instructionText}>
              Align campus valuable QR sticker inside frame
            </Text>
          </View>
        </View>
      ) : (
        /* Zero-Knowledge Scan Result Card */
        <View style={styles.resultContainer}>
          <View style={styles.resultCard}>
            <View style={styles.shieldHeader}>
              <Text style={styles.shieldIcon}>🛡️</Text>
              <Text style={styles.shieldTitle}>Verified IIT Ropar Valuable</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>ITEM NAME</Text>
              <Text style={styles.resultValue}>{scanResult.item_name}</Text>
            </View>

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>CATEGORY</Text>
              <Text style={styles.resultValue}>{scanResult.category}</Text>
            </View>

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>REGISTERED OWNER</Text>
              <Text style={styles.resultValue}>{scanResult.owner_name}</Text>
            </View>

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>STICKER STATUS</Text>
              <Badge
                label={scanResult.is_active ? "ACTIVE & PROTECTED" : "DEACTIVATED"}
                variant={scanResult.is_active ? "found" : "lost"}
              />
            </View>

            <View style={styles.privacyNotice}>
              <Text style={styles.privacyText}>
                🔒 Zero-Knowledge Privacy: Owner's phone number, email, and student registration number are kept confidential.
              </Text>
            </View>

            <Button
              title="🤝 I Found This Belonging"
              onPress={handleReportFoundFromScan}
              style={styles.actionBtn}
            />

            <Button
              title="Scan Another Code"
              variant="outline"
              onPress={() => {
                setScanResult(null);
                setScanned(false);
              }}
            />
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  cameraContainer: {
    flex: 1,
    position: "relative",
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    backgroundColor: colors.background,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  text: {
    marginTop: 10,
    fontSize: 12,
    color: colors.textSecondary,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  targetFrame: {
    width: 240,
    height: 240,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 32,
    height: 32,
    borderColor: colors.ocean,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  instructionText: {
    marginTop: 24,
    color: colors.textWhite,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  resultContainer: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  resultCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  shieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  shieldIcon: {
    fontSize: 20,
  },
  shieldTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginBottom: 16,
  },
  resultRow: {
    marginBottom: 12,
  },
  resultLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  resultValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  privacyNotice: {
    backgroundColor: colors.oceanLight,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BAE6FD",
    marginVertical: 14,
  },
  privacyText: {
    fontSize: 11,
    color: "#0369A1",
    lineHeight: 16,
  },
  actionBtn: {
    marginBottom: 10,
  },
});
