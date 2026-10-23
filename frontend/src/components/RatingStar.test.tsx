import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RatingStar } from '@/components/RatingStar';

describe('RatingStar', () => {
  it('평점을 소수 한 자리로 적고, 별은 장식이라 낭독기에서 숨긴다', () => {
    const { container } = render(<RatingStar rating={4.75} />);

    expect(container).toHaveTextContent('평점 ★ 4.8');
    expect(screen.getByText('★')).toHaveAttribute('aria-hidden', 'true');
  });

  it('숫자만 남지 않게 무엇의 숫자인지 낭독기에 알린다', () => {
    render(<RatingStar rating={4.8} />);

    expect(screen.getByText('평점')).toHaveClass('sr-only');
  });

  it('평점이 없으면(null) 0.0 으로 덮지 않고 비공개라고 적는다', () => {
    render(<RatingStar rating={null} />);

    expect(screen.getByText('비공개')).toBeInTheDocument();
  });

  it('옆에 이미 평점 제목이 있는 자리는 낭독용 안내를 끈다 — 두 번 읽히지 않게', () => {
    render(<RatingStar rating={4.8} labelled={false} />);

    expect(screen.queryByText('평점')).not.toBeInTheDocument();
    expect(screen.getByText('★')).toBeInTheDocument();
  });

  // 색을 한 곳에서 정하는 것이 이 컴포넌트의 존재 이유라서, 별 색만은 클래스로 고정한다.
  it('별은 amber 로 칠하고 숫자는 부모 글자색을 그대로 쓴다', () => {
    render(<RatingStar rating={4.8} />);

    expect(screen.getByText('★')).toHaveClass('text-amber-500');
  });
});
