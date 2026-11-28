import React, { useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { colors } from "../theme/colors";
import { radii } from "../theme/tokens";
import { OptionSheet } from "./BottomSheet";
import { Camera, ImagePlus, Images, X } from "./icons";
import { Text } from "./Text";

export interface PickedPhoto {
  uri: string;
  name: string;
  type: string;
}

/** Longest side sent to the server; keeps uploads small and well under its 5 MB limit. */
const MAX_SIDE = 1600;

/** Re-encodes a picked photo as a JPEG no larger than maxSide on its longest edge. */
export async function shrinkPhoto(
  asset: ImagePicker.ImagePickerAsset,
  index = 0,
  maxSide = MAX_SIDE,
): Promise<PickedPhoto> {
  const context = ImageManipulator.manipulate(asset.uri);
  const longest = Math.max(asset.width || 0, asset.height || 0);
  if (longest > maxSide) {
    context.resize(asset.width >= asset.height ? { width: maxSide } : { height: maxSide });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.72, format: SaveFormat.JPEG });
  return { uri: saved.uri, name: `photo_${Date.now()}_${index}.jpg`, type: "image/jpeg" };
}

/** Adds photos to a multipart form the way the API expects them. */
export function appendPhotos(form: FormData, photos: PickedPhoto[], field = "images") {
  photos.forEach((photo) => form.append(field, { uri: photo.uri, name: photo.name, type: photo.type } as any));
}

interface PhotoPickerProps {
  photos: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
  max?: number;
}

/** Up to `max` photos from the camera or gallery, shown as removable thumbnails. */
export const PhotoPicker: React.FC<PhotoPickerProps> = ({ photos, onChange, max = 5 }) => {
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const remaining = max - photos.length;

  const addAssets = async (assets: ImagePicker.ImagePickerAsset[]) => {
    setBusy(true);
    try {
      const prepared = await Promise.all(assets.slice(0, remaining).map((asset, i) => shrinkPhoto(asset, i)));
      onChange([...photos, ...prepared].slice(0, max));
    } catch {
      Alert.alert("Couldn't add that photo", "Please try a different photo.");
    } finally {
      setBusy(false);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Camera access is off",
        "Allow camera access in Settings to take a photo of the item.",
        permission.canAskAgain
          ? [{ text: "OK" }]
          : [
              { text: "Not now", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() },
            ],
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
    if (!result.canceled && result.assets?.length) await addAssets(result.assets);
  };

  const pickFromGallery = async () => {
    // The system photo picker needs no storage permission
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: remaining > 1,
      selectionLimit: remaining,
      quality: 1,
    });
    if (!result.canceled && result.assets?.length) await addAssets(result.assets);
  };

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {photos.map((photo, index) => (
          <View key={photo.uri} style={styles.thumbWrap}>
            <Image source={{ uri: photo.uri }} style={styles.thumb} contentFit="cover" transition={150} />
            {index === 0 ? (
              <View style={styles.coverTag}>
                <Text style={styles.coverText}>Cover</Text>
              </View>
            ) : null}
            <Pressable
              onPress={() => onChange(photos.filter((p) => p.uri !== photo.uri))}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${index + 1}`}
              style={styles.remove}
            >
              <X size={13} color={colors.textWhite} strokeWidth={3} />
            </Pressable>
          </View>
        ))}
        {remaining > 0 ? (
          <Pressable
            onPress={() => setSheet(true)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Add photos"
            style={({ pressed }) => [styles.add, pressed && { backgroundColor: colors.primarySoft }]}
          >
            {busy ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <ImagePlus size={24} color={colors.primary} strokeWidth={1.8} />
                <Text variant="caption" color="primary">
                  {photos.length ? "Add more" : "Add photos"}
                </Text>
              </>
            )}
          </Pressable>
        ) : null}
      </ScrollView>
      <Text variant="caption" color="textMuted" style={{ marginTop: 8 }}>
        {photos.length}/{max} photos · clear photos help people recognise the item
      </Text>

      <OptionSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Add a photo"
        options={[
          { value: "camera", label: "Take a photo", icon: Camera },
          { value: "gallery", label: "Choose from gallery", icon: Images },
        ]}
        onSelect={(choice) => {
          // Let the sheet close before the system screen opens over it
          setTimeout(() => (choice === "camera" ? takePhoto() : pickFromGallery()), 250);
        }}
      />
    </>
  );
};

const THUMB = 92;

const styles = StyleSheet.create({
  // Room for the remove buttons, which poke out past each thumbnail's corner
  row: { gap: 12, paddingTop: 8, paddingRight: 8, paddingBottom: 2 },
  thumbWrap: { width: THUMB, height: THUMB },
  thumb: { width: THUMB, height: THUMB, borderRadius: radii.md, backgroundColor: colors.surfaceAlt },
  coverTag: {
    position: "absolute",
    left: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(28,28,30,0.72)",
  },
  coverText: { fontSize: 10, lineHeight: 13, color: colors.textWhite, fontWeight: "600" },
  remove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.charcoal,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  add: {
    width: THUMB,
    height: THUMB,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
});
