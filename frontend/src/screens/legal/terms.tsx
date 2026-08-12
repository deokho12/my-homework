import { Stack } from '@/navigation';
import { Text, View } from '@/primitives';
import { SafeAreaView } from '@/primitives';

export default function TermsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <Stack.Screen options={{ title: '서비스 이용약관' }} />
      <View className="flex-1 items-center justify-center px-5">
        <Text className="text-sm text-neutral-500">준비중입니다</Text>
      </View>
    </SafeAreaView>
  );
}
