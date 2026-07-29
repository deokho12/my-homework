import { Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PartnerInquiryScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <Stack.Screen options={{ title: '병원 입점 문의' }} />
      <View className="flex-1 items-center justify-center px-5">
        <Text className="text-center text-sm text-neutral-500">문의 폼은 준비중입니다</Text>
      </View>
    </SafeAreaView>
  );
}
