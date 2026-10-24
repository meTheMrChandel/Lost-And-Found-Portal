import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
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

export const ReportFoundScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [custodyMode, setCustodyMode] = useState<"finder" | "admin_office" | "security_office">("finder");
  const [isPrivateAdminOnly, setIsPrivateAdminOnly] = useState(false);
  const [selectedImages, setSelectedImages] = useState<ImagePicker.ImagePickerAsset[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    postsApi.getCategories().then((cats) => {
      setCategories(cats);
      if (cats.length > 0) setSelectedCategory(cats[0].slug);
    }).catch(console.error);
  }, []);

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant photo library access.");
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

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant camera access.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
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
      formData.append("campus_location", location.trim());
      formData.append("description", description.trim());
      formData.append("incident_date", new Date().toISOString().split("T")[0]);
      formData.append("custody_mode", custodyMode);
      formData.append("is_private_admin_only", isPrivateAdminOnly ? "true" : "false");

      selectedImages.forEach((img, idx) => {
        const uriParts = img.uri.split(".");
        const fileType = uriParts[uriParts.length - 1];
        formData.append("images", {
          uri: img.uri,
          name: `found_${idx}.${fileType}`,
          type: `image/${fileType}`,
        } as any);
      });

      await postsApi.createFoundPost(formData);

      Alert.alert(
        "Thank You for Helping!",
        "Your found report has been recorded. We will notify you if a matching owner claims the item.",
        [{ text: "OK", onPress: () => navigation.navigate("Feed") }]
      );
    } catch (err: any) {
      setError(err.formattedMessage || err.message || "Failed to submit found report.");
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
              Please sign in with your verified IIT Ropar institute account to report found belongings and track verification claims.
            </Text>
            <Button
              title="Sign In / Register"
              onPress={() => navigation.navigate("Auth")}
              style={{ marginTop: 10 }}
            />
          </View>
        )}
        <View style={styles.header}>
          <Text style={styles.title}>Report a Found Item</Text>
          <Text style={styles.subtitle}>
            Help return lost belongings to campus peers safely and responsibly.
          </Text>
        </View>

        <View style={styles.formCard}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          ) : null}

          <Input
            label="What did you find? *"
            placeholder="e.g. Scientific Calculator, House Keys, Umbrella"
            value={title}
            onChangeText={setTitle}
          />

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
            label="Where did you find it? *"
            placeholder="e.g. Main Auditorium Ground Floor, Sports Complex"
            value={location}
            onChangeText={setLocation}
          />

          <Input
            label="Visual Details & Condition *"
            placeholder="Describe color, general condition..."
            value={description}
            onChangeText={setDescription}
            multiline
          />

          {/* Current Custody Selection */}
          <Text style={styles.fieldLabel}>CURRENT POSSESSION / CUSTODY</Text>
          <View style={styles.custodyGroup}>
            {[
              { id: "finder", label: "With Me (Finder)", desc: "You hold the item safely until owner is verified" },
              { id: "admin_office", label: "Admin Office", desc: "Handed over to academic block administration" },
              { id: "security_office", label: "Campus Security", desc: "Deposited at main gate security office" },
            ].map((option) => (
              <TouchableOpacity
                key={option.id}
                onPress={() => setCustodyMode(option.id as any)}
                style={[styles.custodyOption, custodyMode === option.id && styles.custodyOptionActive]}
              >
                <Text style={[styles.custodyTitle, custodyMode === option.id && styles.custodyTitleActive]}>
                  {option.label}
                </Text>
                <Text style={styles.custodyDesc}>{option.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Photos */}
          <Text style={styles.fieldLabel}>PHOTOS (UP TO 5)</Text>
          <View style={styles.photoActionsRow}>
            <TouchableOpacity onPress={pickImages} style={styles.photoActionBtn}>
              <Text style={styles.photoActionText}>📁 Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={takePhoto} style={styles.photoActionBtn}>
              <Text style={styles.photoActionText}>📷 Camera</Text>
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
            title="Submit Found Item"
            variant="ocean"
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
  custodyGroup: {
    gap: 8,
    marginBottom: 16,
  },
  custodyOption: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  custodyOptionActive: {
    borderColor: colors.ocean,
    backgroundColor: colors.oceanLight,
  },
  custodyTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  custodyTitleActive: {
    color: colors.ocean,
  },
  custodyDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
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
