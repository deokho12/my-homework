import { CalendarCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Stack, router, useLocalSearchParams } from '@/navigation';
import { SafeAreaView, ScrollView, cx } from '@/primitives';

import { EmptyState } from '@/components/EmptyState';
import { QueryState } from '@/components/QueryState';
import { CONTAINER_PADDING } from '@/components/layout/Container';
import { useAdminHospital } from '@/features/admin/hooks/useAdminHospital';
import { useSession } from '@/features/auth/hooks/useSession';
import {
  AdminConsultDetail,
  AdminConsultFilters,
  AdminConsultList,
  formatVisitAt,
  useAddConsultMemo,
  useConsultRequest,
  useConsultRequests,
  useUpdateConsultStatus,
  type ConsultPeriod,
  type ConsultStatusUpdateInput,
} from '@/features/consult';
import {
  DEFAULT_PERIOD,
  isPeriodChoice,
  type ConsultPeriodChoice,
} from '@/features/consult/components/AdminConsultFilters';
import {
  EMPTY_CONSULT_DRAFT,
  SAVED_MESSAGE,
  isConsultDraftDirty,
  type ConsultStatusDraft,
} from '@/features/consult/components/AdminConsultStatusForm';
import { getSubProcedureIdsOf, isCategoryId, type CategoryId } from '@/features/procedure';
import { useRovingTabs } from '@/hooks/useRovingTabs';
import { isApiError } from '@/lib/apiClient';
import { CONSULT_STATUSES, CONSULT_STATUS_LABEL, type ConsultStatus } from '@/types/domain';
import { showAlert } from '@/utils/alert';

/**
 * 이 화면에는 페이지네이션 UI 가 없다. 계약이 허용하는 상한(`pageSize` 최대 100)까지
 * 한 번에 받는다 — 101번째부터 조용히 잘린다 (`docs/features/known-issues.md`).
 */
const LIST_PAGE_SIZE = 100;

/** 검색어를 주소에 적기까지 기다리는 시간. 글자마다 이력이 쌓이지 않게 `replace` 와 함께 쓴다. */
const SEARCH_DEBOUNCE_MS = 250;

type TabKey = ConsultStatus | 'all';

/**
 * 탭 라벨은 카드의 상태 칩과 **같은 표**에서 온다 (`CONSULT_STATUS_LABEL`) — 문구를 한쪽만
 * 고치면 같은 상태가 탭과 칩에서 다른 말이 된다. `전체` 는 상태가 아니라 "필터 없음" 이라 그 표에 없다.
 */
const TABS: { key: TabKey; label: string; empty: string }[] = [
  { key: 'all', label: '전체', empty: '접수된 상담 예약이 없어요' },
  ...CONSULT_STATUSES.map((status) => ({
    key: status,
    label: CONSULT_STATUS_LABEL[status],
    empty: {
      new: '처리할 새 상담이 없어요',
      contacted: '연락중인 상담이 없어요',
      booked: '예약이 잡힌 상담이 없어요',
      visited: '내원한 상담이 없어요',
      cancelled: '취소된 상담이 없어요',
    }[status],
  })),
];

/** 기본 탭. **주소에 적지 않는다** — `/admin/consultations` 가 곧 `신규` 탭이다. */
const DEFAULT_TAB: TabKey = 'new';

function isTabKey(value: string | undefined): value is TabKey {
  return TABS.some((tab) => tab.key === value);
}

interface Query {
  status: TabKey;
  /**
   * 주소에 `status` 가 **여러 개**일 때의 값 (`?status=new&status=contacted`). 대시보드의
   * `처리 대기`·`이번 달 예약확정` 카드가 자기 숫자를 재현하려고 쓰는 조합이다.
   * 1개 이하면 빈 배열이고 탭(`status`)이 화면을 정한다.
   */
  statuses: ConsultStatus[];
  period: ConsultPeriodChoice;
  category: CategoryId | '';
  q: string;
}

