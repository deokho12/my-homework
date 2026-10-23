import { useRovingTabs } from '@/hooks/useRovingTabs';

/** 탭 = 섹션 순서. 라벨과 키가 한 곳에 있어야 탭과 내용이 어긋나지 않는다. */
export const HOSPITAL_DETAIL_TABS = [
  { key: 'info', label: '정보' },
  { key: 'price', label: '시술·가격' },
  { key: 'doctors', label: '의료진' },
  { key: 'reviews', label: '후기·문의' },
] as const;

export type HospitalDetailTabKey = (typeof HOSPITAL_DETAIL_TABS)[number]['key'];

const TAB_KEYS = HOSPITAL_DETAIL_TABS.map((tab) => tab.key);

export const hospitalTabId = (key: HospitalDetailTabKey) => `hospital-tab-${key}`;
export const hospitalPanelId = (key: HospitalDetailTabKey) => `hospital-panel-${key}`;

interface HospitalDetailTabsProps {
  value: HospitalDetailTabKey;
  onChange: (key: HospitalDetailTabKey) => void;
}

/**
 * 병원 상세의 섹션 탭 4개 (2026-10-23 시안 B).
 *
 * 예전의 목차(점프 바)와 달리 **한 번에 한 섹션만** 보인다. 키보드 처리는 관리자 탭들과
 * 같은 `useRovingTabs` 하나를 쓴다 — ←/→ 는 순환하고, 옮겨간 탭이 바로 열린다.
 */
export function HospitalDetailTabs({ value, onChange }: HospitalDetailTabsProps) {
  const { setRef, onKeyDown } = useRovingTabs(TAB_KEYS, onChange);

  return (
    <div
      role="tablist"
      aria-label="병원 정보"
      className="sticky top-0 z-10 -mx-4 mb-1 flex border-b border-neutral-200 bg-white px-1 md:-mx-6 lg:-mx-8"
    >
      {HOSPITAL_DETAIL_TABS.map((tab, index) => {
        const selected = tab.key === value;

        return (
          <button
            key={tab.key}
            id={hospitalTabId(tab.key)}
            type="button"
            role="tab"
            aria-selected={selected}
            // 패널은 열린 탭의 것 하나만 그려진다 — 닫힌 탭이 없는 id 를 가리키지 않게 한다.
            aria-controls={selected ? hospitalPanelId(tab.key) : undefined}
            tabIndex={selected ? 0 : -1}
            ref={setRef(tab.key)}
            onClick={() => onChange(tab.key)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`min-h-[44px] flex-1 whitespace-nowrap border-b-2 px-1 text-[13px] xs:text-sm ${
              selected
                ? 'border-brand-600 font-semibold text-brand-700'
                : 'border-transparent font-medium text-neutral-600'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
