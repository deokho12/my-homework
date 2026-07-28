import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuthStore } from '@/store/useAuthStore';

export default function SignUpScreen() {
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const signUp = useAuthStore((state) => state.signUp);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    name.trim().length > 0 && email.trim().length > 0 && password.length >= 6 && passwordConfirm.length > 0;

  const handleSubmit = () => {
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 해요');
      return;
    }
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않아요');
      return;
    }

    const result = signUp({ name, email, password });
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
      <Stack.Screen options={{ title: '회원가입' }} />
      <ScrollView contentContainerClassName="px-5 pb-8 pt-6" keyboardShouldPersistTaps="handled">
        <Text className="mb-1 text-2xl font-extrabold text-neutral-900">회원가입</Text>
        <Text className="mb-6 text-sm text-neutral-500">몰라몰라에서 나에게 맞는 병원을 찾아보세요</Text>

        <Text className="mb-2 text-sm font-semibold text-neutral-700">이름</Text>
        <TextInput
          value={name}
          onChangeText={(text) => {
            setName(text);
            setError(null);
          }}
          placeholder="이름을 입력해주세요"
          className="mb-4 rounded-xl border border-neutral-200 px-4 py-3 text-[15px]"
        />

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
          placeholder="6자 이상 입력해주세요"
          secureTextEntry
          className="mb-4 rounded-xl border border-neutral-200 px-4 py-3 text-[15px]"
        />

        <Text className="mb-2 text-sm font-semibold text-neutral-700">비밀번호 확인</Text>
        <TextInput
          value={passwordConfirm}
          onChangeText={(text) => {
            setPasswordConfirm(text);
            setError(null);
          }}
          placeholder="비밀번호를 다시 입력해주세요"
          secureTextEntry
          className="mb-2 rounded-xl border border-neutral-200 px-4 py-3 text-[15px]"
        />

        {error ? <Text className="mb-3 text-sm text-rose-500">{error}</Text> : null}

        <View className="mt-4">
          <PrimaryButton label="가입하기" onPress={handleSubmit} disabled={!canSubmit} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
