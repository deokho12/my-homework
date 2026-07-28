import { router } from 'expo-router';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HospitalCard } from '@/components/HospitalCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { getHospitalById } from '@/data/hospitals';
import { useAuthStore } from '@/store/useAuthStore';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import type { Hospital } from '@/types/domain';

function AuthCard() {
  const user = useAuthStore((state) => state.user);
  const logOut = useAuthStore((state) => state.logOut);

  if (!user) {
    return (
      <View className="mb-6 rounded-2xl border border-neutral-100 bg-white p-5">
        <Text className="mb-1 text-base font-bold text-neutral-900">로그인이 필요해요</Text>
        <Text className="mb-4 text-sm text-neutral-500">
          로그인하면 찜한 병원과 상담 신청 내역을 확인할 수 있어요
        </Text>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <PrimaryButton label="로그인" onPress={() => router.push('/auth/login')} />
          </View>
          <View className="flex-1">
            <PrimaryButton
              label="회원가입"
              variant="outline"
              onPress={() => router.push('/auth/signup')}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="mb-6 rounded-2xl border border-neutral-100 bg-white p-5">
      <Text className="mb-1 text-base font-bold text-neutral-900">{user.name}님, 안녕하세요</Text>
      <Text className="mb-4 text-sm text-neutral-500">{user.email}</Text>
      <Pressable
        onPress={() =>
          Alert.alert('로그아웃', '로그아웃할까요?', [
            { text: '취소', style: 'cancel' },
            { text: '로그아웃', style: 'destructive', onPress: logOut },
          ])
        }
        className="items-center rounded-xl border border-neutral-200 py-3"
      >
        <Text className="text-sm font-semibold text-neutral-600">로그아웃</Text>
      </Pressable>
    </View>
  );
}

export default function MyPageScreen() {
  const user = useAuthStore((state) => state.user);
  const hospitalIds = useFavoritesStore((state) => state.hospitalIds);
  const favoriteHospitals = hospitalIds
    .map((id) => getHospitalById(id))
    .filter((hospital): hospital is Hospital => Boolean(hospital));

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
      <FlatList
        data={user ? favoriteHospitals : []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <HospitalCard hospital={item} />}
        contentContainerClassName="px-5 pb-8 pt-3"
        ListHeaderComponent={
          <View>
            <Text className="mb-4 text-2xl font-extrabold text-neutral-900">마이페이지</Text>
            <AuthCard />
            {user ? <Text className="mb-3 text-lg font-bold text-neutral-900">찜한 병원</Text> : null}
          </View>
        }
        ListEmptyComponent={
          user ? (
            <View className="items-center px-8 py-12">
              <Text className="mb-2 text-4xl">🤍</Text>
              <Text className="text-center text-sm text-neutral-500">
                아직 찜한 병원이 없어요{'\n'}병원 카드의 하트를 눌러 찜해보세요
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
