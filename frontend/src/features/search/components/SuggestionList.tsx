import { Building2, UserRound } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/Badge";
import { CONTAINER_PADDING } from "@/components/layout/Container";
import { useHospitalName } from "@/features/hospital/hooks/useHospitalName";
import { cx } from "@/primitives";
import {
  MIN_CHARS_HINT,
  splitHighlight,
  suggestionOptionId,
  type DoctorSuggestion,
  type HospitalSuggestion,
  type ProcedureSuggestion,
  type Suggestion,
  type SuggestionGroups,
} from "@/features/search/suggest";
import type { SuggestionGroupState } from "@/features/search/useSuggestions";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";
import { CATEGORY_ICONS, type IconComponent } from "@/utils/procedureIcons";

/**
 * 입력 중 추천 목록 — **표시만 한다**(판정·조회 없음).
 *
 * 떠 있는 드롭다운이 아니라 인기 검색어가 있던 **문서 흐름 그 자리**를 대신한다. 그래서
 * 오버레이 z-index·바깥 클릭 닫기·모바일 키보드 가림 문제가 없다.
 *
 * 포커스는 입력칸에서 떠나지 않는다 — 행은 `role="option"` 이고 활성 항목은 입력칸의
 * `aria-activedescendant` 가 가리킨다(DOM 포커스를 옮기면 모바일 키보드가 닫힌다).
 * 그래서 클릭은 blur 보다 먼저 도는 `onMouseDown` 으로 받는다.
 */

/** brand-600. lucide 아이콘은 클래스가 아니라 색 값을 받는다 (`tailwind.config.js` 와 같은 값). */
const BRAND_COLOR = "#17847a";
const NEUTRAL_COLOR = "#737373";

export interface SuggestionListProps {
  listId: string;
  query: string;
  groups: SuggestionGroups;
  activeId: string | null;
  onSelect: (suggestion: Suggestion) => void;
  hospitals: SuggestionGroupState;
  doctors: SuggestionGroupState;
  /** 1자·미완성 자모라 병원·원장님을 묻지 않은 상태 — 조용히 빼면 고장으로 읽힌다. */
  showMinCharsHint: boolean;
}

function Highlighted({ text, query }: { text: string; query: string }) {
  // 굵게는 보조 수단이다 — 행 전체가 `aria-label` 로 한 번에 읽히므로 `<strong>` 을 쓰지 않는다.
  return (
    <>
      {splitHighlight(text, query).map((segment, index) => (
        <span
          key={`${index}-${segment.text}`}
          className={segment.match ? "font-bold" : undefined}
        >
          {segment.text}
        </span>
      ))}
    </>
  );
}

function GroupTitle({
  id,
  label,
  withDivider,
}: {
  id: string;
  label: string;
  withDivider: boolean;
}) {
  return (
    <div
      id={id}
      aria-hidden="true"
      className={cx(
        CONTAINER_PADDING,
        "pb-1 pt-4 text-xs font-semibold text-neutral-500",
        withDivider && "border-t border-neutral-100",
      )}
    >
      {label}
    </div>
  );
}

interface RowProps {
  suggestion: Suggestion;
  active: boolean;
  label: string;
  icon: IconComponent;
  iconColor: string;
  title: ReactNode;
  badge?: ReactNode;
  subtitle: string;
  onSelect: (suggestion: Suggestion) => void;
}

