import React, { useEffect, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { itemsApi } from "../../api/items";
import { Category, postsApi } from "../../api/posts";
import { errorMessage } from "../../api/client";
import { Button, haptics, Notice, Screen, SelectField, Text, TextField, useToast } from "../../ui";
import { Hash, LockKeyhole, QrCode, Tag } from "../../ui/icons";
import { categoryIcon } from "../../utils/categories";

type Props = NativeStackScreenProps<RootStackParamList, "RegisterValuable">;

export const RegisterValuableScreen: React.FC<Props> = ({ navigation }) => {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [serial, setSerial] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    postsApi
      .getCategories()
      .then(setCategories)
      .catch(() => setFormError("Couldn't load categories. Go back and try again."));
  }, []);

  const save = async () => {
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'Give it a name, e.g. "Blue Hero bicycle".';
    if (!category) next.category = "Choose a category.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    setFormError("");
    try {
      await itemsApi.registerItem({
        name: name.trim(),
        category: category!,
        description: description.trim(),
        serial_number: serial.trim(),
      });
      haptics.success();
      toast.show(`${name.trim()} is registered. Its QR sticker is ready.`);
      navigation.goBack();
    } catch (err: any) {
      setFormError(errorMessage(err, "Couldn't register the item."));
      setSaving(false);
    }
  };

  return (
    <Screen
      scroll
      footer={<Button title="Register item" icon={QrCode} size="lg" fullWidth loading={saving} onPress={save} />}
    >
      <Text variant="callout" color="textSecondary" style={{ marginBottom: 20 }}>
        You'll get a QR sticker for it. If it's ever lost, whoever finds it can scan the sticker and message you.
      </Text>
      {formError ? <Notice tone="danger" message={formError} style={{ marginBottom: 16 }} /> : null}
      <TextField
        label="Item name"
        placeholder="e.g. Blue Hero bicycle"
        value={name}
        onChangeText={(t) => {
          setName(t);
          if (errors.name) setErrors((e) => ({ ...e, name: "" }));
        }}
        error={errors.name}
        maxLength={200}
        autoCapitalize="sentences"
      />
      <SelectField
        label="Category"
        placeholder="Choose a category"
        icon={Tag}
        value={category}
        options={categories.map((c) => ({ value: c.slug, label: c.name, icon: categoryIcon(c.slug) }))}
        onChange={(value) => {
          setCategory(value);
          setErrors((e) => ({ ...e, category: "" }));
        }}
        error={errors.category}
      />
      <TextField
        label="Serial or frame number"
        optional
        icon={Hash}
        placeholder="e.g. SN-88219-X99"
        value={serial}
        onChangeText={setSerial}
        autoCapitalize="characters"
        maxLength={100}
        hint="Private. It helps the admin office confirm the item is yours."
      />
      <TextField
        label="Distinguishing features"
        optional
        placeholder="e.g. Matte blue frame, bell on the left handlebar"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={500}
      />
      <Notice
        tone="neutral"
        icon={LockKeyhole}
        message="People who scan the sticker see the item's name, its category and your name. Never your phone number or email."
      />
    </Screen>
  );
};
