import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import * as procedureApi from '@/features/procedure/api/procedureApi';
import { procedures } from '@/mocks/fixtures/procedures';
import { RouterBridge } from '@/navigation';
import AdminHospitalNewPage from '@/pages/admin/AdminHospitalNewPage';
import * as geocoding from '@/services/geocoding';
import { renderWithProviders } from '@/test/renderWithProviders';

function renderPage() {
  return renderWithProviders(
    <>
      <RouterBridge />
      <AdminHospitalNewPage />
    </>
  );
}

async function fillMinimumRequiredFields() {
  await userEvent.type(screen.getByPlaceholderText('병원명을 입력해주세요'), '새 치과');
  await userEvent.type(screen.getByPlaceholderText('예: 서울 강남구'), '서울 강남구');
  await userEvent.type(screen.getByPlaceholderText('도로명 또는 지번 주소를 입력해주세요'), '테스트로');
  await waitFor(() => expect(screen.getByText('서울 강남구 테스트로 1')).toBeInTheDocument());
  await userEvent.click(screen.getByText('서울 강남구 테스트로 1'));
  await userEvent.click(screen.getByRole('button', { name: '임플란트' }));
  await userEvent.type(screen.getByPlaceholderText('최소'), '100000');
  await userEvent.type(screen.getByPlaceholderText('최대'), '200000');
}

describe('AdminHospitalNewPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('전문의를 함께 입력하면 POST /hospitals 한 번에 doctors 를 실어 원자적으로 등록한다', async () => {
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
    vi.spyOn(geocoding, 'searchAddress').mockResolvedValue([
      { id: 'a1', addressName: '서울 강남구 테스트로 1', latitude: 37.1, longitude: 127.1 },
    ]);
    const createSpy = vi.spyOn(hospitalApi, 'createHospital').mockResolvedValue({ id: 'new-hospital' } as never);

    renderPage();

    await fillMinimumRequiredFields();

    await userEvent.click(screen.getByText('+ 전문의 추가'));
    await userEvent.type(screen.getByPlaceholderText('이름'), '김민준');
    await userEvent.click(screen.getByRole('button', { name: '등록하기' }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    const input = createSpy.mock.calls[0][0];
    expect(input.doctors).toHaveLength(1);
    expect(input.doctors?.[0]).toMatchObject({ name: '김민준', specialty: '치과보철전문의' });
  });

  it('422 FIELD_NOT_WRITABLE 응답은 해당 입력 칸 아래에 표시된다', async () => {
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
    vi.spyOn(geocoding, 'searchAddress').mockResolvedValue([
      { id: 'a1', addressName: '서울 강남구 테스트로 1', latitude: 37.1, longitude: 127.1 },
    ]);
    const { ApiError } = await import('@/lib/apiClient');
    vi.spyOn(hospitalApi, 'createHospital').mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'FIELD_NOT_WRITABLE',
        message: '수정할 수 없는 항목이에요',
        details: [{ field: 'isRecommended', code: 'not_writable', message: '수정할 수 없는 항목이에요' }],
      })
    );

    renderPage();

    await fillMinimumRequiredFields();
    await userEvent.click(screen.getByRole('button', { name: '등록하기' }));

    await waitFor(() => expect(screen.getAllByText('수정할 수 없는 항목이에요').length).toBeGreaterThan(0));
  });
});
