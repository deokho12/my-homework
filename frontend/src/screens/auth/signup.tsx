import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';

import { Link, router, Stack, useLocalSearchParams } from '@/navigation';
import { ScrollView, Text } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { containerClass } from '@/components/layout/Container';
import { TextField } from '@/features/auth/components/TextField';
import {
  AGREEMENT_LABEL,
  AGREEMENT_PATH,
  AGREEMENT_SLUGS,
  fetchAgreementVersions,
} from '@/features/auth/api/legalApi';
import { applyServerFieldErrors, formErrorMessage } from '@/features/auth/lib/serverFieldErrors';
import { signupSchema, type SignupInput } from '@/features/auth/schemas/authSchemas';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/store/useAuthStore';

export default function SignUpScreen() {
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const signUp = useAuthStore((state) => state.signUp);

  /**
   * 동의할 약관의 **현재 버전**. 서버에 없는 버전을 보내면 `422` 이므로 값을 추측하지 않고
   * 받은 것만 싣는다. 아직 `GET /legal-documents/{slug}` 가 없으면 빈 배열이고,
   * 그때는 `agreedTermsVersions` 를 아예 보내지 않는다 (선택 필드다).
   */
  const { data: agreementVersions } = useQuery({
    queryKey: queryKeys.legalDocuments.agreementVersions,
    queryFn: fetchAgreementVersions,
    staleTime: Infinity,
    retry: false,
  });

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    mode: 'onSubmit',
    defaultValues: {
      name: '',
      email: '',
      password: '',
      passwordConfirm: '',
      // 체크하지 않으면 스키마가 막는다 (`agreementField` 의 refine).
      agreements: { terms: false, privacy: false, location: false },
    },
  });

  const onSubmit = async (values: SignupInput) => {
    const result = await signUp({
      name: values.name,
      email: values.email,
      password: values.password,
      agreedTermsVersions: agreementVersions,
    });

    if (!result.ok) {
      if (!applyServerFieldErrors(result.error, setError, ['name', 'email', 'password'])) {
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
      <Stack.Screen options={{ title: '회원가입' }} />
      <ScrollView contentContainerClassName={containerClass('form', 'pb-8 pt-6')} keyboardShouldPersistTaps="handled">
        <Text className="mb-1 text-2xl font-extrabold text-neutral-900">회원가입</Text>
        <Text className="mb-6 text-sm text-neutral-500">몰라몰라에서 나에게 맞는 병원을 찾아보세요</Text>

        <form
          noValidate
          onSubmit={(event) => {
            clearErrors('root.serverError');
            void handleSubmit(onSubmit)(event);
          }}
        >
          <TextField
            id="signup-name"
            label="이름"
            autoComplete="name"
            placeholder="이름을 입력해주세요"
            error={errors.name?.message}
            {...register('name')}
          />

          <TextField
            id="signup-email"
            label="이메일"
            type="email"
            autoComplete="email"
            placeholder="example@email.com"
            error={errors.email?.message}
            {...register('email')}
          />

          <TextField
            id="signup-password"
            label="비밀번호"
            type="password"
            autoComplete="new-password"
            placeholder="6자 이상 입력해주세요"
            error={errors.password?.message}
            {...register('password')}
          />

          <TextField
            id="signup-password-confirm"
            label="비밀번호 확인"
            type="password"
            autoComplete="new-password"
            placeholder="비밀번호를 다시 입력해주세요"
            error={errors.passwordConfirm?.message}
            {...register('passwordConfirm')}
          />

          <fieldset className="mb-4 rounded-xl border border-neutral-200 px-4 py-3">
            <legend className="px-1 text-sm font-semibold text-neutral-700">약관 동의</legend>
            {AGREEMENT_SLUGS.map((slug) => {
              const fieldId = `signup-agree-${slug}`;
              const message = errors.agreements?.[slug]?.message;

              return (
                <div key={slug} className="py-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      id={fieldId}
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-brand-600"
                      aria-invalid={message ? true : undefined}
                      aria-describedby={message ? `${fieldId}-error` : undefined}
                      {...register(`agreements.${slug}`)}
                    />
                    <label htmlFor={fieldId} className="text-sm text-neutral-700">
                      (필수) {AGREEMENT_LABEL[slug]}에 동의합니다
                    </label>
                    <Link
                      href={AGREEMENT_PATH[slug]}
                      className="ml-auto shrink-0 text-xs font-semibold text-brand-700 underline"
                    >
                      보기
                    </Link>
                  </div>
                  {message ? (
                    <p id={`${fieldId}-error`} className="mt-1 text-sm text-rose-500">
                      {message}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </fieldset>

          {errors.root?.serverError?.message ? (
            <p role="alert" className="mb-3 text-sm text-rose-500">
              {errors.root.serverError.message}
            </p>
          ) : null}

          <div className="mt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-3.5 text-base font-semibold text-white active:bg-brand-700 disabled:opacity-40"
            >
              {isSubmitting ? '가입 중' : '가입하기'}
            </button>
          </div>
        </form>
      </ScrollView>
    </SafeAreaView>
  );
}
