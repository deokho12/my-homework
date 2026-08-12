import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { router, Stack, useLocalSearchParams } from '@/navigation';
import { Pressable, ScrollView, Text, View } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/features/auth/components/TextField';
import { applyServerFieldErrors, formErrorMessage } from '@/features/auth/lib/serverFieldErrors';
import { loginSchema, type LoginInput } from '@/features/auth/schemas/authSchemas';
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

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    // 제출 시 검사한다. 타이핑 중에 빨간 글씨가 따라다니지 않게 한다.
    mode: 'onSubmit',
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginInput) => {
    const result = await logIn(values);

    if (!result.ok) {
      // 서버가 `422` 로 필드별 사유를 주면 그 칸 아래에 붙인다. 그 밖의 오류
      // (`INVALID_CREDENTIALS`, `RATE_LIMITED`, 네트워크)는 어느 칸의 문제도 아니므로
      // 폼 전체 오류로 둔다.
      if (!applyServerFieldErrors(result.error, setError, ['email', 'password'])) {
        setError('root.serverError', { message: formErrorMessage(result.error) });
      }

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

        <form
          noValidate
          onSubmit={(event) => {
            clearErrors('root.serverError');
            void handleSubmit(onSubmit)(event);
          }}
        >
          <TextField
            id="login-email"
            label="이메일"
            type="email"
            autoComplete="email"
            placeholder="example@email.com"
            error={errors.email?.message}
            {...register('email')}
          />

          <TextField
            id="login-password"
            label="비밀번호"
            type="password"
            autoComplete="current-password"
            placeholder="비밀번호"
            error={errors.password?.message}
            {...register('password')}
          />

          {errors.root?.serverError?.message ? (
            <p role="alert" className="mb-3 text-sm text-rose-500">
              {errors.root.serverError.message}
            </p>
          ) : null}

          <div className="mb-6 mt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-3.5 text-base font-semibold text-white active:bg-brand-700 disabled:opacity-40"
            >
              {isSubmitting ? '로그인 중' : '로그인'}
            </button>
          </div>
        </form>

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
