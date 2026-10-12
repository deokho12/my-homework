import { useRef, useState } from 'react';

import { Stack, router, useLocalSearchParams } from '@/navigation';
import { SafeAreaView, ScrollView } from '@/primitives';

import { QueryState } from '@/components/QueryState';
import { containerClass } from '@/components/layout/Container';
import { useHospital } from '@/features/hospital';
import {
  InquiryComplete,
  InquiryForm,
  useCreateInquiry,
  type CompletedInquiry,
  type InquiryFormInput,
} from '@/features/inquiry';
import { isApiError } from '@/lib/apiClient';
import { INQUIRY_TOPIC_LABEL, type Hospital } from '@/types/domain';
import { showAlert } from '@/utils/alert';

/** 조회가 끝난 병원을 받아 접수까지 책임진다 — `QueryState` 의 children 안에서는 훅을 쓸 수 없다. */
function InquiryFlow({ hospital }: { hospital: Hospital }) {
  const createInquiry = useCreateInquiry();
  const [completed, setCompleted] = useState<CompletedInquiry | null>(null);

  // `isPending` 만으로는 부족하다 — 로컬 구현은 같은 tick 에 끝나서 연타하면 두 건이 접수된다.
  // 서버로 바뀌어도 이 가드는 그대로 유효하다.
  const submittingRef = useRef(false);

  const handleSubmit = (values: InquiryFormInput) => {
    if (submittingRef.current) return;
    submittingRef.current = true;

    createInquiry.mutate(
      {
        hospitalId: hospital.id,
        // 서버 전환 시 삭제: 서버는 `hospitals` 를 조인해 이름을 얻는다.
        hospitalName: hospital.name,
        topic: values.topic,
        content: values.content,
        isPublic: values.isPublic,
      },
      {
        // 접수 확인은 **저장이 끝난 뒤에만** 보여준다.
        onSuccess: (created) => {
          setCompleted({
            hospitalName: hospital.name,
            topicLabel: INQUIRY_TOPIC_LABEL[created.topic],
            isPublic: created.isPublic,
          });
        },
        onError: (error) => {
          // 실패는 다시 시도할 수 있어야 한다. 성공 시엔 폼이 사라지므로 풀지 않는다.
          submittingRef.current = false;
          showAlert('문의를 남기지 못했어요', isApiError(error) ? error.message : '잠시 후 다시 시도해주세요');
        },
      }
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <Stack.Screen options={{ title: '문의하기' }} />
      <ScrollView
        contentContainerClassName={containerClass('form', 'pb-8 pt-4')}
        keyboardShouldPersistTaps="handled"
      >
        {completed ? (
          <InquiryComplete
            inquiry={completed}
            // `replace` 인 이유: 뒤로 가기로 방금 보낸 폼에 돌아오면 같은 문의를 또 보낼 수 있다.
            onViewMyInquiries={() => router.replace('/mypage?tab=inquiries')}
          />
        ) : (
          <InquiryForm hospital={hospital} submitting={createInquiry.isPending} onSubmit={handleSubmit} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * 문의하기 `/inquiry/:hospitalId`.
 *
 * 로그인 검사는 라우트 가드가 한다 (`src/App.tsx` 의 `guard: 'auth'`) — 화면 안에서 다시
 * 검사하면 규칙이 두 곳으로 갈린다. 상담 신청 화면(`ConsultRequestPage`)과 같은 뼈대다.
 */
export default function InquiryPage() {
  const { hospitalId } = useLocalSearchParams<{ hospitalId: string }>();
  const { data: hospital, error, isLoading, isError, isFetching, refetch } = useHospital(hospitalId);

  // 없는 병원은 "다시 시도" 를 권할 에러가 아니라 빈 상태다.
  const notFound = isError && isApiError(error) && error.code === 'HOSPITAL_NOT_FOUND';

  return (
    <QueryState
      isLoading={isLoading}
      isError={notFound ? false : isError}
      data={notFound ? null : hospital}
      onRetry={() => {
        void refetch();
      }}
      isRetrying={isError && isFetching}
      emptyState={{ title: '병원 정보를 찾을 수 없어요' }}
      className="flex-1 bg-white"
    >
      {(hospital) => <InquiryFlow hospital={hospital} />}
    </QueryState>
  );
}
