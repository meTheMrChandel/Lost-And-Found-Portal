import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../../context/AuthContext";
import { postsApi, Category } from "../../api/posts";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import { CategoryChip } from "../../components/CategoryChip";
import { colors } from "../../theme/colors";

export const ReportLostScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [hiddenProof, setHiddenProof] = useState("");
  const [rewardAmount, setRewardAmount] = useState("");
  const [selectedImages, setSelectedImages] = useState<ImagePicker.ImagePickerAsset[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    postsApi.getCategories().then((cats) => {
      setCategories(cats);
      if (cats.length > 0) setSelectedCategory(cats[0].slug);
    }).catch(console.error);
  }, []);

  // Pick images from gallery
  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant photo library access to attach item photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      setSelectedImages((prev) => [...prev, ...result.assets].slice(0, 5));
    }
  };

  // Take photo with camera
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant camera access to photograph your item.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setSelectedImages((prev) => [...prev, result.assets[0]].slice(0, 5));
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title.trim() || !selectedCategory || !location.trim() || !description.trim()) {
      setError("Please fill in item name, category, campus location, and description.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("category", selectedCategory);
      formData.append("last_seen_place", location.trim());
      formData.append("campus_location", location.trim());
      formData.append("description", description.trim());
      const nowIso = new Date().toISOString();
      formData.append("last_seen_time", nowIso);
      formData.append("incident_date", nowIso.split("T")[0]);

      if (hiddenProof.trim()) {
        formData.append("hidden_proof", hiddenProof.trim());
      }
      if (rewardAmount.trim() && !isNaN(Number(rewardAmount))) {
        formData.append("reward_amount", rewardAmount.trim());
      }

      // Attach photos
      selectedImages.forEach((img, idx) => {
        const uriParts = img.uri.split(".");
        const fileType = uriParts[uriParts.length - 1];
        formData.append("images", {
          uri: img.uri,
          name: `photo_${idx}.${fileType}`,
          type: `image/${fileType}`,
        } as any);
      });

      await postsApi.createLostPost(formData);

      Alert.alert(
        "Report Submitted",
        "Your lost item ticket has been lodged. Our matching engine will automatically scan for matching found belongings.",
        [{ text: "OK", onPress: () => navigation.navigate("Feed") }]
      );
    } catch (err: any) {
      setError(err.formattedMessage || err.message || "Failed to submit lost item report.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {!user && (
          <View style={styles.authPromptCard}>
            <Text style={styles.authPromptTitle}>🔒 Sign In Required</Text>
            <Text style={styles.authPromptSub}>
              Please sign in with your verified IIT Ropar institute account to report lost belongings and receive matching notifications.
            </Text>
            <Button
              title="Sign In / Register"
              onPress={() => navigation.navigate("Auth")}
              style={{ marginTop: 10 }}
            />
          </View>
        )}
        <View style={styles.header}>
          <Text style={styles.title}>Report a Lost Item</Text>
          <Text style={styles.subtitle}>
            File a missing belongings ticket with private ownership proof.
          </Text>
        </View>

        <View style={styles.formCard}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          ) : null}

          <Input
            label="What did you lose? *"
            placeholder="e.g. Hero Ranger Bicycle, Apple MacBook Air"
            value={title}
            onChangeText={setTitle}
          />

          {/* Category Scroller */}
          <Text style={styles.fieldLabel}>CATEGORY *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {categories.map((c) => (
              <CategoryChip
                key={c.slug}
                label={c.name}
                selected={selectedCategory === c.slug}
                onPress={() => setSelectedCategory(c.slug)}
              />
            ))}
          </ScrollView>

          <Input
            label="Where was it lost? *"
            placeholder="e.g. Central Library 2nd Floor, Brahmaputra Hostel"
            value={location}
            onChangeText={setLocation}
          />

          <Input
            label="Item Description & Distinguishing Marks *"
            placeholder="Color, brand, dents, stickers, keychains..."
            value={description}
            onChangeText={setDescription}
            multiline
          />

          {/* Confidential Hidden Proof Section */}
          <View style={styles.proofCard}>
            <View style={styles.proofHeader}>
              <Text style={styles.proofIcon}>🔒</Text>
              <Text style={styles.proofTitle}>Confidential Proof of Ownership</Text>
            </View>
            <Text style={styles.proofSubtitle}>
              Strictly private. Only verified campus administrators will see this to evaluate claimant answers (e.g. wallpaper, serial numbers, engraved initials).
            </Text>
            <Input
              placeholder="e.g. Lock screen wallpaper is a mountain photo; small scratch near power port"
              value={hiddenProof}
              onChangeText={setHiddenProof}
              multiline
              containerStyle={{ marginBottom: 0 }}
            />
          </View>

          <Input
            label="Promised Honor Reward (Optional ₹)"
            placeholder="e.g. 500"
            value={rewardAmount}
            onChangeText={setRewardAmount}
            keyboardType="number-pad"
          />

          {/* Photos Picker Section */}
          <Text style={styles.fieldLabel}>PHOTOS (UP TO 5)</Text>
          <View style={styles.photoActionsRow}>
            <TouchableOpacity onPress={pickImages} style={styles.photoActionBtn}>
              <Text style={styles.photoActionText}>📁 Pick from Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={takePhoto} style={styles.photoActionBtn}>
              <Text style={styles.photoActionText}>📷 Take Photo</Text>
            </TouchableOpacity>
          </View>

          {selectedImages.length > 0 && (
            <ScrollView horizontal style={styles.thumbnailsScroll}>
              {selectedImages.map((img, idx) => (
                <View key={idx} style={styles.thumbnailWrapper}>
                  <Image source={{ uri: img.uri }} style={styles.thumbnail} />
                  <TouchableOpacity onPress={() => removeImage(idx)} style={styles.removeBadge}>
                    <Text style={styles.removeText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          <Button
            title="Submit Lost Report"
            variant="lost"
            onPress={handleSubmit}
            loading={loading}
            style={styles.submitBtn}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  authPromptCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  authPromptTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  authPromptSub: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  categoryScroll: {
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: colors.lostLight,
    padding: 10,
    borderRadius: 12,
    marginBottom: 14,
  },
  errorText: {
    color: colors.lost,
    fontSize: 12,
  },
  proofCard: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  proofHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  proofIcon: {
    fontSize: 14,
  },
  proofTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#166534",
  },
  proofSubtitle: {
    fontSize: 11,
    color: "#15803D",
    lineHeight: 16,
    marginBottom: 10,
  },
  photoActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  photoActionBtn: {
    flex: 1,
    height: 40,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  photoActionText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  thumbnailsScroll: {
    flexDirection: "row",
    marginBottom: 16,
  },
  thumbnailWrapper: {
    position: "relative",
    marginRight: 10,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  removeBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.lost,
    alignItems: "center",
    justifyContent: "center",
  },
  removeText: {
    color: colors.textWhite,
    fontSize: 10,
    fontWeight: "bold",
  },
  submitBtn: {
    marginTop: 8,
  },
});
