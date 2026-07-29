import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

export function SearchBar() {
  return (
    <Pressable
      onPress={() => router.push('/search')}
      className="flex-row items-center rounded-full border border-neutral-200 bg-white px-5 py-4"
    >
      <Text className="mr-2 text-base">🔍</Text>
      <View className="flex-1">
        <Text className="text-[15px] text-neutral-400">임플란트, 교정 같은 시술을 검색해보세요</Text>
      </View>
    </Pressable>
  );
}
