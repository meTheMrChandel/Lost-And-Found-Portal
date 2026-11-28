import { NavigationProp, ParamListBase } from "@react-navigation/native";

/**
 * Back for screens with their own close or back button. Opened from a sticker link or a
 * notification, a screen can be the first in the stack; then go to the home tab rather than
 * doing nothing.
 */
export function goBackOrHome(navigation: NavigationProp<ParamListBase>) {
  if (navigation.canGoBack()) navigation.goBack();
  else navigation.navigate("Main", { screen: "Home" });
}
