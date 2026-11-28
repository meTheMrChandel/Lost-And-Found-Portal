import React, { useEffect, useRef, useState } from "react";
import { Alert, Animated, Easing, Pressable, StyleSheet, Switch, View } from "react-native";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { Category, postsApi } from "../../api/posts";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import {
  appendPhotos,
  Button,
  DateTimeField,
  EmptyState,
  haptics,
  Notice,
  PhotoPicker,
  PickedPhoto,
  Screen,
  SectionHeader,
  SelectField,
  Text,
  TextField,
  useToast,
} from "../../ui";
import {
  Building2,
  Check,
  CircleCheck,
  Hand,
  LockKeyhole,
  MapPin,
  QrCode,
  ShieldCheck,
  Tag,
  UserRound,
} from "../../ui/icons";
import { colors } from "../../theme/colors";
import { radii } from "../../theme/tokens";
import { categoryIcon } from "../../utils/categories";

type Kind = "lost" | "found";
type Custody = "finder" | "admin_office" | "security_office";

const CUSTODY_OPTIONS: { value: Custody; title: string; body: string; icon: typeof Hand }[] = [
  { value: "finder", title: "I still have it", body: "Keep it safe until the owner is verified", icon: Hand },
  {
    value: "admin_office",
    title: "Handed to the admin office",
    body: "Left with the academic block office",
    icon: Building2,
  },
  {
    value: "security_office",
    title: "Handed to security",
    body: "Deposited at the main gate security office",
    icon: ShieldCheck,
  },
];

const COPY = {
  lost: {
    whenLabel: "When did you last have it?",
    whereLabel: "Where did you last see it?",
    wherePlaceholder: "e.g. Central Library, 2nd floor",
    titlePlaceholder: "e.g. Black Dell laptop",
    descriptionPlaceholder: "Colour, brand, size, stickers, scratches, anything that helps",
    submit: "Submit lost report",
    doneTitle: "Report submitted",
    doneBody:
      "An admin will review it shortly, usually within a day. Once it's live we'll check new found reports against it and notify you about possible matches.",
  },
  found: {
    whenLabel: "When did you find it?",
    whereLabel: "Where did you find it?",
    wherePlaceholder: "e.g. Sports complex, near the courts",
    titlePlaceholder: "e.g. Blue steel water bottle",
    descriptionPlaceholder:
      "What it looks like and the condition it's in. Leave out details only the owner would know.",
    submit: "Submit found report",
    doneTitle: "Thank you for helping",
    doneBody:
      "An admin will review your report shortly. The owner will be asked to prove it's theirs before anything is handed over, and we'll keep you posted.",
  },
};

interface ReportFormProps {
  kind: Kind;
  /** Prefill from a scanned QR sticker. */
  initialTitle?: string;
  initialCategory?: string;
  qrUuid?: string;
}

