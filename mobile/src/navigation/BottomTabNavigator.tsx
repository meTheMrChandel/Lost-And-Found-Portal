import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { BottomTabBarProps, createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MainTabParamList } from "./types";
import { ReportChooser } from "../components/ReportChooser";
import { FeedScreen } from "../screens/feed/FeedScreen";
import { MyReportsScreen } from "../screens/reports/MyReportsScreen";
import { ChatListScreen } from "../screens/chat/ChatListScreen";
import { ProfileScreen } from "../screens/profile/ProfileScreen";
import { AdminHomeScreen } from "../screens/admin/AdminHomeScreen";
import { useAuth } from "../context/AuthContext";
import { useActivity } from "../context/ActivityContext";
import { haptics, PressableScale, Text } from "../ui";
import { ClipboardList, House, IconType, MessageCircle, Plus, ShieldCheck, UserRound } from "../ui/icons";
import { colors } from "../theme/colors";
import { radii, shadows } from "../theme/tokens";

const Tab = createBottomTabNavigator<MainTabParamList>();

const TABS: Record<keyof MainTabParamList, { label: string; icon: IconType }> = {
  Home: { label: "Home", icon: House },
  Activity: { label: "My reports", icon: ClipboardList },
  Report: { label: "Report", icon: Plus },
  Inbox: { label: "Messages", icon: MessageCircle },
  Account: { label: "Profile", icon: UserRound },
  Admin: { label: "Admin", icon: ShieldCheck },
};

/** Placeholder for the centre button, which opens a sheet instead of a screen. */
const Nothing: React.FC = () => null;

const TabItem: React.FC<{
  label: string;
  icon: IconType;
  focused: boolean;
  badge?: number;
  onPress: () => void;
  onLongPress: () => void;
}> = ({ label, icon: Icon, focused, badge, onPress, onLongPress }) => {
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(progress, { toValue: focused ? 1 : 0, useNativeDriver: true, speed: 24, bounciness: 6 }).start();
  }, [focused, progress]);

  const color = focused ? colors.primary : colors.textMuted;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tab}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={badge ? `${label}, ${badge} unread` : label}
    >
      <View style={styles.iconWrap}>
        <Animated.View
          style={[
            styles.indicator,
            {
              opacity: progress,
              transform: [{ scaleX: progress.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
            },
          ]}
        />
        <Icon size={22} color={color} strokeWidth={focused ? 2.3 : 1.9} />
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.label, { color, fontWeight: focused ? "600" : "500" }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
};

const AppTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const insets = useSafeAreaInsets();
  const { unreadMessages } = useActivity();
  const [sheet, setSheet] = useState(false);

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {state.routes.map((route, index) => {
        const name = route.name as keyof MainTabParamList;
        const focused = state.index === index;

        if (name === "Report") {
          return (
            <View key={route.key} style={styles.tab}>
              <PressableScale
                onPress={() => {
                  haptics.tap();
                  setSheet(true);
                }}
                scaleTo={0.9}
                accessibilityRole="button"
                accessibilityLabel="Report a lost or found item"
                style={styles.reportButton}
              >
                <Plus size={26} color={colors.textWhite} strokeWidth={2.6} />
              </PressableScale>
              <Text style={[styles.label, { color: colors.textSecondary, fontWeight: "500" }]}>Report</Text>
            </View>
          );
        }

        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };
        const onLongPress = () => navigation.emit({ type: "tabLongPress", target: route.key });

        return (
          <TabItem
            key={route.key}
            label={TABS[name].label}
            icon={TABS[name].icon}
            focused={focused}
            badge={name === "Inbox" ? unreadMessages : undefined}
            onPress={onPress}
            onLongPress={onLongPress}
          />
        );
      })}

      <ReportChooser visible={sheet} onClose={() => setSheet(false)} />
    </View>
  );
};

export const BottomTabNavigator: React.FC = () => {
  const { user } = useAuth();
  const staff = !!user?.is_staff;

  return (
    <Tab.Navigator
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
    >
      <Tab.Screen name="Home" component={FeedScreen} />
      {/* Admins moderate from here; their own reports stay one tap away in Profile */}
      {staff ? (
        <Tab.Screen name="Admin" component={AdminHomeScreen} />
      ) : (
        <Tab.Screen name="Activity" component={MyReportsScreen} />
      )}
      <Tab.Screen name="Report" component={Nothing} />
      <Tab.Screen name="Inbox" component={ChatListScreen} />
      <Tab.Screen name="Account" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 4 },
  iconWrap: { width: 56, height: 30, alignItems: "center", justifyContent: "center" },
  indicator: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: radii.pill,
    backgroundColor: colors.primaryTint,
  },
  label: { fontSize: 11, lineHeight: 14 },
  badge: {
    position: "absolute",
    top: -2,
    right: 8,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.lost,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.textWhite, fontSize: 9, lineHeight: 11, fontWeight: "700" },
  reportButton: {
    width: 50,
    height: 50,
    marginTop: -24,
    borderRadius: 25,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: colors.surface,
    ...shadows.floating,
  },
});
