import { MessageCircleQuestion } from 'lucide-react';
import { useRef, useState } from 'react';

import { Stack, router, useLocalSearchParams } from '@/navigation';
import { SafeAreaView, ScrollView, cx } from '@/primitives';

import { EmptyState } from '@/components/EmptyState';
import { QueryState } from '@/components/QueryState';
import { CONTAINER_PADDING } from '@/components/layout/Container';
import { useAdminHospital } from '@/features/admin/hooks/useAdminHospital';
import { useSession } from '@/features/auth/hooks/useSession';
import {
  AdminInquiryDetail,
  AdminInquiryList,
  useAnswerInquiry,
  useHospitalInquiries,
  useHospitalInquiry,
  useInquirySummary,
  type HospitalInquiryAnswerInput,
} from '@/features/inquiry';
import { useRovingTabs } from '@/hooks/useRovingTabs';
import { isApiError } from '@/lib/apiClient';
import { ADMIN_INQUIRY_STATUS_LABEL, type InquiryStatus } from '@/types/domain';
import { showAlert } from '@/utils/alert';

/**
 * 이 화면에는 페이지네이션 UI 가 없다. 계약이 허용하는 상한(`pageSize` 최대 100)까지
 * 한 번에 받는다 — 101번째부터 조용히 잘린다 (`docs/features/known-issues.md`).
 */
const LIST_PAGE_SIZE = 100;

type TabKey = InquiryStatus | 'all';

/**
 * 탭 라벨은 목록 항목의 상태 칩과 **같은 표**에서 온다 (`ADMIN_INQUIRY_STATUS_LABEL`) —
 * 문구를 한쪽만 고치면 같은 상태가 탭에서는 `미답변`, 칩에서는 다른 말이 된다.
 * `전체` 는 상태가 아니라 "필터 없음" 이라 그 표에 없다.
 */
const TABS: { key: TabKey; label: string; empty: string }[] = [
  { key: 'unanswered', label: ADMIN_INQUIRY_STATUS_LABEL.unanswered, empty: '답변할 문의가 없어요' },
  { key: 'answered', label: ADMIN_INQUIRY_STATUS_LABEL.answered, empty: '아직 답변한 문의가 없어요' },
  { key: 'all', label: '전체', empty: '아직 도착한 문의가 없어요' },
];

function isTabKey(value: string | undefined): value is TabKey {
  return TABS.some((tab) => tab.key === value);
}

/**
 * 관리자 문의 화면 (`/admin/inquiries`, `/admin/inquiries/:id`).
 *
 * **두 주소가 같은 컴포넌트이고 `selectedId` 유무만 다르다.** 넓고 좁음은 CSS 로만 가른다 —
 * 좁은 화면에서 목록과 상세가 서로를 감추고, 넓은 화면에서는 나란히 선다. 분기를 자바스크립트로
 * 두면 폭이 바뀔 때마다 한쪽이 언마운트되어 쓰던 답변이 사라진다.
 */
