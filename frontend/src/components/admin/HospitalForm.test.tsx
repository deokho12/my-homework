import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HospitalForm, type RosterSaveAction } from '@/components/admin/HospitalForm';
import { completenessOf } from '@/features/hospital/lib/completeness';
import { fieldAnchorId } from '@/hooks/useFieldJump';
import * as geocoding from '@/services/geocoding';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { Doctor, Hospital } from '@/types/domain';

function baseHospital(overrides: Partial<Hospital> = {}): Hospital {
  return {
    id: 'h1',
    name: '강남 스마일 치과',
    specialty: '임플란트 전문의원',
    region: '서울 강남구',
    latitude: 37.5,
    longitude: 127.0,
    thumbnail: 'https://example.com/thumb.jpg',
    images: [],
    procedureIds: ['implant'],
    priceRange: { min: 100000, max: 200000 },
    rating: 4.8,
    reviewCount: 120,
    consultCount: 90,
    consultAvailable: true,
    businessHours: [],
    directions: '',
    features: {
      coordinator: false,
      painlessAnesthesia: false,
      digitalCare: false,
      parking: false,
      nightConsult: false,
      cctv: false,
    },
    isOneDay: false,
    isRecommended: false,
    isSponsored: false,
    sponsoredCategories: [],
    sponsoredRank: null,
    sponsoredStartDate: null,
    sponsoredEndDate: null,
    tags: [],
    address: '서울특별시 강남구 테헤란로 123',
    introduction: '',
    events: [],
    sponsorship: { isActive: false, isPlacementEligible: false },
    representativeSpecialty: null,
    ...overrides,
  };
}

function baseDoctor(overrides: Partial<Doctor> = {}): Doctor {
  return {
    id: 'd1',
    name: '김민준',
    title: '대표원장',
    specialty: '치과보철전문의',
    hospitalId: 'h1',
    photo: 'https://example.com/photo.jpg',
    procedureIds: ['implant'],
    rating: 4.9,
    reviewCount: 180,
    consultCount: 90,
    certificateUrl: null,
    verificationStatus: 'approved',
    rejectionReason: null,
    isRecommended: false,
    yearsOfExperience: 15,
    career: [],
    visibleSpecialty: '치과보철전문의',
    isVerifiedSpecialist: true,
    ...overrides,
  };
}

