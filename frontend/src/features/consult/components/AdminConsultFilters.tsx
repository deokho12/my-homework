import { CATEGORIES, type CategoryId } from '@/features/procedure';

/** 기간 선택지. `all` 은 **파라미터를 보내지 않는 것**이다 (꺼진 조건은 보내지 않는다). */
export const CONSULT_PERIOD_OPTIONS = [
  { value: 'today', label: '오늘' },
  { value: 'thisWeek', label: '이번 주' },
  // 대시보드 카드 ④(`이번 달 예약확정`)가 자기 숫자를 재현하려고 쓰는 기간이다.
  { value: 'thisMonth', label: '이번 달' },
  { value: 'last30', label: '최근 30일' },
  { value: 'all', label: '전체' },
] as const;

export type ConsultPeriodChoice = (typeof CONSULT_PERIOD_OPTIONS)[number]['value'];

/** 기본 기간. **주소에 적지 않는다** — `/admin/consultations` 가 곧 이 상태다. */
export const DEFAULT_PERIOD: ConsultPeriodChoice = 'last30';

export function isPeriodChoice(value: string | undefined): value is ConsultPeriodChoice {
  return CONSULT_PERIOD_OPTIONS.some((option) => option.value === value);
}

interface AdminConsultFiltersProps {
  period: ConsultPeriodChoice;
  onPeriodChange: (period: ConsultPeriodChoice) => void;
  category: CategoryId | '';
  onCategoryChange: (category: CategoryId | '') => void;
  /** 입력 중인 검색어. 주소에 적는 시점(디바운스)은 화면이 정한다. */
  search: string;
  onSearchChange: (search: string) => void;
}

const FIELD_CLASS =
  'h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-brand-600';

/**
 * 기간 · 시술 · 검색. **시술 선택지는 9개 대분류**이고, 서버로 가는 것은 그 대분류가 풀린
 * 시술 id 목록이다 (`getLegacyIdsOf`) — 서버는 13개 시술 id 만 알고, 대분류는 프런트의
 * 매핑 계층이다.
 */
export function AdminConsultFilters({
  period,
  onPeriodChange,
  category,
  onCategoryChange,
  search,
  onSearchChange,
}: AdminConsultFiltersProps) {
  return (
    <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end">
      <div className="flex flex-row gap-2">
        <label htmlFor="consult-period" className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-neutral-500">
          기간
          <select
            id="consult-period"
            value={period}
            onChange={(event) => onPeriodChange(event.target.value as ConsultPeriodChoice)}
            className={FIELD_CLASS}
          >
            {CONSULT_PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="consult-category" className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-neutral-500">
          시술
          <select
            id="consult-category"
            value={category}
            onChange={(event) => onCategoryChange(event.target.value as CategoryId | '')}
            className={FIELD_CLASS}
          >
            <option value="">전체 시술</option>
            {CATEGORIES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label htmlFor="consult-q" className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-neutral-500">
        검색
        <input
          id="consult-q"
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="환자 이름 또는 연락처 뒷자리"
          className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-brand-600"
        />
      </label>
    </div>
  );
}
