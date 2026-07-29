import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuthStore } from '@/store/useAuthStore';
import type { AuthProvider } from '@/types/domain';
import { showAlert } from '@/utils/alert';

function comingSoon(provider: AuthProvider) {
  const label = provider === 'google' ? '구글' : '카카오';
  showAlert('준비중이에요', `${label} 로그인은 다음 업데이트에서 지원할 예정이에요.`);
}

export default function LoginScreen() {
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const logIn = useAuthStore((state) => state.logIn);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  const handleSubmit = () => {
    const result = logIn({ email, password });
    if (!result.ok) {
      setError(result.message);
      return;
    }

    if (redirect) {
      // Redirect is an internal path we built ourselves (e.g. /consult/h1); safe to hand back to the router.
      router.replace(redirect as never);
    } else {
      router.back();
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <Stack.Screen options={{ title: '로그인' }} />
      <ScrollView contentContainerClassName="px-5 pb-8 pt-6" keyboardShouldPersistTaps="handled">
        <Text className="mb-1 text-2xl font-extrabold text-neutral-900">로그인</Text>
        <Text className="mb-6 text-sm text-neutral-500">
          로그인하고 찜한 병원과 상담 신청 내역을 관리해보세요
        </Text>

        <Text className="mb-2 text-sm font-semibold text-neutral-700">이메일</Text>
        <TextInput
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setError(null);
          }}
          placeholder="example@email.com"
          autoCapitalize="none"
          keyboardType="email-address"
          className="mb-4 rounded-xl border border-neutral-200 px-4 py-3 text-[15px]"
        />

        <Text className="mb-2 text-sm font-semibold text-neutral-700">비밀번호</Text>
        <TextInput
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setError(null);
          }}
          placeholder="비밀번호"
          secureTextEntry
          className="mb-2 rounded-xl border border-neutral-200 px-4 py-3 text-[15px]"
        />

        {error ? <Text className="mb-3 text-sm text-rose-500">{error}</Text> : null}

        <View className="mb-6 mt-2">
          <PrimaryButton label="로그인" onPress={handleSubmit} disabled={!canSubmit} />
        </View>

        <Pressable
          onPress={() =>
            router.push({ pathname: '/auth/signup', params: redirect ? { redirect } : {} })
          }
          className="mb-8 items-center"
        >
          <Text className="text-sm text-neutral-500">
            아직 계정이 없으신가요? <Text className="font-semibold text-brand-700">회원가입</Text>
          </Text>
        </Pressable>

        <View className="mb-3 flex-row items-center">
          <View className="h-px flex-1 bg-neutral-100" />
          <Text className="mx-3 text-xs text-neutral-400">간편 로그인 (준비중)</Text>
          <View className="h-px flex-1 bg-neutral-100" />
        </View>

        <View className="gap-2">
          <PrimaryButton label="구글로 계속하기" variant="outline" onPress={() => comingSoon('google')} />
          <PrimaryButton label="카카오로 계속하기" variant="outline" onPress={() => comingSoon('kakao')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