describe('HospitalForm — split 모드 (수정 화면)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * 대시보드의 `남은 항목` 칩이 보내는 `?field={target}` 은 **이 폼의 앵커 id** 로 떨어진다.
   * 폼에서 묶음 하나를 빼거나 이름을 바꾸면 칩이 조용히 아무 데도 가지 않는다 —
   * 그 순간을 여기서 잡는다 (완성도 항목 7개 전부).
   */
  it('완성도 항목 7개가 가리키는 입력 칸이 폼에 전부 있다', async () => {
    renderWithProviders(
      <HospitalForm
        mode="split"
        initial={baseHospital()}
        doctors={[baseDoctor()]}
        canEditRecommended={false}
        onSaveHospital={vi.fn()}
        onSaveRoster={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.getByText('전문의 1')).toBeInTheDocument());

    const { items } = completenessOf({
      name: '',
      region: '',
      address: '',
      latitude: 0,
      longitude: 0,
      specialty: '',
      businessHours: [],
      procedureIds: [],
      thumbnail: '',
      introduction: '',
      directions: '',
      doctorCount: 0,
    });

    expect(items).toHaveLength(7);
    for (const item of items) {
      expect(document.getElementById(fieldAnchorId(item.target))).not.toBeNull();
    }
  });

  it('병원 필드 저장은 로스터 상태와 무관하다 — "병원 정보 저장" 버튼은 항상 활성이다', async () => {
    const onSaveHospital = vi.fn();

    renderWithProviders(
      <HospitalForm
        mode="split"
        initial={baseHospital()}
        // 전공이 감춰진(대기중) 전문의가 있어도 병원 필드 저장은 절대 막히면 안 된다.
        doctors={[baseDoctor({ specialty: undefined, visibleSpecialty: null, isVerifiedSpecialist: false })]}
        canEditRecommended={false}
        onSaveHospital={onSaveHospital}
        onSaveRoster={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.getByText('전문의 1')).toBeInTheDocument());

    const saveHospitalButton = screen.getByRole('button', { name: '병원 정보 저장' });
    expect(saveHospitalButton).not.toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(saveHospitalButton);

    expect(onSaveHospital).toHaveBeenCalledTimes(1);
    expect(onSaveHospital.mock.calls[0][0]).toMatchObject({ name: '강남 스마일 치과' });
  });

  it('★ 함정1 — 기존 전문의만 수정(신규 추가 없음)해 저장하면 PATCH 경로(patch)로 가고, 자격증을 안 건드리면 키가 없다', async () => {
    const onSaveRoster = vi.fn();

    renderWithProviders(
      <HospitalForm
        mode="split"
        initial={baseHospital()}
        doctors={[baseDoctor()]}
        canEditRecommended={false}
        onSaveHospital={vi.fn()}
        onSaveRoster={onSaveRoster}
      />
    );

    await waitFor(() => expect(screen.getByText('전문의 1')).toBeInTheDocument());
    await userEvent.type(screen.getByPlaceholderText('직함 (예: 대표원장)'), '2');
    await userEvent.click(screen.getByRole('button', { name: '전문의 정보 저장' }));

    expect(onSaveRoster).toHaveBeenCalledTimes(1);
    const action = onSaveRoster.mock.calls[0][0] as RosterSaveAction;
    expect(action.mode).toBe('patch');
    if (action.mode !== 'patch') throw new Error('unreachable');
    expect(action.updates).toHaveLength(1);
    expect('certificateUrl' in action.updates[0].patch).toBe(false);
  });

  it('자격증 칸에 실제로 입력하면 PATCH 본문에 그 값이 실린다', async () => {
    const onSaveRoster = vi.fn();

    renderWithProviders(
      <HospitalForm
        mode="split"
        initial={baseHospital()}
        doctors={[baseDoctor()]}
        canEditRecommended={false}
        onSaveHospital={vi.fn()}
        onSaveRoster={onSaveRoster}
      />
    );

    await waitFor(() => expect(screen.getByText('전문의 1')).toBeInTheDocument());
    await userEvent.type(
      screen.getByPlaceholderText('자격증/인증서 이미지 URL'),
      'https://example.com/cert.png'
    );
    await userEvent.click(screen.getByRole('button', { name: '전문의 정보 저장' }));

    const action = onSaveRoster.mock.calls[0][0] as RosterSaveAction;
    if (action.mode !== 'patch') throw new Error('unreachable');
    expect(action.updates[0].patch.certificateUrl).toBe('https://example.com/cert.png');
  });

  it('★ 함정2 — 전공이 감춰진 기존 전문의를 "일반의" 로 지어내지 않는다. 새 전문의를 안 더하면 PATCH 로 저장되고 specialty 는 생략된다', async () => {
    const onSaveRoster = vi.fn();

    renderWithProviders(
      <HospitalForm
        mode="split"
        initial={baseHospital()}
        // specialty 가 없다 — 검수 대기/반려 중이라 서버가 감춘 상태(공개 Doctor 계약)를 재현한다.
        doctors={[baseDoctor({ specialty: undefined, visibleSpecialty: null, isVerifiedSpecialist: false })]}
        canEditRecommended={false}
        onSaveHospital={vi.fn()}
        onSaveRoster={onSaveRoster}
      />
    );

    await waitFor(() => expect(screen.getByText('전문의 1')).toBeInTheDocument());
    expect(screen.getByText(/검수 대기 중이라 전공을 확인할 수 없어요/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '일반의' })).toHaveAttribute('aria-pressed', 'false');

    // 새 전문의를 추가하지 않았으므로 전공을 몰라도 로스터 저장 버튼은 막히지 않는다.
    const saveRosterButton = screen.getByRole('button', { name: '전문의 정보 저장' });
    expect(saveRosterButton).not.toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(saveRosterButton);

    const action = onSaveRoster.mock.calls[0][0] as RosterSaveAction;
    expect(action.mode).toBe('patch');
    if (action.mode !== 'patch') throw new Error('unreachable');
    // 모르는 값을 지어내지 않는다 — specialty 키 자체가 없다(PATCH 는 선택 필드라 생략 가능).
    expect('specialty' in action.updates[0].patch).toBe(false);
  });

  it('새 전문의를 추가할 때만 — 감춰진 전공의 기존 전문의가 있으면 저장이 막히고 이유가 표시된다', async () => {
    const onSaveRoster = vi.fn();

    renderWithProviders(
      <HospitalForm
        mode="split"
        initial={baseHospital()}
        doctors={[baseDoctor({ specialty: undefined, visibleSpecialty: null, isVerifiedSpecialist: false })]}
        canEditRecommended={false}
        onSaveHospital={vi.fn()}
        onSaveRoster={onSaveRoster}
      />
    );

    await waitFor(() => expect(screen.getByText('전문의 1')).toBeInTheDocument());

    await userEvent.click(screen.getByText('+ 전문의 추가'));
    await userEvent.type(screen.getAllByPlaceholderText('이름')[1], '박서준');

    expect(
      screen.getByText(/검수 대기·반려 상태인 전문의가 있어 새 전문의를 추가할 수 없어요/)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '전문의 정보 저장' })).toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(screen.getByRole('button', { name: '전문의 정보 저장' }));
    expect(onSaveRoster).not.toHaveBeenCalled();

    // 감춰진 전공을 다시 선택해 풀면(관리자가 실제로 알아서 고른 경우) 그때는 replace 로 저장된다.
    await userEvent.click(screen.getAllByRole('button', { name: '일반의' })[0]);
    expect(screen.getByRole('button', { name: '전문의 정보 저장' })).not.toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(screen.getByRole('button', { name: '전문의 정보 저장' }));
    const action = onSaveRoster.mock.calls[0][0] as RosterSaveAction;
    expect(action.mode).toBe('replace');
    if (action.mode !== 'replace') throw new Error('unreachable');
    expect(action.doctors).toHaveLength(2);
  });

  it('전문의를 제거만 하면(신규 없음) DELETE 대상으로 patch 액션에 실린다', async () => {
    const onSaveRoster = vi.fn();

    renderWithProviders(
      <HospitalForm
        mode="split"
        initial={baseHospital()}
        doctors={[baseDoctor()]}
        canEditRecommended={false}
        onSaveHospital={vi.fn()}
        onSaveRoster={onSaveRoster}
      />
    );

    await waitFor(() => expect(screen.getByText('전문의 1')).toBeInTheDocument());
    await userEvent.click(screen.getByText('삭제'));
    await userEvent.click(screen.getByRole('button', { name: '전문의 정보 저장' }));

    const action = onSaveRoster.mock.calls[0][0] as RosterSaveAction;
    expect(action.mode).toBe('patch');
    if (action.mode !== 'patch') throw new Error('unreachable');
    expect(action.updates).toHaveLength(0);
    expect(action.deletions).toEqual([{ id: 'd1', name: '김민준' }]);
  });

  it('기존 전문의 이름을 지우면 저장이 막히고 DELETE 로 가지 않는다 (조용한 삭제 방지)', async () => {
    const onSaveRoster = vi.fn();

    renderWithProviders(
      <HospitalForm
        mode="split"
        initial={baseHospital()}
        doctors={[baseDoctor()]}
        canEditRecommended={false}
        onSaveHospital={vi.fn()}
        onSaveRoster={onSaveRoster}
      />
    );

    await waitFor(() => expect(screen.getByText('전문의 1')).toBeInTheDocument());
    await userEvent.clear(screen.getByPlaceholderText('이름'));

    expect(screen.getByText(/이름이 비어 있는 전문의가 있어 저장할 수 없어요/)).toBeInTheDocument();
    expect(screen.getByText(/이름 칸이 비어 있어요/)).toHaveTextContent('김민준');
    expect(screen.getByRole('button', { name: '전문의 정보 저장' })).toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(screen.getByRole('button', { name: '전문의 정보 저장' }));
    expect(onSaveRoster).not.toHaveBeenCalled();
  });

  it('새로 추가한 빈 이름 행은 조용히 빠지고 저장을 막지 않는다', async () => {
    const onSaveRoster = vi.fn();

    renderWithProviders(
      <HospitalForm
        mode="split"
        initial={baseHospital()}
        doctors={[baseDoctor()]}
        canEditRecommended={false}
        onSaveHospital={vi.fn()}
        onSaveRoster={onSaveRoster}
      />
    );

    await waitFor(() => expect(screen.getByText('전문의 1')).toBeInTheDocument());
    await userEvent.click(screen.getByText('+ 전문의 추가'));
    // 새로 추가한 "전문의 2" 의 이름은 비워둔 채로 둔다 — id 가 없는 새 행이라 조용히 빠져야 한다.

    expect(screen.queryByText(/이름이 비어 있는 전문의가 있어 저장할 수 없어요/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '전문의 정보 저장' })).not.toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(screen.getByRole('button', { name: '전문의 정보 저장' }));

    const action = onSaveRoster.mock.calls[0][0] as RosterSaveAction;
    expect(action.mode).toBe('patch');
    if (action.mode !== 'patch') throw new Error('unreachable');
    expect(action.deletions).toEqual([]);
    expect(action.updates).toHaveLength(1); // 기존 전문의(김민준)는 변경 없이도 patch 에 실린다 — 기존 동작
  });

  it('canEditRecommended=false 면 추천 병원 체크박스를 숨기고 현재 상태만 읽기 전용으로 보여준다', async () => {

    renderWithProviders(
      <HospitalForm
        mode="split"
        initial={baseHospital({ isRecommended: true })}
        doctors={[]}
        canEditRecommended={false}
        onSaveHospital={vi.fn()}
        onSaveRoster={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.getByText(/추천 병원 노출/)).toBeInTheDocument());
    expect(screen.queryByText('추천 병원으로 노출 (에디터 추천)')).not.toBeInTheDocument();
  });
});

