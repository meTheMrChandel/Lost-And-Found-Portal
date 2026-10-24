import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Switch,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import { itemsApi, RegisteredValuable } from "../../api/items";
import { postsApi, Category } from "../../api/posts";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import { colors } from "../../theme/colors";

export const ValuablesScreen: React.FC = () => {
  const [items, setItems] = useState<RegisteredValuable[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Register Modal state
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [name, setName] = useState<string>("");
  const [category, setCategory] = useState<string>("bicycle");
  const [description, setDescription] = useState<string>("");
  const [serialNumber, setSerialNumber] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  // QR Sticker Modal
  const [stickerModal, setStickerModal] = useState<RegisteredValuable | null>(null);

  const loadItems = async () => {
    try {
      const data = await itemsApi.getRegisteredItems();
      setItems(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
    postsApi.getCategories().then((cats) => {
      setCategories(cats);
      if (cats.length > 0) setCategory(cats[0].slug);
    }).catch(console.error);
  }, []);

  const handleToggle = async (item: RegisteredValuable) => {
    try {
      await itemsApi.toggleActive(item.id);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_active: !i.is_active } : i))
      );
    } catch {
      Alert.alert("Error", "Failed to update sticker status");
    }
  };

  const handleRegister = async () => {
    if (!name.trim()) {
      Alert.alert("Validation", "Please enter item name.");
      return;
    }
    setSubmitting(true);
    try {
      await itemsApi.registerItem({
        name: name.trim(),
        category,
        description: description.trim(),
        serial_number: serialNumber.trim(),
      });
      setModalVisible(false);
      setName("");
      setDescription("");
      setSerialNumber("");
      loadItems();
      Alert.alert("Registered", "Your valuable item has been registered with a unique QR link.");
    } catch (err: any) {
      Alert.alert("Error", err.formattedMessage || "Failed to register item");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header bar with + Add Button */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.title}>Registered Valuables</Text>
          <Text style={styles.subtitle}>Protected with Zero-Knowledge QR stickers</Text>
        </View>
        <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ Add Gear</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.infoCol}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.categoryName}>{item.category?.name || "Equipment"}</Text>
                </View>
                <Switch
                  value={item.is_active}
                  onValueChange={() => handleToggle(item)}
                  trackColor={{ false: "#D1D5DB", true: colors.primaryLight }}
                  thumbColor={item.is_active ? colors.primary : "#9CA3AF"}
                />
              </View>

              <Text style={styles.itemDesc} numberOfLines={2}>
                {item.description || "No description provided."}
              </Text>

              <View style={styles.footerRow}>
                <Badge
                  label={item.is_active ? "ACTIVE QR" : "DEACTIVATED"}
                  variant={item.is_active ? "found" : "default"}
                />
                <TouchableOpacity onPress={() => setStickerModal(item)} style={styles.viewStickerBtn}>
                  <Text style={styles.viewStickerText}>🏷️ View QR Info</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🏷️</Text>
              <Text style={styles.emptyTitle}>No Valuables Registered Yet</Text>
              <Text style={styles.emptySubtitle}>
                Register your bicycles, laptops, and headphones to print sticker QR tags.
              </Text>
              <Button
                title="+ Register First Item"
                onPress={() => setModalVisible(true)}
                style={styles.emptyBtn}
              />
            </View>
          }
        />
      )}

      {/* Registration Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Register Campus Valuable</Text>
            <ScrollView>
              <Input label="Item Name *" placeholder="e.g. Hero Sprint Pro Bicycle" value={name} onChangeText={setName} />
              <Input
                label="Private Serial / Frame No."
                placeholder="e.g. SN-88219-X99"
                value={serialNumber}
                onChangeText={setSerialNumber}
                helperText="🔒 Strictly confidential. Used only by admins for verification."
              />
              <Input
                label="Distinguishing Features"
                placeholder="e.g. Matte blue frame, bell on left handlebar"
                value={description}
                onChangeText={setDescription}
                multiline
              />
              <View style={styles.modalBtns}>
                <Button title="Cancel" variant="outline" onPress={() => setModalVisible(false)} style={{ flex: 1 }} />
                <Button title="Register" onPress={handleRegister} loading={submitting} style={{ flex: 1 }} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Sticker Info Modal */}
      <Modal visible={!!stickerModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Valuable QR Sticker</Text>
            {stickerModal && (
              <View style={styles.stickerBox}>
                <Text style={styles.stickerItemTitle}>{stickerModal.name}</Text>
                <Text style={styles.stickerUUID}>UUID: {stickerModal.qr_uuid.slice(0, 13)}...</Text>
                <View style={styles.qrMock}>
                  <Text style={styles.qrIcon}>📱</Text>
                  <Text style={styles.qrScanText}>SCAN ME IF FOUND</Text>
                  <Text style={styles.qrPortal}>IIT ROPAR LOST & FOUND</Text>
                </View>
                <Text style={styles.stickerInfo}>
                  Finders can scan this sticker with any camera to verify you are the registered owner without seeing your personal phone number.
                </Text>
              </View>
            )}
            <Button title="Close" variant="outline" onPress={() => setStickerModal(null)} />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: {
    color: colors.textWhite,
    fontSize: 12,
    fontWeight: "bold",
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoCol: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  categoryName: {
    fontSize: 11,
    color: colors.ocean,
    fontWeight: "600",
    marginTop: 2,
  },
  itemDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 6,
    lineHeight: 18,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  viewStickerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  viewStickerText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    marginTop: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  emptyBtn: {
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: "85%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 16,
  },
  modalBtns: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  stickerBox: {
    alignItems: "center",
    padding: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.primary,
    borderRadius: 20,
    marginVertical: 16,
  },
  stickerItemTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  stickerUUID: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginTop: 2,
  },
  qrMock: {
    width: 140,
    height: 140,
    backgroundColor: colors.background,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qrIcon: {
    fontSize: 42,
  },
  qrScanText: {
    fontSize: 9,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginTop: 4,
  },
  qrPortal: {
    fontSize: 7,
    color: colors.ocean,
    fontWeight: "700",
  },
  stickerInfo: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 16,
  },
});
