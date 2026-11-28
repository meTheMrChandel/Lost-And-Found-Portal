import React, { useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { usePreventRemove } from "@react-navigation/native";
import { RootStackParamList } from "../../navigation/types";
import { authApi, DEPARTMENTS, profilePhotoUrl, PROGRAM_YEARS } from "../../api/auth";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import {
  Avatar,
  Button,
  haptics,
  Notice,
  OptionSheet,
  PickedPhoto,
  Screen,
  SectionHeader,
  SelectField,
  shrinkPhoto,
  Text,
  TextField,
  useToast,
} from "../../ui";
import { BedDouble, Building2, Camera, GraduationCap, Images, Lock, Phone, UserRound } from "../../ui/icons";
import { colors } from "../../theme/colors";
import { radii } from "../../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "EditProfile">;

export const EditProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { user, setProfile } = useAuth();
  const toast = useToast();

  const [fullName, setFullName] = useState(user?.full_name || "");
  const [department, setDepartment] = useState<string | null>(user?.department || null);
  const [programYear, setProgramYear] = useState<string | null>(user?.program_year || null);
  const [hostel, setHostel] = useState(user?.hostel || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [photoSheet, setPhotoSheet] = useState(false);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const changes = {
    ...(fullName.trim() !== (user?.full_name || "") ? { full_name: fullName.trim() } : {}),
    ...(department && department !== user?.department ? { department } : {}),
    ...(programYear && programYear !== user?.program_year ? { program_year: programYear } : {}),
    ...(hostel.trim() !== (user?.hostel || "") ? { hostel: hostel.trim() } : {}),
    ...(phone.trim() !== (user?.phone || "") ? { phone: phone.trim() } : {}),
  };
  const dirty = Object.keys(changes).length > 0 || !!photo;

  usePreventRemove(dirty && !saving, ({ data }) => {
    Alert.alert("Discard changes?", "Your edits haven't been saved.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  if (!user) return null;

  const pick = async (source: "camera" | "gallery") => {
    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Camera access is off", "Allow camera access in Settings to take a profile photo.", [
          { text: "Not now", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]);
        return;
      }
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    };
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets?.length) return;
    setPreparingPhoto(true);
    try {
      setPhoto(await shrinkPhoto(result.assets[0], 0, 800));
    } catch {
      toast.show("Couldn't use that photo. Try another one.", "error");
    } finally {
      setPreparingPhoto(false);
    }
  };

  const save = async () => {
    if (!fullName.trim()) {
      setError("Your name can't be empty.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const updated = await authApi.updateProfile(changes, photo);
      await setProfile({ ...user, ...updated });
      haptics.success();
      toast.show("Profile updated");
      // Saved, so leave without the discard prompt
      setPhoto(null);
      navigation.goBack();
    } catch (err: any) {
      setError(errorMessage(err, "Couldn't save your profile."));
      setSaving(false);
    }
  };

  return (
    <Screen
      scroll
      footer={<Button title="Save changes" size="lg" fullWidth loading={saving} disabled={!dirty} onPress={save} />}
    >
      <View style={styles.photoRow}>
        <Pressable
          onPress={() => setPhotoSheet(true)}
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
        >
          <Avatar name={fullName || user.full_name} uri={photo?.uri || profilePhotoUrl(user)} size={92} />
          <View style={styles.camera}>
            {preparingPhoto ? (
              <ActivityIndicator size="small" color={colors.textWhite} />
            ) : (
              <Camera size={16} color={colors.textWhite} />
            )}
          </View>
        </Pressable>
        <Pressable onPress={() => setPhotoSheet(true)} hitSlop={8}>
          <Text variant="subhead" color="primary" style={{ marginTop: 12 }}>
            {photo || user.photo ? "Change photo" : "Add a photo"}
          </Text>
        </Pressable>
      </View>

      {error ? <Notice tone="danger" message={error} style={{ marginBottom: 18 }} /> : null}

      <SectionHeader title="About you" />
      <TextField
        label="Full name"
        icon={UserRound}
        value={fullName}
        onChangeText={setFullName}
        autoCapitalize="words"
        maxLength={150}
      />
      <SelectField
        label="Department"
        icon={Building2}
        value={department}
        options={DEPARTMENTS}
        onChange={setDepartment}
        placeholder="Choose your department"
      />
      <SelectField
        label="Programme and year"
        icon={GraduationCap}
        value={programYear}
        options={PROGRAM_YEARS}
        onChange={setProgramYear}
        placeholder="Choose your programme"
      />
      <TextField
        label="Hostel"
        optional
        icon={BedDouble}
        value={hostel}
        onChangeText={setHostel}
        placeholder="e.g. Brahmaputra"
      />
      <TextField
        label="Phone"
        optional
        icon={Phone}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        maxLength={15}
        placeholder="10-digit mobile number"
        hint="Only the admin office can see it."
      />

      <SectionHeader title="Account" />
      <View style={styles.locked}>
        <Lock size={16} color={colors.textMuted} />
        <View style={{ flex: 1 }}>
          <Text variant="footnote" color="textSecondary">
            {user.email}
          </Text>
          <Text variant="footnote" color="textSecondary">
            {user.registration_number}
          </Text>
        </View>
      </View>
      <Text variant="caption" color="textMuted" style={{ marginTop: 8 }}>
        Your email and registration number identify you and can't be changed.
      </Text>

      <OptionSheet
        visible={photoSheet}
        onClose={() => setPhotoSheet(false)}
        title="Profile photo"
        options={[
          { value: "camera", label: "Take a photo", icon: Camera },
          { value: "gallery", label: "Choose from gallery", icon: Images },
        ]}
        onSelect={(choice) => setTimeout(() => pick(choice as "camera" | "gallery"), 250)}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  photoRow: { alignItems: "center", marginBottom: 24, marginTop: 4 },
  camera: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  locked: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
  },
});
