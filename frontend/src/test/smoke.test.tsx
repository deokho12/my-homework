import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PrimaryButton } from '@/components/PrimaryButton';

describe('테스트 환경', () => {
  it('jsdom 에서 기존 컴포넌트를 렌더하고 @/ 별칭을 해석한다', () => {
    render(<PrimaryButton label="상담 신청하기" onPress={() => {}} />);

    expect(screen.getByText('상담 신청하기')).toBeInTheDocument();
  });
});
