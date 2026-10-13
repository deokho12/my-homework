import type { HospitalFieldKey } from '@/features/hospital/lib/hospitalFieldErrors';
import type { BusinessHourEntry } from '@/types/domain';

/**
 * 병원 정보 완성도의 **판정 규칙**. DB 도 요청도 React 도 모르는 순수 함수다 —
 * `docs/database/README.md` §13.7 이 서버에 요구한 것과 **같은 항목·같은 순서·같은 경계값**
 * 이고, 서버가 생기면 그쪽 `hospital/completeness.ts` 와 이 파일이 같은 표를 구현한다.
 *
 * **항목 선정 기준 하나: 담당자가 지금 이 화면에서 입력할 수 있는가.** 채울 수단이 없는
 * 항목을 넣으면 `남은 항목` 을 눌러도 갈 곳이 없고 **영원히 100%가 되지 않는 바**가 된다.
 * 그래서 `시술별 가격`·`병원 사진 3장` 은 입력 수단이 생기는 요청 07 의 자리다.
 */

/** **이 배열의 순서가 곧 `남은 항목` 의 순서이고, 그 순서가 계약이다** (화면이 다시 정렬하지 않는다). */
export const COMPLETENESS_ITEMS = [
  'basicInfo',
  'businessHours',
  'procedures',
  'thumbnail',
  'introduction',
  'directions',
  'doctors',
] as const;

export type CompletenessItemKey = (typeof COMPLETENESS_ITEMS)[number];

/**
 * 못 채웠을 때 포커스를 옮길 입력 칸. **`HOSPITAL_FIELD_KEYS`(서버 `422` 의
 * `details[].field`)와 같은 어휘**라, 완성도 항목과 검증 오류가 같은 키로 같은 칸을 가리킨다.
 *
 * `doctors` 만 그 배열에 없다 — 병원 필드가 아니라 수정 화면의 **의료진 영역**이다
 * (요청 07 이 화면을 분리하면 그 라우트가 된다).
 */
export type CompletenessTarget = Extract<
  HospitalFieldKey,
  'name' | 'businessHours' | 'procedureIds' | 'thumbnail' | 'introduction' | 'directions'
> | 'doctors';

export interface CompletenessItem {
  key: CompletenessItemKey;
  /** 화면에 그대로 쓰는 한국어 라벨. 서버가 내려주는 값이라 화면이 매핑 표를 들지 않는다. */
  label: string;
  done: boolean;
  target: CompletenessTarget;
}

export interface Completeness {
  percent: number;
  /** **충족한 것까지 전부**, 고정 순서. `남은 항목` 은 `items.filter(!done)` 이다. */
  items: CompletenessItem[];
  /** `percent` 와 **별개 경고**다 — 86% 인데 환자가 시술로는 못 찾는 상태가 가능하다. */
  noProcedures: boolean;
}

/**
 * 등록 화면이 `대표 이미지 URL` 을 비워 두면 채워 넣는 플레이스홀더.
 *
 * **완성도는 이 값을 "안 채운 것" 으로 센다** — 저장은 되었지만 담당자가 고른 사진이 아니다.
 * 폼과 판정이 같은 상수를 보지 않으면, 폼이 채운 값을 완성도가 진짜 사진으로 읽는다.
 */
export const DEFAULT_THUMBNAIL_URL = 'https://picsum.photos/seed/molarmolar-new/800/500';

/**
 * "비어 있지 않음" 이 아니라 **최소 길이**인 항목이 둘이다. 둘 다 서버 기본값이 빈 문자열이고
 * 한 글자만 넣어도 채워진다. 글자 수는 임의값이지만 상수가 여기 있어 바꾸는 비용이 한 줄이다.
 */
export const INTRODUCTION_MIN_LENGTH = 30;
export const DIRECTIONS_MIN_LENGTH = 10;

/** 진료시간은 **7요일이 모두 있어야** 충족이다. */
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'] as const;

export interface CompletenessInput {
  name: string;
  region: string;
  address: string;
  latitude: number;
  longitude: number;
  specialty: string;
  businessHours: ReadonlyArray<BusinessHourEntry>;
  procedureIds: ReadonlyArray<string>;
  thumbnail: string;
  introduction: string;
  directions: string;
  /** 그 병원 소속 전문의 수. **검수 상태를 묻지 않는다.** */
  doctorCount: number;
}

function filled(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * `round(충족 수 / 전체 수 × 100)`, **동일 가중치**. 가중치를 두는 순간 "왜 사진이 소개보다
 * 2배인가" 를 설명할 근거가 필요한데 화면에 없다.
 *
 * **전부 충족이 아니면 99 를 넘기지 않는다** — 항목이 07 에서 늘어나면 반올림이 `100%` 를
 * 만들어 `남은 항목: 시술 가격` 과 `100%` 가 나란히 보이는 날이 온다.
 */
export function completenessPercent(doneCount: number, totalCount: number): number {
  if (totalCount === 0) return 0;
  if (doneCount >= totalCount) return 100;

  return Math.min(99, Math.round((doneCount / totalCount) * 100));
}

const RULES: Record<CompletenessItemKey, { label: string; target: CompletenessTarget; done: (input: CompletenessInput) => boolean }> = {
  basicInfo: {
    label: '기본 정보',
    target: 'name',
    done: (input) =>
      filled(input.name) &&
      filled(input.region) &&
      filled(input.address) &&
      // 좌표가 0 이면 지도에 아프리카 앞바다가 찍힌다 — 저장은 됐어도 채운 것이 아니다.
      input.latitude !== 0 &&
      input.longitude !== 0 &&
      filled(input.specialty),
  },
  businessHours: {
    label: '진료시간',
    target: 'businessHours',
    done: (input) => {
      const byDay = new Map(input.businessHours.map((entry) => [entry.day, entry]));

      return WEEKDAYS.every((day) => {
        const entry = byDay.get(day);

        if (!entry) return false;

        return entry.isClosed === true || filled(entry.hours);
      });
    },
  },
  procedures: { label: '진료 시술', target: 'procedureIds', done: (input) => input.procedureIds.length >= 1 },
  thumbnail: {
    label: '대표 이미지',
    target: 'thumbnail',
    done: (input) => filled(input.thumbnail) && input.thumbnail.trim() !== DEFAULT_THUMBNAIL_URL,
  },
  introduction: {
    label: '병원 소개',
    target: 'introduction',
    done: (input) => input.introduction.trim().length >= INTRODUCTION_MIN_LENGTH,
  },
  directions: {
    label: '찾아오시는 길',
    target: 'directions',
    done: (input) => input.directions.trim().length >= DIRECTIONS_MIN_LENGTH,
  },
  doctors: { label: '의료진', target: 'doctors', done: (input) => input.doctorCount >= 1 },
};

/** 이미 읽어 둔 값만 받는다 — 어디서 왔는지(서버 응답인지 폼 상태인지)를 모른다. */
export function completenessOf(input: CompletenessInput): Completeness {
  const items = COMPLETENESS_ITEMS.map((key) => ({
    key,
    label: RULES[key].label,
    done: RULES[key].done(input),
    target: RULES[key].target,
  }));

  return {
    percent: completenessPercent(items.filter((item) => item.done).length, items.length),
    items,
    noProcedures: input.procedureIds.length === 0,
  };
}