/** 주소 문자열. **기본값은 적지 않는다** — 같은 화면이 두 주소를 갖지 않게. */
function buildQuery({ status, statuses, period, category, q }: Query): string {
  const params = new URLSearchParams();

  if (statuses.length > 1) statuses.forEach((value) => params.append('status', value));
  else if (status !== DEFAULT_TAB) params.set('status', status);
  if (period !== DEFAULT_PERIOD) params.set('period', period);
  if (category) params.set('category', category);
  if (q) params.set('q', q);

  const search = params.toString();

  return search ? `?${search}` : '';
}

function isConsultStatus(value: string): value is ConsultStatus {
  return (CONSULT_STATUSES as string[]).includes(value);
}

/**
 * 여러 상태로 좁혀 보고 있을 때의 안내 문구.
 *
 * 대시보드 카드 ②가 보내는 `신규 + 연락중` 은 그 카드의 이름(`처리 대기`)으로 부른다 —
 * 담당자가 방금 누른 카드와 같은 말이어야 "왜 이 목록인가" 가 보인다. 그 밖의 조합은
 * 상태 이름을 그대로 잇는다 (카드 ④의 `예약확정 + 내원완료` 가 그 경우다).
 */
function multiStatusNotice(statuses: ConsultStatus[]): string {
  const labels = statuses.map((status) => CONSULT_STATUS_LABEL[status]).join(' + ');
  const isPending = statuses.length === 2 && statuses.includes('new') && statuses.includes('contacted');

  return isPending ? `처리 대기(${labels})만 보는 중` : `${labels}만 보는 중`;
}

/**
 * 관리자 상담 예약 화면 (`/admin/consultations`, `/admin/consultations/:id`).
 *
 * **두 주소가 같은 컴포넌트이고 `selectedId` 유무만 다르다.** 넓고 좁음은 CSS 로만 가른다 —
 * 분기를 자바스크립트로 두면 폭이 바뀔 때마다 한쪽이 언마운트되어 고르던 상태가 사라진다
 * (관리자 문의 화면과 같은 구조).
 */
