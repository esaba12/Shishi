module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Reanimated 4 moved its babel plugin into react-native-worklets; react-native-reanimated/plugin
    // is now just a compat shim that requires it, so reference it directly.
    plugins: ["react-native-worklets/plugin"],
  };
};
