import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { colors } from "../theme/colors";
import { radii } from "../theme/tokens";
import { BottomSheet, OptionSheet, SheetOption } from "./BottomSheet";
import { Button } from "./Button";
import { CalendarClock, ChevronDown, IconType } from "./icons";
import { Text } from "./Text";

interface FieldShellProps {
  label?: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  icon?: IconType;
  display?: string;
  placeholder?: string;
  onPress: () => void;
  trailing?: IconType;
}

/** A tappable field that looks like a TextField and opens a picker. */
const FieldShell: React.FC<FieldShellProps> = ({
  label,
  optional,
  hint,
  error,
  icon: Icon,
  display,
  placeholder,
  onPress,
  trailing: Trailing = ChevronDown,
}) => (
  <View style={styles.container}>
    {label ? (
      <View style={styles.labelRow}>
        <Text variant="subhead">{label}</Text>
        {optional ? (
          <Text variant="caption" color="textMuted">
            Optional
          </Text>
        ) : null}
      </View>
    ) : null}
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label ? `${label}: ${display || placeholder || ""}` : display}
      style={({ pressed }) => [
        styles.field,
        { borderColor: error ? colors.danger : colors.border },
        pressed && { backgroundColor: colors.surfacePressed },
      ]}
    >
      {Icon ? <Icon size={19} color={display ? colors.primary : colors.textMuted} strokeWidth={2} /> : null}
      <Text variant="body" color={display ? "textPrimary" : "textMuted"} style={{ flex: 1 }} numberOfLines={1}>
        {display || placeholder}
      </Text>
      <Trailing size={18} color={colors.textSecondary} />
    </Pressable>
    {error || hint ? (
      <Text variant="caption" color={error ? "danger" : "textSecondary"} style={styles.footer}>
        {error || hint}
      </Text>
    ) : null}
  </View>
);

interface SelectFieldProps<T extends string> {
  label?: string;
  placeholder?: string;
  value?: T | null;
  options: SheetOption<T>[];
  onChange: (value: T) => void;
  sheetTitle?: string;
  sheetSubtitle?: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  icon?: IconType;
}

/** Pick one value from a list shown in a bottom sheet. */
export function SelectField<T extends string>({
  label,
  placeholder = "Select",
  value,
  options,
  onChange,
  sheetTitle,
  sheetSubtitle,
  optional,
  hint,
  error,
  icon,
}: SelectFieldProps<T>) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <FieldShell
        label={label}
        optional={optional}
        hint={hint}
        error={error}
        icon={current?.icon || icon}
        display={current?.label}
        placeholder={placeholder}
        onPress={() => setOpen(true)}
      />
      <OptionSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={sheetTitle || label}
        subtitle={sheetSubtitle}
        options={options}
        selected={value}
        onSelect={onChange}
      />
    </>
  );
}

/** "Today, 4:30 pm", "Yesterday, 9:05 am" or "Mon 24 Nov, 6:00 pm". */
export function formatWhen(date: Date): string {
  const now = new Date();
  const time = date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  const day = date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
  return `${day}, ${time}`;
}

interface DateTimeFieldProps {
  label?: string;
  value: Date;
  onChange: (date: Date) => void;
  /** Latest allowed moment; defaults to now, since reports are about the past. */
  maximumDate?: Date;
  hint?: string;
  error?: string;
}

/** A date then a time, picked with the platform's own dialogs. */
export const DateTimeField: React.FC<DateTimeFieldProps> = ({ label, value, onChange, maximumDate, hint, error }) => {
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState(value);

  const clamp = (date: Date) => {
    const max = maximumDate || new Date();
    return date.getTime() > max.getTime() ? max : date;
  };

  const openAndroid = () => {
    DateTimePickerAndroid.open({
      value,
      mode: "date",
      maximumDate: maximumDate || new Date(),
      onValueChange: (_event, picked) => {
        if (!picked) return;
        const day = new Date(value);
        day.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
        // Then the time; keeping the date alone if the clock is dismissed
        DateTimePickerAndroid.open({
          value: clamp(day),
          mode: "time",
          onValueChange: (_e, time) => {
            if (!time) return;
            const full = new Date(day);
            full.setHours(time.getHours(), time.getMinutes(), 0, 0);
            onChange(clamp(full));
          },
          onDismiss: () => onChange(clamp(day)),
        });
      },
    });
  };

  return (
    <>
      <FieldShell
        label={label}
        hint={hint}
        error={error}
        icon={CalendarClock}
        display={formatWhen(value)}
        trailing={ChevronDown}
        onPress={() => {
          if (Platform.OS === "android") openAndroid();
          else {
            setIosDraft(value);
            setIosOpen(true);
          }
        }}
      />
      {Platform.OS === "ios" ? (
        <BottomSheet visible={iosOpen} onClose={() => setIosOpen(false)} title={label}>
          <DateTimePicker
            value={iosDraft}
            mode="datetime"
            display="spinner"
            maximumDate={maximumDate || new Date()}
            onValueChange={(_e, date) => date && setIosDraft(date)}
          />
          <Button
            title="Done"
            onPress={() => {
              onChange(clamp(iosDraft));
              setIosOpen(false);
            }}
            style={{ marginTop: 12 }}
          />
        </BottomSheet>
      ) : null}
    </>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 18 },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 52,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
  },
  footer: { marginTop: 6 },
});
