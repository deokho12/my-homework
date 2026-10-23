import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PromoBadge } from '@/components/PromoBadge';

/**
 * 할인 알약은 이벤트 카드·병원 카드·병원 상세가 **같은 컴포넌트**를 쓴다 — 예전에는
 * 병원 상세의 `SalePill` 과 카드의 인라인 알약 두 벌이라 색·굵기가 갈릴 수 있었다.
 */
describe('PromoBadge', () => {
  it('꽉 찬 rose 알약에 흰 글자다 — Badge 의 연한 danger 와 다른 자리다', () => {
    render(<PromoBadge label="얼리버드" />);

    const pill = screen.getByText('얼리버드');
    expect(pill).toHaveClass('bg-rose-500', 'text-white', 'rounded-full');
  });

  it('사진 위(onPhoto)에서는 글자가 굵고, 글 흐름 안에서는 기본 굵기다', () => {
    const { rerender } = render(<PromoBadge label="얼리버드" onPhoto />);
    expect(screen.getByText('얼리버드')).toHaveClass('font-bold');

    rerender(<PromoBadge label="얼리버드" />);
    expect(screen.getByText('얼리버드')).toHaveClass('font-medium');
  });

  it('아이콘은 호출부가 고르지 않고 항상 하나다 — 같은 뜻에 다른 그림이 붙지 않게', () => {
    const { container } = render(<PromoBadge label="얼리버드" />);

    const icons = container.querySelectorAll('svg');
    expect(icons).toHaveLength(1);
    // 장식이라 낭독기에서는 숨긴다 — 뜻은 라벨이 전한다.
    expect(icons[0]).toHaveAttribute('aria-hidden', 'true');
  });

  it('className 은 놓일 자리만 더한다 — 모양 클래스는 그대로 남는다', () => {
    render(<PromoBadge label="얼리버드" className="absolute left-3 top-3" />);

    expect(screen.getByText('얼리버드')).toHaveClass('absolute', 'left-3', 'top-3', 'bg-rose-500');
  });
});
