/**
 * Gives the Android theme the app's emerald as its accent colour, so system dialogs the app
 * opens (alerts, the date and time pickers) match it instead of AppCompat's default teal.
 */
const { AndroidConfig, withAndroidColors, withAndroidStyles } = require("expo/config-plugins");

const ACCENT = "#047857";

module.exports = function withAccentColor(config) {
  config = withAndroidColors(config, (mod) => {
    mod.modResults = AndroidConfig.Colors.assignColorValue(mod.modResults, { name: "colorAccent", value: ACCENT });
    return mod;
  });
  return withAndroidStyles(config, (mod) => {
    mod.modResults = AndroidConfig.Styles.assignStylesValue(mod.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: "colorAccent",
      value: "@color/colorAccent",
    });
    return mod;
  });
};
