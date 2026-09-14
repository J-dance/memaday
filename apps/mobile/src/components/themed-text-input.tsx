import { TextInput, type TextInputProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

// Plain `<TextInput>` has no default text color of its own on web — it
// inherits the browser's default (black), which is invisible against this
// app's dark theme. Every text field in the app should use this instead of
// importing TextInput directly from react-native.
export function ThemedTextInput({ style, ...rest }: TextInputProps) {
  const theme = useTheme();

  return (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      style={[{ color: theme.text }, style]}
      {...rest}
    />
  );
}
