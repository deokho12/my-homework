import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HospitalForm, type RosterSaveAction } from '@/components/admin/HospitalForm';
import * as procedureApi from '@/features/procedure/api/procedureApi';
import * as geocoding from '@/services/geocoding';
import { procedures } from '@/mocks/fixtures/procedures';
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

  it('병원 필드 저장은 로스터 상태와 무관하다 — "병원 정보 저장" 버튼은 항상 활성이다', async () => {
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
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
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
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
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
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
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
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
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
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
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
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

  it('canEditRecommended=false 면 추천 병원 체크박스를 숨기고 현재 상태만 읽기 전용으로 보여준다', async () => {
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);

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
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
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
    await userEvent.click(screen.getByRole('button', { name: '임플란트' }));
    await userEvent.type(screen.getByPlaceholderText('최소'), '100000');
    await userEvent.type(screen.getByPlaceholderText('최대'), '200000');

    await userEvent.click(screen.getByText('추천 병원으로 노출 (에디터 추천)'));
    await userEvent.click(screen.getByRole('button', { name: '등록하기' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const [data] = onSubmit.mock.calls[0];
    expect(data.isRecommended).toBe(true);
  });

  it('새로 추가하는 전문의는 항상 기본 전공이 선택돼 있어 등록이 막히지 않는다', async () => {
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
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
    await userEvent.click(screen.getByRole('button', { name: '임플란트' }));
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
