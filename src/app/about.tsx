import { Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AboutScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <Stack.Screen options={{ title: '몰라몰라 알아보기' }} />
      <View className="flex-1 items-center justify-center px-5">
        <Text className="text-sm text-neutral-500">준비중입니다</Text>
      </View>
    </SafeAreaView>
  );
}
