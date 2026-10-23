import { useMemo, useRef, useState } from 'react';

import { Stack, router, useLocalSearchParams } from '@/navigation';
import { SafeAreaView } from '@/primitives';

import { QueryState } from '@/components/QueryState';
import { useSession } from '@/features/auth';
import {
  ConsultRequestComplete,
  ConsultRequestForm,
  NO_PROCEDURE_LABEL,
  THIRD_PARTY_CONSENT_NOTICE_VERSION,
  consultProcedureLabel,
  procedurePairLabel,
  useCreateConsultRequest,
  useMyConsultRequests,
  type CompletedConsult,
  type ConsultRequestFormInput,
  type ProcedureChoice,
} from '@/features/consult';
import { useHospital } from '@/features/hospital';
import { groupProcedureIdsByCategory } from '@/features/procedure';
import { isApiError } from '@/lib/apiClient';
import { CONSULT_STATUS_LABEL, type Hospital } from '@/types/domain';

/**
 * 병원이 취급하는 시술 → `{대분류} · {세부시술}` 칩 목록.
 *
 * 중복 제거·순서 고정·모르는 id 제거는 `groupProcedureIdsByCategory` 가 이미 하고, **라벨 문구는
 * `procedurePairLabel` 하나가 정한다** — 마이페이지 상담 내역이 같은 규칙으로 적는다.
 */
function procedureChoicesOf(hospital: Hospital): ProcedureChoice[] {
  return groupProcedureIdsByCategory(hospital.procedureIds).flatMap((group) =>
    group.subs.flatMap((sub) => {
      const label = procedurePairLabel(sub.id);

      return label ? [{ id: sub.id, label }] : [];
    })
  );
}

/** 조회가 끝난 병원을 받아 접수까지 책임진다 — `QueryState` 의 children 안에서는 훅을 쓸 수 없다. */
function ConsultRequestFlow({ hospital }: { hospital: Hospital }) {
  const { user } = useSession();
  /**
   * 연락처 자동 채움의 출처: **내가 가장 최근에 남긴 신청 1건.** 계정 정보에는 연락처가
   * 없다 (`User` 에 전화번호 필드가 없고, 서버도 주지 않는다).
   */
  const { data: myRequests } = useMyConsultRequests({ pageSize: 1 });
  const createRequest = useCreateConsultRequest();

  const [completed, setCompleted] = useState<CompletedConsult | null>(null);
  /** 접수 실패 안내. 알림창 대신 폼 위에 남는다 — 입력은 그대로 두고 `다시 시도` 를 준다. */
  const [submitError, setSubmitError] = useState<string | null>(null);

  const procedureChoices = useMemo(() => procedureChoicesOf(hospital), [hospital]);

  // `createRequest.isPending` 만으로는 부족하다 — 로컬 구현은 같은 tick 에 끝나서 연타하면
  // 신청이 두 건 접수된다. 서버로 바뀌어도 이 가드는 그대로 유효하다.
  const submittingRef = useRef(false);

  const handleSubmit = (values: ConsultRequestFormInput) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    // 다시 보내는 동안에는 지난 실패 안내를 치운다 — 결과가 나오면 다시 붙는다.
    setSubmitError(null);

    createRequest.mutate(
      {
        hospitalId: hospital.id,
        procedureId: values.procedureId,
        name: values.name,
        phone: values.phone,
        preferredTime: values.preferredTime,
        message: values.message,
        // 사용자에게 **실제로 보여준** 안내문의 버전을 함께 보낸다 (계약
        // `ConsultThirdPartyConsentInput`). 동의 시각은 보내지 않는다 — 서버가 찍는다.
        thirdPartyConsent: { agreed: values.thirdPartyConsent, noticeVersion: THIRD_PARTY_CONSENT_NOTICE_VERSION },
      },
      {
        // 접수 확인은 **저장이 끝난 뒤에만** 보여준다. 먼저 보여주면 실패한 신청도
        // "접수되었어요" 로 보인다.
        onSuccess: (created) => {
          setCompleted({
            // 로컬 응답의 `hospitalName` 은 아직 `null` 이라 조회한 병원 이름을 쓴다.
            hospitalName: hospital.name,
            // 칩 라벨과 같은 함수로 짓는다 — 완료 화면만 다른 문구를 쓰지 않게.
            procedureLabel: consultProcedureLabel(values.procedureId) ?? NO_PROCEDURE_LABEL,
            preferredTime: values.preferredTime,
            status: created.status,
            statusLabel: CONSULT_STATUS_LABEL[created.status],
          });
        },
        // 서버 문구(`ApiError.message`)를 그대로 보여준다 — 화면이 코드별 문구 사전을 따로 두지 않는다.
        // 상담 마감 거절(`CONSULT_CLOSED`)도 같은 자리에 같은 모양으로 붙는다.
        onError: (error) => {
          // 실패는 다시 시도할 수 있어야 한다. 성공 시엔 폼이 사라지므로 풀지 않는다.
          submittingRef.current = false;
          setSubmitError(isApiError(error) ? error.message : '잠시 후 다시 시도해주세요');
        },
      }
    );
  };

  // 스크롤과 하단 고정 바는 폼·완료 화면이 각자 가진다 (시안 A — 제출 버튼이 바닥에 붙는다).
  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <Stack.Screen options={{ title: '상담 신청' }} />
      {completed ? (
        <ConsultRequestComplete
          consult={completed}
          // 마이페이지의 상담 내역 탭은 다음 요청서(02)의 몫이다. 지금은 마이페이지까지 보낸다.
          // `replace` 인 이유: 뒤로 가기로 방금 보낸 폼에 돌아오면 같은 신청을 또 보낼 수 있다.
          onViewHistory={() => router.replace('/mypage')}
          onBackToHospital={() => router.replace(`/hospital/${hospital.id}`)}
        />
      ) : (
        <ConsultRequestForm
          hospital={hospital}
          procedureChoices={procedureChoices}
          autofillName={user?.name ?? ''}
          autofillPhone={myRequests?.items[0]?.phone ?? ''}
          submitting={createRequest.isPending}
          submitError={submitError}
          onSubmit={handleSubmit}
        />
      )}
    </SafeAreaView>
  );
}

export default function ConsultRequestPage() {
  const { hospitalId } = useLocalSearchParams<{ hospitalId: string }>();
  // 로그인 검사는 라우트 가드가 한다 (`src/App.tsx` 의 `guard: 'auth'`). 화면 안에서
  // 다시 검사하면 규칙이 두 곳으로 갈린다.
  const { data: hospital, error, isLoading, isError, isFetching, refetch } = useHospital(hospitalId);

  // 없는 병원은 서버가 404 HOSPITAL_NOT_FOUND 를 준다 — "다시 시도" 를 권할 에러가 아니라
  // 빈 상태다. 그 외 에러(네트워크 오류 등)는 재시도 가능한 에러로 둔다.
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
      {(hospital) => <ConsultRequestFlow hospital={hospital} />}
    </QueryState>
  );
}