function SuggestionRow({
  suggestion,
  active,
  label,
  icon: Icon,
  iconColor,
  title,
  badge,
  subtitle,
  onSelect,
}: RowProps) {
  return (
    <div
      role="option"
      id={suggestionOptionId(suggestion)}
      aria-selected={active}
      aria-label={label}
      // 탭 순서에는 넣지 않는다 — 포커스는 입력칸에 남고 활성은 `aria-activedescendant` 가 가리킨다.
      tabIndex={-1}
      onMouseDown={(event) => {
        // blur 보다 먼저 처리한다 — 포커스가 입력칸을 떠나면 모바일 키보드가 닫힌다.
        event.preventDefault();
        onSelect(suggestion);
      }}
      className={cx(
        CONTAINER_PADDING,
        "flex min-h-14 cursor-pointer flex-row items-center gap-3 border-l-2 md:min-h-12",
        active
          ? "border-brand-600 bg-brand-50"
          : "border-transparent hover:bg-neutral-50",
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-50">
        <Icon size={20} color={iconColor} />
      </span>
      {/* 하이라이트는 행 전체 폭, 글자는 왼쪽 768px 안 — 1200px 에서 이름과 배지가 멀어지지 않게. */}
      <div className="flex min-w-0 flex-1 flex-col md:max-w-3xl md:flex-row md:items-center">
        <div className="flex min-w-0 flex-row items-center gap-1.5">
          <span className="truncate text-[15px] font-medium text-neutral-900">
            {title}
          </span>
          {badge}
        </div>
        <span className="truncate text-[13px] text-neutral-500 md:ml-3 md:flex-1">
          {subtitle}
        </span>
      </div>
    </div>
  );
}

function ProcedureRow({
  suggestion,
  query,
  active,
  onSelect,
}: {
  suggestion: ProcedureSuggestion;
  query: string;
  active: boolean;
  onSelect: (suggestion: Suggestion) => void;
}) {
  return (
    <SuggestionRow
      suggestion={suggestion}
      active={active}
      // 배지의 뜻이 글자로 들어간다 — 색·칩만으로 전달되는 정보가 없다.
      label={[
        suggestion.title,
        suggestion.comingSoon ? "준비중" : null,
        suggestion.subtitle,
      ]
        .filter(Boolean)
        .join(", ")}
      icon={CATEGORY_ICONS[suggestion.match.category.id]}
      iconColor={BRAND_COLOR}
      title={<Highlighted text={suggestion.title} query={query} />}
      badge={suggestion.comingSoon ? <Badge label="준비중" /> : undefined}
      subtitle={suggestion.subtitle}
      onSelect={onSelect}
    />
  );
}

function HospitalRow({
  suggestion,
  query,
  active,
  onSelect,
}: {
  suggestion: HospitalSuggestion;
  query: string;
  active: boolean;
  onSelect: (suggestion: Suggestion) => void;
}) {
  return (
    <SuggestionRow
      suggestion={suggestion}
      active={active}
      label={[
        suggestion.title,
        suggestion.sponsored ? "광고" : null,
        suggestion.subtitle,
      ]
        .filter(Boolean)
        .join(", ")}
      icon={Building2}
      iconColor={NEUTRAL_COLOR}
      title={<Highlighted text={suggestion.title} query={query} />}
      badge={suggestion.sponsored ? <Badge label="광고" /> : undefined}
      subtitle={suggestion.subtitle}
      onSelect={onSelect}
    />
  );
}

function DoctorRow({
  suggestion,
  query,
  active,
  onSelect,
}: {
  suggestion: DoctorSuggestion;
  query: string;
  active: boolean;
  onSelect: (suggestion: Suggestion) => void;
}) {
  // `Doctor` 응답에 병원 이름이 없어 행마다 조회한다 — 마이페이지·관리자 상담 목록과 같은 훅이다
  // (`docs/features/known-issues.md`). 조회 중에는 `—`, 끝났는데 없으면 `알 수 없는 병원`.
  const hospitalName = useHospitalName(suggestion.hospitalId);
  // `visibleSpecialty` 가 null 이면 전공 조각과 가운뎃점을 통째로 뺀다 — 인증 판정은
  // 서버 계산 필드 그대로 쓰고 화면이 새로 만들지 않는다.
  const subtitle = suggestion.specialty
    ? `${hospitalName} · ${suggestion.specialty}`
    : hospitalName;

  return (
    <SuggestionRow
      suggestion={suggestion}
      active={active}
      label={`${suggestion.title}, ${subtitle}`}
      icon={UserRound}
      iconColor={NEUTRAL_COLOR}
      title={<Highlighted text={suggestion.title} query={query} />}
      subtitle={subtitle}
      onSelect={onSelect}
    />
  );
}

function SkeletonRows() {
  return (
    <div aria-hidden="true">
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          className={cx(
            CONTAINER_PADDING,
            "flex min-h-14 flex-col justify-center gap-2 md:min-h-12",
          )}
        >
          <div className="h-4 w-32 rounded bg-neutral-100 motion-safe:animate-pulse" />
          <div className="h-3 w-48 rounded bg-neutral-100 motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function GroupError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      className={cx(
        CONTAINER_PADDING,
        "flex min-h-14 flex-row items-center gap-3",
      )}
    >
      <span className="text-[13px] text-neutral-500">{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="text-[13px] font-semibold text-brand-600 underline"
      >
        다시 시도
      </button>
    </div>
  );
}

export function SuggestionList({
  listId,
  query,
  groups,
  activeId,
  onSelect,
  hospitals,
  doctors,
  showMinCharsHint,
}: SuggestionListProps) {
  // 목서버의 인위적 지연(180ms)에서 깜빡이지 않도록 200ms 이상 걸릴 때만 스켈레톤을 낸다.
  const showHospitalSkeleton = useDelayedFlag(
    hospitals.isLoading && !hospitals.isError,
    200,
  );
  const showDoctorSkeleton = useDelayedFlag(
    doctors.isLoading && !doctors.isError,
    200,
  );

  const hospitalGroupShown =
    groups.hospitals.length > 0 || showHospitalSkeleton || hospitals.isError;
  const doctorGroupShown =
    groups.doctors.length > 0 || showDoctorSkeleton || doctors.isError;
  const procedureGroupShown = groups.procedures.length > 0;

  return (
    <div id={listId} role="listbox" aria-label="검색 추천">
      {procedureGroupShown ? (
        <div role="group" aria-labelledby={`${listId}-procedure`}>
          <GroupTitle
            id={`${listId}-procedure`}
            label="시술"
            withDivider={false}
          />
          {groups.procedures.map((suggestion) => (
            <ProcedureRow
              key={suggestion.id}
              suggestion={suggestion}
              query={query}
              active={activeId === suggestionOptionId(suggestion)}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}

      {hospitalGroupShown ? (
        <div role="group" aria-labelledby={`${listId}-hospital`}>
          <GroupTitle
            id={`${listId}-hospital`}
            label="병원"
            withDivider={procedureGroupShown}
          />
          {hospitals.isError ? (
            <GroupError
              message="병원 추천을 불러오지 못했어요"
              onRetry={hospitals.retry}
            />
          ) : groups.hospitals.length > 0 ? (
            groups.hospitals.map((suggestion) => (
              <HospitalRow
                key={suggestion.id}
                suggestion={suggestion}
                query={query}
                active={activeId === suggestionOptionId(suggestion)}
                onSelect={onSelect}
              />
            ))
          ) : (
            <SkeletonRows />
          )}
        </div>
      ) : null}

      {doctorGroupShown ? (
        <div role="group" aria-labelledby={`${listId}-doctor`}>
          <GroupTitle
            id={`${listId}-doctor`}
            label="원장님"
            withDivider={procedureGroupShown || hospitalGroupShown}
          />
          {doctors.isError ? (
            <GroupError
              message="원장님 추천을 불러오지 못했어요"
              onRetry={doctors.retry}
            />
          ) : groups.doctors.length > 0 ? (
            groups.doctors.map((suggestion) => (
              <DoctorRow
                key={suggestion.id}
                suggestion={suggestion}
                query={query}
                active={activeId === suggestionOptionId(suggestion)}
                onSelect={onSelect}
              />
            ))
          ) : (
            <SkeletonRows />
          )}
        </div>
      ) : null}

      {showMinCharsHint ? (
        <div
          className={cx(
            CONTAINER_PADDING,
            "pb-1 pt-3 text-xs text-neutral-500",
          )}
        >
          {MIN_CHARS_HINT}
        </div>
      ) : null}
    </div>
  );
}
