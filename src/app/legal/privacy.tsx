import { Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PrivacyScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <Stack.Screen options={{ title: '개인정보 처리방침' }} />
      <View className="flex-1 items-center justify-center px-5">
        <Text className="text-sm text-neutral-500">준비중입니다</Text>
      </View>
    </SafeAreaView>
  );
}