export default function AdminInquiriesPage() {
  const { id: selectedId, status: statusParam } = useLocalSearchParams<{ id?: string; status?: string }>();
  const { isOperator } = useSession();
  // **선택한 담당 병원 범위다** — 사이드 배지(`미답변 N`)와 같은 병원을 센다.
  // 운영자는 선택 병원이 없어 전 병원을 그대로 본다.
  const { hospitalId } = useAdminHospital();

  const tab: TabKey = isTabKey(statusParam) ? statusParam : 'unanswered';

  const summary = useInquirySummary(hospitalId ?? undefined);
  const list = useHospitalInquiries({
    pageSize: LIST_PAGE_SIZE,
    status: tab === 'all' ? undefined : tab,
    hospitalId: hospitalId ?? undefined,
  });
  const detail = useHospitalInquiry(selectedId);
  const answer = useAnswerInquiry();

  const [draft, setDraft] = useState('');
  const [answeredId, setAnsweredId] = useState<string | null>(null);
  // 연타 가드. 로컬 구현은 같은 tick 에 끝나서 `isPending` 만으로는 두 번 등록될 수 있다.
  const submittingRef = useRef(false);

  // 기본 탭(`미답변`)은 주소에 적지 않는다 — `/admin/inquiries` 와 같은 화면이다.
  const statusQuery = tab === 'unanswered' ? '' : `?status=${tab}`;

  const counts: Record<TabKey, number | null> = {
    unanswered: summary.data?.unanswered ?? null,
    answered: summary.data?.answered ?? null,
    all: summary.data?.total ?? null,
  };

  const goTo = (path: string) => {
    setDraft('');
    setAnsweredId(null);
    router.push(path);
  };

  /** 쓰던 답변이 있으면 버리기 전에 묻는다 — 목록을 한 번 잘못 눌러 글이 사라지지 않게. */
  const leaveDraft = (go: () => void) => {
    if (draft.trim().length === 0) {
      go();
      return;
    }

    showAlert('작성 중인 답변이 있어요', '저장하지 않고 다른 문의를 열까요?', [
      { text: '취소', style: 'cancel' },
      { text: '열기', onPress: go },
    ]);
  };

  const selectTab = (key: TabKey) => {
    leaveDraft(() => goTo(`/admin/inquiries${key === 'unanswered' ? '' : `?status=${key}`}`));
  };

  const selectInquiry = (id: string) => {
    if (id === selectedId) return;

    leaveDraft(() => goTo(`/admin/inquiries/${id}${statusQuery}`));
  };

  // APG 탭 패턴(화살표 순환·Home/End·이동과 동시에 열림)은 상담 예약 화면과 같은 훅을 쓴다.
  const { setRef, onKeyDown } = useRovingTabs(
    TABS.map((item) => item.key),
    selectTab
  );

  const handleAnswer = (id: string, input: HospitalInquiryAnswerInput) => {
    if (submittingRef.current) return;
    submittingRef.current = true;

    answer.mutate(
      { id, input },
      {
        onSuccess: () => {
          submittingRef.current = false;
          setDraft('');
          setAnsweredId(id);
        },
        onError: (error) => {
          // 초안은 남긴다 — 실패한 글을 다시 쓰게 하지 않는다.
          submittingRef.current = false;
          showAlert('답변을 등록하지 못했어요', isApiError(error) ? error.message : '잠시 후 다시 시도해주세요');
        },
      }
    );
  };

  // 범위 밖이거나 없는 문의는 `404 HOSPITAL_INQUIRY_NOT_FOUND` 다 — 재시도를 권할 에러가
  // 아니라 빈 상태다 (상담 상세와 같은 처리).
  const detailNotFound =
    detail.isError && isApiError(detail.error) && detail.error.code === 'HOSPITAL_INQUIRY_NOT_FOUND';

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['bottom']}>
      <Stack.Screen options={{ title: '문의' }} />
      <ScrollView contentContainerClassName={cx(CONTAINER_PADDING, 'pb-10 pt-4')}>
        {/* 화면 제목은 관리자 상단바의 `h1` 하나다. */}
        <p className="mb-4 text-sm text-neutral-500">
          환자가 병원 상세에서 &lsquo;문의하기&rsquo;로 남긴 질문이에요. 답변하면 환자에게 알림이 갑니다.
        </p>

        <div role="tablist" aria-label="답변 상태" className="mb-4 flex flex-row flex-wrap">
          {TABS.map((item, index) => {
            const selected = item.key === tab;
            const count = counts[item.key];

            return (
              <button
                key={item.key}
                id={`inq-tab-${item.key}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="inq-list"
                tabIndex={selected ? 0 : -1}
                ref={setRef(item.key)}
                onClick={() => selectTab(item.key)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className={cx(
                  'mb-2 mr-2 min-h-[40px] rounded-full border px-3.5 py-2 text-sm font-medium',
                  selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-neutral-200 bg-white text-neutral-600'
                )}
              >
                {/* 아직 모르는 동안(로딩·실패)에는 숫자를 그리지 않는다 — 지어내지 않는다. */}
                {count === null ? item.label : `${item.label} ${count}`}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          {/* 이름이 붙은 `section` 은 그 자체로 role=region 이다 — 명시하면 중복이다. */}
          <section
            aria-label="문의 목록"
            className={cx('md:w-[340px] md:shrink-0', selectedId && 'hidden md:block')}
          >
            <div id="inq-list" role="tabpanel" aria-labelledby={`inq-tab-${tab}`} tabIndex={0}>
              <QueryState
                isLoading={list.isLoading}
                isError={list.isError}
                data={list.data}
                onRetry={() => {
                  void list.refetch();
                }}
                isRetrying={list.isError && list.isFetching}
                isEmpty={(page) => page.items.length === 0}
                emptyState={{
                  icon: MessageCircleQuestion,
                  title: TABS.find((item) => item.key === tab)?.empty ?? '아직 도착한 문의가 없어요',
                }}
                className="min-h-[200px] justify-center"
              >
                {(page) => (
                  <AdminInquiryList items={page.items} selectedId={selectedId} onSelect={selectInquiry} />
                )}
              </QueryState>
            </div>
          </section>

          <section
            aria-label="문의 상세"
            className={cx(
              'min-w-0 flex-1 rounded-2xl border border-neutral-100 bg-white p-5 md:p-7',
              !selectedId && 'hidden md:block'
            )}
          >
            {selectedId === undefined ? (
              <EmptyState icon={MessageCircleQuestion} title="왼쪽에서 문의를 선택하세요" variant="inline" />
            ) : (
              <QueryState
                isLoading={detail.isLoading}
                isError={detailNotFound ? false : detail.isError}
                data={detailNotFound ? null : detail.data}
                onRetry={() => {
                  void detail.refetch();
                }}
                isRetrying={detail.isError && detail.isFetching}
                emptyState={{ icon: MessageCircleQuestion, title: '문의를 찾을 수 없어요', variant: 'inline' }}
                className="min-h-[200px] justify-center"
              >
                {(inquiry) => (
                  <AdminInquiryDetail
                    // 선택이 바뀌면 다시 마운트한다 — 공개 체크박스 기본값이 새 문의 기준으로 잡힌다.
                    key={inquiry.id}
                    inquiry={inquiry}
                    canAnswer={!isOperator}
                    draft={draft}
                    onDraftChange={setDraft}
                    submitting={answer.isPending}
                    onSubmit={(input) => handleAnswer(inquiry.id, input)}
                    justAnswered={answeredId === inquiry.id}
                  />
                )}
              </QueryState>
            )}
          </section>
        </div>
      </ScrollView>
    </SafeAreaView>
  );
}