export default function AdminConsultationsPage() {
  const params = useLocalSearchParams<{ id?: string; status?: string; period?: string; category?: string; q?: string }>();
  const selectedId = params.id;
  const { isOperator } = useSession();
  const { hospitalId } = useAdminHospital();

  // `useLocalSearchParams` 는 같은 이름의 파라미터를 하나로 합친다 — 반복 `status` 는
  // react-router 의 `getAll` 로 직접 읽는다 (대시보드 카드가 보내는 주소다).
  const [searchParams] = useSearchParams();
  const statuses = searchParams.getAll('status').filter(isConsultStatus);
  const multiStatus = statuses.length > 1;

  const tab: TabKey = !multiStatus && isTabKey(params.status) ? params.status : DEFAULT_TAB;
  const period: ConsultPeriodChoice = isPeriodChoice(params.period) ? params.period : DEFAULT_PERIOD;
  const category: CategoryId | '' = isCategoryId(params.category) ? params.category : '';
  const q = params.q ?? '';

  // 입력 중인 검색어는 화면이 들고 있다가 디바운스 뒤에 주소로 간다 — 글자마다 조회하지 않는다.
  const [search, setSearch] = useState(q);
  const [draft, setDraft] = useState<ConsultStatusDraft>(EMPTY_CONSULT_DRAFT);
  const [memoDraft, setMemoDraft] = useState('');
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [memoError, setMemoError] = useState<string | null>(null);

  const query: Query = { status: tab, statuses: multiStatus ? statuses : [], period, category, q };
  const currentPath = selectedId ? `/admin/consultations/${selectedId}` : '/admin/consultations';

  useEffect(() => {
    if (search === q) return;

    const timer = setTimeout(() => {
      router.replace(`${currentPath}${buildQuery({ ...query, q: search })}`);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // `query`·`currentPath` 는 매 렌더 새 객체라 의존성에 넣으면 타이머가 끝없이 다시 걸린다.
    // 디바운스가 보는 것은 "입력값이 주소와 달라졌는가" 하나다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, q]);

  const list = useConsultRequests({
    pageSize: LIST_PAGE_SIZE,
    // 주소에 상태가 여러 개면 그것끼리 OR 다 — 어떤 탭도 선택되지 않는다.
    status: multiStatus ? statuses : tab === 'all' ? undefined : tab,
    period: period === 'all' ? undefined : (period as ConsultPeriod),
    // **선택한 담당 병원 범위다.** 운영자는 선택 병원이 없어 전 병원을 그대로 본다.
    hospitalId: hospitalId ?? undefined,
    // 화면의 칸은 9개 분야지만 이 오퍼레이션은 분야 조건을 받지 않는다 (계약 §22.9) —
    // 그 분야의 시술 id 를 전부 보내 OR 로 거른다. 전개는 taxonomy 의 몫이다.
    procedureId: category ? getSubProcedureIdsOf(category) : undefined,
    q: q || undefined,
  });
  const detail = useConsultRequest(selectedId);
  const updateStatus = useUpdateConsultStatus();
  const addMemo = useAddConsultMemo();

  const counts = list.data?.statusCounts;
  const countOf = (key: TabKey): number | null => {
    if (!counts) return null;

    return key === 'all' ? counts.total : counts[key];
  };

  const resetDrafts = () => {
    setDraft(EMPTY_CONSULT_DRAFT);
    setMemoDraft('');
    setSavedMessage(null);
    setSaveError(null);
    setMemoError(null);
  };

  /** 쓰던 것이 있으면 버리기 전에 묻는다 — 한 번 잘못 눌러 고른 상태·메모가 사라지지 않게. */
  const leaveDraft = (go: () => void) => {
    if (!isConsultDraftDirty(draft) && memoDraft.trim().length === 0) {
      go();
      return;
    }

    showAlert('저장하지 않은 내용이 있어요', '저장하지 않고 다른 상담을 열까요?', [
      { text: '취소', style: 'cancel' },
      { text: '열기', onPress: go },
    ]);
  };

  const selectTab = (key: TabKey) => {
    leaveDraft(() => {
      resetDrafts();
      // 탭을 바꾸면 선택을 놓는다 — 고른 상담이 그 탭에 없을 수 있다.
      // 여러 상태로 좁혀 보던 중이었다면 그 조합도 함께 풀린다.
      router.push(`/admin/consultations${buildQuery({ ...query, status: key, statuses: [] })}`);
    });
  };

  const selectConsult = (id: string) => {
    if (id === selectedId) return;

    leaveDraft(() => {
      resetDrafts();
      router.push(`/admin/consultations/${id}${buildQuery(query)}`);
    });
  };

  /** 기간·시술은 선택을 유지한다 — 보고 있던 상담이 그대로이므로 고르던 것도 그대로다. */
  const applyFilter = (next: Partial<Query>) => {
    router.push(`${currentPath}${buildQuery({ ...query, ...next })}`);
  };

  const resetFilters = () => {
    setSearch('');
    // 탭은 유지한다 — 되돌리는 것은 기간·시술·검색이다. 여러 상태로 좁혀 보던 중이었다면
    // 그것도 **조건**이라 함께 푼다 (풀지 않으면 `조건 초기화` 를 눌러도 목록이 그대로다).
    router.push(
      `${currentPath}${buildQuery({ status: tab, statuses: [], period: DEFAULT_PERIOD, category: '', q: '' })}`
    );
  };

  const handleSubmitStatus = (input: ConsultStatusUpdateInput, { isReschedule }: { isReschedule: boolean }) => {
    if (updateStatus.isPending) return;

    setSaveError(null);
    updateStatus.mutate(
      { id: selectedId as string, input },
      {
        onSuccess: (updated) => {
          const last = updated.statusHistory.at(-1);
          // 알림 문구는 **응답이 발송을 말할 때만** 붙인다 — 규칙으로 지어내지 않는다.
          const notice = last?.notified ? ' 환자에게 알림이 갔어요.' : '';
          const changed = isReschedule
            ? `일시를 ${formatVisitAt(updated.visitAt)}으로 바꿨어요.`
            : SAVED_MESSAGE[input.status];

          setDraft(EMPTY_CONSULT_DRAFT);
          setSavedMessage(`${changed}${notice}`);
          document.getElementById('consult-status-h')?.focus();
        },
        onError: (error) => {
          // 고른 값은 남긴다 — 실패한 입력을 다시 고르게 하지 않는다.
          setSaveError(isApiError(error) ? error.message : '상태를 저장하지 못했어요. 잠시 후 다시 시도해주세요');
        },
      }
    );
  };

  const handleAddMemo = () => {
    const content = memoDraft.trim();
    if (content.length === 0 || addMemo.isPending) return;

    setMemoError(null);
    addMemo.mutate(
      { id: selectedId as string, content },
      {
        // 입력칸은 저장 성공을 확인하고 비운다 — 실패했는데 비우면 쓴 내용이 사라진다.
        onSuccess: () => setMemoDraft(''),
        onError: () => setMemoError('메모를 추가하지 못했어요'),
      }
    );
  };

  // 없는 상담(또는 담당 병원 밖의 상담)은 `404 CONSULT_REQUEST_NOT_FOUND` 다 — 재시도를
  // 권할 에러가 아니라 빈 상태다.
  const detailNotFound = detail.isError && isApiError(detail.error) && detail.error.code === 'CONSULT_REQUEST_NOT_FOUND';
  // 조건이 전부 기본값이면 "탭에 아무것도 없다" 이고, 하나라도 걸려 있으면 "조건에 안 맞는다" 다.
  const filtered = period !== DEFAULT_PERIOD || category !== '' || q !== '' || multiStatus;
  const now = new Date();

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['bottom']}>
      <Stack.Screen options={{ title: '상담 예약' }} />
      <ScrollView contentContainerClassName={cx(CONTAINER_PADDING, 'pb-10 pt-4')}>
        {/* 화면 제목은 관리자 상단바의 `h1` 하나다 — 같은 글자를 여기 또 쓰면 두 번 읽힌다. */}
        <p className="mb-4 text-sm text-neutral-500">
          환자가 앱에서 &lsquo;상담 신청&rsquo;을 누르면 여기로 들어와요. 연락한 뒤 상태를 바꿔 주세요.
        </p>

        <ConsultTabs tab={multiStatus ? null : tab} countOf={countOf} onSelect={selectTab} />

        {multiStatus ? (
          <div className="mb-3 flex flex-row flex-wrap items-center gap-2 rounded-xl bg-brand-50 px-3 py-2">
            <p className="text-[13px] font-semibold text-brand-700">{multiStatusNotice(statuses)}</p>
            <button
              type="button"
              onClick={() => selectTab(DEFAULT_TAB)}
              className="min-h-[44px] rounded-lg border border-brand-200 bg-white px-3 text-[13px] font-semibold text-brand-700"
            >
              해제
            </button>
          </div>
        ) : null}

        <AdminConsultFilters
          period={period}
          onPeriodChange={(next) => applyFilter({ period: next })}
          category={category}
          onCategoryChange={(next) => applyFilter({ category: next })}
          search={search}
          onSearchChange={setSearch}
        />

        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          {/* 이름이 붙은 `section` 은 그 자체로 role=region 이다 — 명시하면 중복이다. */}
          <section aria-label="상담 목록" className={cx('md:w-[380px] md:shrink-0', selectedId && 'hidden md:block')}>
            <div
              id="consult-list"
              role="tabpanel"
              // 여러 상태를 보는 중에는 가리킬 탭이 없다 — 목록이 스스로를 설명한다.
              aria-labelledby={multiStatus ? undefined : `consult-tab-${tab}`}
              aria-label={multiStatus ? multiStatusNotice(statuses) : undefined}
              tabIndex={0}
            >
              <QueryState
                isLoading={list.isLoading}
                isError={list.isError}
                data={list.data}
                onRetry={() => {
                  void list.refetch();
                }}
                isRetrying={list.isError && list.isFetching}
                isEmpty={(page) => page.items.length === 0}
                emptyState={
                  filtered
                    ? {
                        icon: CalendarCheck,
                        title: '조건에 맞는 상담이 없어요',
                        description: '검색어나 기간을 바꿔 보세요',
                        actionLabel: '조건 초기화',
                        onAction: resetFilters,
                      }
                    : {
                        icon: CalendarCheck,
                        title: TABS.find((item) => item.key === tab)?.empty ?? '접수된 상담 예약이 없어요',
                        // 기본 기간도 조건이다. 30일 넘게 아무도 연락하지 않은 신규 건이 있으면 "새 상담이
                        // 없다" 는 거짓이 되므로, 무엇이 가리고 있는지 말하고 넓혀 볼 길을 둔다.
                        description: '최근 30일 기준이에요. 그 전에 들어온 상담은 기간을 넓혀야 보여요.',
                        actionLabel: '전체 기간 보기',
                        onAction: () => applyFilter({ period: 'all' }),
                      }
                }
                className="min-h-[200px] justify-center"
              >
                {(page) => (
                  <AdminConsultList
                    items={page.items}
                    selectedId={selectedId}
                    onSelect={selectConsult}
                    now={now}
                  />
                )}
              </QueryState>
            </div>
          </section>

          <section
            aria-label="상담 상세"
            className={cx(
              'min-w-0 flex-1 rounded-2xl border border-neutral-100 bg-white p-5 md:p-7',
              !selectedId && 'hidden md:block'
            )}
          >
            {selectedId === undefined ? (
              <EmptyState icon={CalendarCheck} title="왼쪽에서 상담을 선택하세요" variant="inline" />
            ) : (
              <QueryState
                isLoading={detail.isLoading}
                isError={detailNotFound ? false : detail.isError}
                data={detailNotFound ? null : detail.data}
                onRetry={() => {
                  void detail.refetch();
                }}
                isRetrying={detail.isError && detail.isFetching}
                emptyState={{ icon: CalendarCheck, title: '상담 정보를 찾을 수 없어요', variant: 'inline' }}
                className="min-h-[200px] justify-center"
              >
                {(request) => (
                  <AdminConsultDetail
                    // 선택이 바뀌면 다시 마운트한다 — 입력 칸이 새 상담 기준으로 잡힌다.
                    key={request.id}
                    request={request}
                    canEdit={!isOperator}
                    draft={draft}
                    onDraftChange={(next) => {
                      // 다음 변경을 고르기 시작하면 방금 저장 결과는 내려간다 — 새 선택이 저장된 것처럼 읽히지 않게.
                      setSavedMessage(null);
                      setDraft(next);
                    }}
                    onSubmit={handleSubmitStatus}
                    saving={updateStatus.isPending}
                    saveError={saveError}
                    savedMessage={savedMessage}
                    memoDraft={memoDraft}
                    onMemoDraftChange={setMemoDraft}
                    onAddMemo={handleAddMemo}
                    addingMemo={addMemo.isPending}
                    memoError={memoError}
                    now={now}
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

function ConsultTabs({
  tab,
  countOf,
  onSelect,
}: {
  /** `null` 이면 **어떤 탭도 선택되지 않았다** (주소에 상태가 여러 개인 경우). */
  tab: TabKey | null;
  countOf: (key: TabKey) => number | null;
  onSelect: (key: TabKey) => void;
}) {
  const { setRef, onKeyDown } = useRovingTabs(
    TABS.map((item) => item.key),
    onSelect
  );

  return (
    <div role="tablist" aria-label="상담 상태" className="mb-3 flex flex-row flex-wrap">
      {TABS.map((item, index) => {
        const selected = item.key === tab;
        const count = countOf(item.key);

        return (
          <button
            key={item.key}
            id={`consult-tab-${item.key}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls="consult-list"
            tabIndex={selected || (tab === null && index === 0) ? 0 : -1}
            ref={setRef(item.key)}
            onClick={() => onSelect(item.key)}
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
  );
}