/** The lost and found report forms, which share most of their fields. */
export const ReportForm: React.FC<ReportFormProps> = ({ kind, initialTitle, initialCategory, qrUuid }) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const toast = useToast();
  const copy = COPY[kind];

  const [categories, setCategories] = useState<Category[]>([]);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [title, setTitle] = useState(initialTitle || "");
  const [category, setCategory] = useState<string | null>(null);
  const [when, setWhen] = useState(() => new Date());
  const [place, setPlace] = useState("");
  const [description, setDescription] = useState("");
  const [proof, setProof] = useState("");
  const [reward, setReward] = useState("");
  const [custody, setCustody] = useState<Custody>("finder");
  const [privateReport, setPrivateReport] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    postsApi
      .getCategories()
      .then(setCategories)
      .catch(() => toast.show("Couldn't load categories. Pull back and try again.", "error"));
  }, [toast]);

  // A scanned sticker names its category; pick it once the list has loaded
  useEffect(() => {
    if (!initialCategory || categories.length === 0) return;
    const wanted = initialCategory.toLowerCase();
    const match = categories.find((c) => c.slug.toLowerCase() === wanted || c.name.toLowerCase() === wanted);
    if (match) setCategory(match.slug);
  }, [initialCategory, categories]);

  const dirty =
    !submitted &&
    (photos.length > 0 ||
      description.trim() !== "" ||
      place.trim() !== "" ||
      proof.trim() !== "" ||
      (title.trim() !== "" && title !== initialTitle));

  // Don't lose a half-written report to a stray back swipe
  usePreventRemove(dirty && !submitting, ({ data }) => {
    Alert.alert("Discard this report?", "What you've entered so far will be lost.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const validate = () => {
    const next: Record<string, string> = {};
    if (title.trim().length < 3) next.title = "Give the item a short name (at least 3 characters).";
    if (!category) next.category = "Choose a category.";
    if (!place.trim()) next.place = "Say where, as precisely as you can.";
    if (description.trim().length < 10) next.description = "Add a few details (at least 10 characters).";
    if (reward.trim() && !/^\d{1,6}(\.\d{1,2})?$/.test(reward.trim()))
      next.reward = "Enter an amount in rupees, e.g. 500.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    setFormError("");
    if (!validate()) {
      haptics.error();
      setFormError("Some details need your attention.");
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("title", title.trim());
      form.append("category", category!);
      form.append("last_seen_place", place.trim());
      form.append("description", description.trim());
      form.append("last_seen_time", when.toISOString());
      if (kind === "lost") {
        if (proof.trim()) form.append("hidden_proof", proof.trim());
        if (reward.trim()) form.append("reward_amount", reward.trim());
        appendPhotos(form, photos);
        await postsApi.createLostPost(form);
      } else {
        form.append("custody_location", custody);
        form.append("inform_admin_privately", privateReport ? "true" : "false");
        if (qrUuid) form.append("qr_uuid", qrUuid);
        appendPhotos(form, photos);
        await postsApi.createFoundPost(form);
      }
      haptics.success();
      setSubmitted(true);
    } catch (err: any) {
      setFormError(errorMessage(err, "Couldn't submit your report. Please try again."));
      haptics.error();
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <Screen>
        <EmptyState
          icon={LockKeyhole}
          title="Sign in to report an item"
          body="Reports are tied to your institute account, so the admin office can verify them and keep you updated."
          actionLabel="Sign in"
          onAction={() => navigation.navigate("Auth")}
          style={{ flex: 1 }}
        />
      </Screen>
    );
  }

  if (submitted) {
    return <SubmittedView kind={kind} title={copy.doneTitle} body={copy.doneBody} />;
  }

  const categoryOptions = categories.map((c) => ({ value: c.slug, label: c.name, icon: categoryIcon(c.slug) }));

  return (
    <Screen scroll footer={<Button title={copy.submit} onPress={submit} loading={submitting} size="lg" fullWidth />}>
      {qrUuid ? (
        <Notice
          tone="success"
          icon={QrCode}
          title="Linked to a QR sticker"
          message="The owner will be notified as soon as you submit, and can message you in the app."
          style={styles.block}
        />
      ) : null}
      {formError ? <Notice tone="danger" message={formError} style={styles.block} /> : null}

      <SectionHeader title="Photos" />
      <View style={styles.block}>
        <PhotoPicker photos={photos} onChange={setPhotos} />
      </View>

      <SectionHeader title="The item" />
      <TextField
        label="What is it?"
        placeholder={copy.titlePlaceholder}
        value={title}
        onChangeText={(t) => {
          setTitle(t);
          if (errors.title) setErrors((e) => ({ ...e, title: "" }));
        }}
        error={errors.title}
        maxLength={120}
        autoCapitalize="sentences"
      />
      <SelectField
        label="Category"
        placeholder="Choose a category"
        icon={Tag}
        value={category}
        options={categoryOptions}
        onChange={(value) => {
          setCategory(value);
          setErrors((e) => ({ ...e, category: "" }));
        }}
        error={errors.category}
        sheetTitle="Choose a category"
      />
      <TextField
        label="Description"
        placeholder={copy.descriptionPlaceholder}
        value={description}
        onChangeText={(t) => {
          setDescription(t);
          if (errors.description) setErrors((e) => ({ ...e, description: "" }));
        }}
        error={errors.description}
        multiline
        maxLength={1000}
        showCount
      />

      <SectionHeader title="When and where" />
      <DateTimeField label={copy.whenLabel} value={when} onChange={setWhen} />
      <TextField
        label={copy.whereLabel}
        icon={MapPin}
        placeholder={copy.wherePlaceholder}
        value={place}
        onChangeText={(t) => {
          setPlace(t);
          if (errors.place) setErrors((e) => ({ ...e, place: "" }));
        }}
        error={errors.place}
        maxLength={300}
      />

      {kind === "lost" ? (
        <>
          <SectionHeader title="Proof it's yours" />
          <Notice
            tone="info"
            icon={LockKeyhole}
            message="Only the admin office sees this. They use it to check that whoever claims a found item is really you."
            style={{ marginBottom: 14 }}
          />
          <TextField
            label="Private details"
            optional
            placeholder="e.g. Lock screen is a mountain photo; serial number ends in 7QX"
            value={proof}
            onChangeText={setProof}
            multiline
            maxLength={500}
          />
          <TextField
            label="Reward"
            optional
            placeholder="0"
            value={reward}
            onChangeText={(t) => {
              setReward(t.replace(/[^\d.]/g, ""));
              if (errors.reward) setErrors((e) => ({ ...e, reward: "" }));
            }}
            error={errors.reward}
            keyboardType="decimal-pad"
            maxLength={9}
            hint="An optional thank-you, shown on your report."
            prefix="₹"
          />
        </>
      ) : (
        <>
          <SectionHeader title="Where is it now?" />
          <View style={[styles.block, { gap: 10 }]}>
            {CUSTODY_OPTIONS.map((option) => {
              const selected = custody === option.value;
              const Icon = option.icon;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    if (!selected) haptics.select();
                    setCustody(option.value);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[styles.option, selected && styles.optionSelected]}
                >
                  <View style={[styles.optionIcon, selected && { backgroundColor: colors.primarySoft }]}>
                    <Icon size={20} color={selected ? colors.primary : colors.textSecondary} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium">{option.title}</Text>
                    <Text variant="footnote" color="textSecondary">
                      {option.body}
                    </Text>
                  </View>
                  <View style={[styles.radio, selected && styles.radioOn]}>
                    {selected ? <Check size={13} color={colors.textWhite} strokeWidth={3} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.switchRow, styles.block]}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium">Only tell the admin office</Text>
              <Text variant="footnote" color="textSecondary">
                Keeps it off the public feed, e.g. for IDs or valuables.
              </Text>
            </View>
            <Switch
              value={privateReport}
              onValueChange={setPrivateReport}
              trackColor={{ false: colors.borderStrong, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>
        </>
      )}

      <View style={styles.signedAs}>
        <UserRound size={14} color={colors.textMuted} />
        <Text variant="caption" color="textMuted">
          Reporting as {user.full_name} ({user.registration_number})
        </Text>
      </View>
    </Screen>
  );
};

/** The confirmation shown in place of the form once a report is in. */
const SubmittedView: React.FC<{ kind: Kind; title: string; body: string }> = ({ kind, title, body }) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 10 }),
      Animated.timing(opacity, { toValue: 1, duration: 250, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  return (
    <Screen
      footer={
        <View style={{ gap: 10 }}>
          <Button
            title="View my reports"
            size="lg"
            fullWidth
            onPress={() =>
              user?.is_staff ? navigation.replace("MyReports") : navigation.navigate("Main", { screen: "Activity" })
            }
          />
          <Button
            title="Back to home"
            variant="secondary"
            size="lg"
            fullWidth
            onPress={() => navigation.navigate("Main", { screen: "Home" })}
          />
        </View>
      }
    >
      <View style={styles.done}>
        <Animated.View style={[styles.doneIcon, { opacity, transform: [{ scale }] }]}>
          <CircleCheck size={52} color={colors.primary} strokeWidth={1.8} />
        </Animated.View>
        <Text variant="title1" align="center">
          {title}
        </Text>
        <Text variant="body" color="textSecondary" align="center" style={styles.doneBody}>
          {body}
        </Text>
        {kind === "found" ? (
          <Notice
            tone="neutral"
            icon={ShieldCheck}
            message="If you still have the item, keep it safe. The admin office will tell you when and where to hand it over."
            style={{ marginTop: 24, alignSelf: "stretch" }}
          />
        ) : null}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  block: { marginBottom: 20 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  signedAs: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 4 },
  done: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  doneIcon: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  doneBody: { marginTop: 10, maxWidth: 340 },
});