describe('HospitalForm — combined 모드 (등록 화면)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('canEditRecommended=true 면 체크박스를 보여주고 켜면 isRecommended 를 함께 보낸다', async () => {
    vi.spyOn(geocoding, 'searchAddress').mockResolvedValue([
      { id: 'a1', addressName: '서울 강남구 테스트로 1', latitude: 37.1, longitude: 127.1 },
    ]);
    const onSubmit = vi.fn();

    renderWithProviders(
      <HospitalForm mode="combined" canEditRecommended submitLabel="등록하기" onSubmit={onSubmit} />
    );

    await userEvent.type(screen.getByPlaceholderText('병원명을 입력해주세요'), '새 치과');
    await userEvent.type(screen.getByPlaceholderText('예: 서울 강남구'), '서울 강남구');
    await userEvent.type(screen.getByPlaceholderText('도로명 또는 지번 주소를 입력해주세요'), '테스트로');
    await waitFor(() => expect(screen.getByText('서울 강남구 테스트로 1')).toBeInTheDocument());
    await userEvent.click(screen.getByText('서울 강남구 테스트로 1'));
    await userEvent.click(screen.getByRole('button', { name: '일반 임플란트' }));
    await userEvent.type(screen.getByPlaceholderText('최소'), '100000');
    await userEvent.type(screen.getByPlaceholderText('최대'), '200000');

    await userEvent.click(screen.getByText('추천 병원으로 노출 (에디터 추천)'));
    await userEvent.click(screen.getByRole('button', { name: '등록하기' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const [data] = onSubmit.mock.calls[0];
    expect(data.isRecommended).toBe(true);
  });

  it('등록 시 대표 이미지가 캐러셀 images 로도 함께 전송된다', async () => {
    vi.spyOn(geocoding, 'searchAddress').mockResolvedValue([
      { id: 'a1', addressName: '서울 강남구 테스트로 1', latitude: 37.1, longitude: 127.1 },
    ]);
    const onSubmit = vi.fn();

    renderWithProviders(
      <HospitalForm mode="combined" canEditRecommended={false} submitLabel="등록하기" onSubmit={onSubmit} />
    );

    await userEvent.type(screen.getByPlaceholderText('병원명을 입력해주세요'), '새 치과');
    await userEvent.type(screen.getByPlaceholderText('예: 서울 강남구'), '서울 강남구');
    await userEvent.type(screen.getByPlaceholderText('도로명 또는 지번 주소를 입력해주세요'), '테스트로');
    await waitFor(() => expect(screen.getByText('서울 강남구 테스트로 1')).toBeInTheDocument());
    await userEvent.click(screen.getByText('서울 강남구 테스트로 1'));
    await userEvent.click(screen.getByRole('button', { name: '일반 임플란트' }));
    await userEvent.type(screen.getByPlaceholderText('최소'), '100000');
    await userEvent.type(screen.getByPlaceholderText('최대'), '200000');
    await userEvent.type(screen.getByPlaceholderText('https://...'), 'https://example.com/my-thumb.jpg');

    await userEvent.click(screen.getByRole('button', { name: '등록하기' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const [data] = onSubmit.mock.calls[0];
    expect(data.thumbnail).toBe('https://example.com/my-thumb.jpg');
    expect(data.images).toEqual(['https://example.com/my-thumb.jpg']);
  });

  it('대표 이미지를 비워두고 등록하면 플레이스홀더 이미지가 images 에도 그대로 들어간다', async () => {
    vi.spyOn(geocoding, 'searchAddress').mockResolvedValue([
      { id: 'a1', addressName: '서울 강남구 테스트로 1', latitude: 37.1, longitude: 127.1 },
    ]);
    const onSubmit = vi.fn();

    renderWithProviders(
      <HospitalForm mode="combined" canEditRecommended={false} submitLabel="등록하기" onSubmit={onSubmit} />
    );

    await userEvent.type(screen.getByPlaceholderText('병원명을 입력해주세요'), '새 치과');
    await userEvent.type(screen.getByPlaceholderText('예: 서울 강남구'), '서울 강남구');
    await userEvent.type(screen.getByPlaceholderText('도로명 또는 지번 주소를 입력해주세요'), '테스트로');
    await waitFor(() => expect(screen.getByText('서울 강남구 테스트로 1')).toBeInTheDocument());
    await userEvent.click(screen.getByText('서울 강남구 테스트로 1'));
    await userEvent.click(screen.getByRole('button', { name: '일반 임플란트' }));
    await userEvent.type(screen.getByPlaceholderText('최소'), '100000');
    await userEvent.type(screen.getByPlaceholderText('최대'), '200000');
    // 대표 이미지는 선택 입력이라 비워둔다.

    await userEvent.click(screen.getByRole('button', { name: '등록하기' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const [data] = onSubmit.mock.calls[0];
    expect(data.thumbnail).toBe('https://picsum.photos/seed/molarmolar-new/800/500');
    expect(data.images).toEqual(['https://picsum.photos/seed/molarmolar-new/800/500']);
  });

  it('새로 추가하는 전문의는 항상 기본 전공이 선택돼 있어 등록이 막히지 않는다', async () => {
    vi.spyOn(geocoding, 'searchAddress').mockResolvedValue([
      { id: 'a1', addressName: '서울 강남구 테스트로 1', latitude: 37.1, longitude: 127.1 },
    ]);
    const onSubmit = vi.fn();

    renderWithProviders(<HospitalForm mode="combined" canEditRecommended={false} submitLabel="등록하기" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByPlaceholderText('병원명을 입력해주세요'), '새 치과');
    await userEvent.type(screen.getByPlaceholderText('예: 서울 강남구'), '서울 강남구');
    await userEvent.type(screen.getByPlaceholderText('도로명 또는 지번 주소를 입력해주세요'), '테스트로');
    await waitFor(() => expect(screen.getByText('서울 강남구 테스트로 1')).toBeInTheDocument());
    await userEvent.click(screen.getByText('서울 강남구 테스트로 1'));
    await userEvent.click(screen.getByRole('button', { name: '일반 임플란트' }));
    await userEvent.type(screen.getByPlaceholderText('최소'), '100000');
    await userEvent.type(screen.getByPlaceholderText('최대'), '200000');

    await userEvent.click(screen.getByText('+ 전문의 추가'));
    await userEvent.type(screen.getByPlaceholderText('이름'), '김민준');

    expect(screen.getByRole('button', { name: '등록하기' })).not.toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(screen.getByRole('button', { name: '등록하기' }));

    const [, doctors] = onSubmit.mock.calls[0];
    expect(doctors[0]).toMatchObject({ name: '김민준' });
  });
});

/**
 * 취급 시술은 화면에서 **세부 시술**(31개)로 고르고, 서버에는 그 세부가 가리키는
 * **서버 시술 13종**으로만 보낸다 (`features/procedure/taxonomy.ts`). 서버가 모르는 세부
 * 18개는 보이되 비활성이고, 서버만 아는 id 는 화면을 거쳐도 사라지지 않아야 한다.
 */
describe('HospitalForm — 취급 시술 (대분류 → 세부 시술)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('기존 procedureIds 는 세부 시술 체크로 되살아나고, 그 대분류 섹션이 펼쳐져 있다', async () => {
    renderWithProviders(
      <HospitalForm
        mode="split"
        initial={baseHospital({ procedureIds: ['implant', 'crown'] })}
        doctors={[]}
        canEditRecommended={false}
        onSaveHospital={vi.fn()}
        onSaveRoster={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: '일반 임플란트' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '크라운' })).toHaveAttribute('aria-pressed', 'true');
    // 같은 섹션의 다른 세부는 펼쳐져 있되 꺼져 있다 — 섹션이 실제로 열렸다는 증거다.
    expect(screen.getByRole('button', { name: '인레이' })).toHaveAttribute('aria-pressed', 'false');
    // 선택이 없는 대분류(교정)는 접혀 있다.
    expect(screen.queryByRole('button', { name: '투명교정' })).not.toBeInTheDocument();
  });

  it('준비중 세부 시술(신경치료)은 눌러도 선택되지 않는다', async () => {
    renderWithProviders(
      <HospitalForm
        mode="split"
        initial={baseHospital({ procedureIds: ['crown'] })}
        doctors={[]}
        canEditRecommended={false}
        onSaveHospital={vi.fn()}
        onSaveRoster={vi.fn()}
      />
    );

    const rootCanal = screen.getByRole('button', { name: '신경치료' });
    expect(rootCanal).toHaveAttribute('aria-disabled', 'true');
    expect(rootCanal).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(rootCanal);

    expect(screen.getByRole('button', { name: '신경치료' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('세부 시술(레진)을 고르면 저장 payload 에는 서버 id(cavity)만 실린다', async () => {
    const onSaveHospital = vi.fn();

    renderWithProviders(
      <HospitalForm
        mode="split"
        initial={baseHospital({ procedureIds: [] })}
        doctors={[]}
        canEditRecommended={false}
        onSaveHospital={onSaveHospital}
        onSaveRoster={vi.fn()}
      />
    );

    // 선택이 없으면 모든 섹션이 접혀 있다 — 충치치료를 펼쳐야 레진이 보인다.
    await userEvent.click(screen.getByRole('button', { name: '충치치료 펼치기' }));
    // 펼친 뒤에는 같은 버튼이 "접기" 로 읽히고, 열린 상태가 aria-pressed 로 드러난다.
    expect(screen.getByRole('button', { name: '충치치료 접기' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: '충치치료 펼치기' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '레진' }));
    await userEvent.click(screen.getByRole('button', { name: '병원 정보 저장' }));

    expect(onSaveHospital).toHaveBeenCalledTimes(1);
    const data = onSaveHospital.mock.calls[0][0];
    expect(data.procedureIds).toEqual(['cavity']);
    // 화면 전용 세부 id 는 절대 서버로 가지 않는다 — 서버는 DB 행 존재로 검증해 422 를 낸다.
    expect(data.procedureIds).not.toContain('resin');
  });

  it('취급 시술을 전부 해제하면 저장할 수 없다', async () => {
    renderWithProviders(
      <HospitalForm
        mode="split"
        initial={baseHospital({ procedureIds: ['implant'] })}
        doctors={[]}
        canEditRecommended={false}
        onSaveHospital={vi.fn()}
        onSaveRoster={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: '병원 정보 저장' })).not.toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(screen.getByRole('button', { name: '일반 임플란트' }));

    expect(screen.getByRole('button', { name: '일반 임플란트' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '병원 정보 저장' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('모르는 서버 id 만 있어도 "1개 이상" 을 만족해 저장할 수 있다', async () => {
    renderWithProviders(
      <HospitalForm
        mode="split"
        // 알려진 시술은 0개다 — 그래도 이 병원은 "취급 시술이 없는 병원" 이 아니다.
        initial={baseHospital({ procedureIds: ['future-id' as never] })}
        doctors={[]}
        canEditRecommended={false}
        onSaveHospital={vi.fn()}
        onSaveRoster={vi.fn()}
      />
    );

    // 알려진 세부 시술 선택은 0개다 — 어느 섹션 헤더에도 "N개 선택" 이 없고, 선택이 있는
    // 섹션만 펼치는 규칙에 따라 세부 체크박스 자체가 화면에 없다.
    expect(screen.queryByText(/개 선택/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '일반 임플란트' })).not.toBeInTheDocument();
    expect(screen.getByText('화면에 없는 시술 1개는 저장 시 그대로 유지돼요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '병원 정보 저장' })).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('taxonomy 가 모르는 서버 id 는 화면에 없어도 저장 시 그대로 보존된다', async () => {
    const onSaveHospital = vi.fn();

    renderWithProviders(
      <HospitalForm
        mode="split"
        // 백엔드가 나중에 추가한 시술을 재현한다 — 이 화면을 거쳤다고 사라지면 안 된다.
        initial={baseHospital({ procedureIds: ['implant', 'future-id' as never] })}
        doctors={[]}
        canEditRecommended={false}
        onSaveHospital={onSaveHospital}
        onSaveRoster={vi.fn()}
      />
    );

    expect(screen.getByText('화면에 없는 시술 1개는 저장 시 그대로 유지돼요')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '병원 정보 저장' }));

    const data = onSaveHospital.mock.calls[0][0];
    expect(data.procedureIds).toEqual(['implant', 'future-id']);
  });
});
