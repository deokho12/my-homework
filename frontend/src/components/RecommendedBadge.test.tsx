import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RecommendedBadge } from '@/components/RecommendedBadge';

const HOSPITAL_TEXT = '몰라몰라 운영자가 고른 병원이에요';
const DOCTOR_TEXT = '몰라몰라 운영자가 고른 원장님이에요';

/**
 * 열린 말풍선만 찾는다. 같은 문구가 낭독기용 `sr-only` 설명으로 **열지 않아도** 들어 있으므로,
 * "보이는지" 를 보려면 그 설명을 빼고 찾아야 한다.
 */
function openedBubble(text: string) {
  return screen.queryByText(text, { ignore: '.sr-only' });
}

/**
 * 배지는 늘 카드(`Pressable` = `div role="button"` + 자체 `onKeyDown`) 안에 들어간다.
 * 그 자리를 그대로 흉내 내서, 배지를 눌러도 카드가 이동하지 않는지 함께 본다.
 */
function CardAround({ onCardActivate }: { onCardActivate: () => void }) {
  return (
    <div role="button" tabIndex={0} onClick={onCardActivate} onKeyDown={onCardActivate}>
      <RecommendedBadge />
    </div>
  );
}

describe('RecommendedBadge', () => {
  it('기본 라벨은 "추천" 이다', () => {
    render(<RecommendedBadge />);

    expect(screen.getByRole('button', { name: '추천' })).toBeInTheDocument();
  });

  it('label 을 주면 그 라벨로 그린다 — 병원 상세 머리줄은 "추천 병원" 이다', () => {
    render(<RecommendedBadge label="추천 병원" />);

    expect(screen.getByRole('button', { name: '추천 병원' })).toBeInTheDocument();
  });

  it('누르면 운영자가 고른 병원이라는 설명이 보이고, 다시 누르면 닫힌다', async () => {
    render(<RecommendedBadge />);
    const badge = screen.getByRole('button', { name: '추천' });

    await userEvent.click(badge);
    expect(openedBubble(HOSPITAL_TEXT)).toBeInTheDocument();

    await userEvent.click(badge);
    expect(openedBubble(HOSPITAL_TEXT)).not.toBeInTheDocument();
  });

  it('전문의 카드(subject="doctor")는 원장님 문구를 보여준다', async () => {
    render(<RecommendedBadge subject="doctor" />);

    await userEvent.click(screen.getByRole('button', { name: '추천' }));

    expect(openedBubble(DOCTOR_TEXT)).toBeInTheDocument();
  });

  it('Enter 로 열 수 있다', async () => {
    render(<RecommendedBadge />);

    await userEvent.tab();
    await userEvent.keyboard('{Enter}');

    expect(openedBubble(HOSPITAL_TEXT)).toBeInTheDocument();
  });

  it('Space 로도 열 수 있다', async () => {
    render(<RecommendedBadge />);

    await userEvent.tab();
    await userEvent.keyboard('[Space]');

    expect(openedBubble(HOSPITAL_TEXT)).toBeInTheDocument();
  });

  it('Esc 로 닫으면 포커스는 배지에 남는다 — 대화상자가 아니다', async () => {
    render(<RecommendedBadge />);
    const badge = screen.getByRole('button', { name: '추천' });

    await userEvent.click(badge);
    await userEvent.keyboard('{Escape}');

    expect(openedBubble(HOSPITAL_TEXT)).not.toBeInTheDocument();
    expect(badge).toHaveFocus();
  });

  it('바깥을 누르면 닫힌다', async () => {
    render(
      <>
        <RecommendedBadge />
        <button type="button">바깥</button>
      </>
    );

    await userEvent.click(screen.getByRole('button', { name: '추천' }));
    await userEvent.click(screen.getByRole('button', { name: '바깥' }));

    expect(openedBubble(HOSPITAL_TEXT)).not.toBeInTheDocument();
  });

  it('길게 누르면(contextmenu) 설명이 열리고 브라우저 기본 메뉴는 뜨지 않는다', () => {
    render(<RecommendedBadge />);
    const badge = screen.getByRole('button', { name: '추천' });

    const longPress = createEvent.contextMenu(badge);
    fireEvent(badge, longPress);

    expect(openedBubble(HOSPITAL_TEXT)).toBeInTheDocument();
    expect(longPress.defaultPrevented).toBe(true);
  });

  it('배지를 눌러도 카드의 클릭 핸들러는 불리지 않는다 — 상세로 이동하지 않는다', async () => {
    const onCardActivate = vi.fn();
    render(<CardAround onCardActivate={onCardActivate} />);

    await userEvent.click(screen.getByRole('button', { name: '추천' }));

    expect(openedBubble(HOSPITAL_TEXT)).toBeInTheDocument();
    expect(onCardActivate).not.toHaveBeenCalled();
  });

  /**
   * QA 에서 말풍선을 탭하자 그 아래 카드가 눌려 병원 상세로 넘어갔다 (375px 탐색 화면).
   * portal 로 띄워도 React 합성 이벤트는 React 트리를 따라 카드까지 올라가기 때문이다.
   */
  it('말풍선을 누르면 말풍선만 닫히고 카드는 눌리지 않는다', async () => {
    const onCardActivate = vi.fn();
    render(<CardAround onCardActivate={onCardActivate} />);

    await userEvent.click(screen.getByRole('button', { name: '추천' }));
    await userEvent.click(screen.getByText(HOSPITAL_TEXT, { ignore: '.sr-only' }));

    expect(openedBubble(HOSPITAL_TEXT)).not.toBeInTheDocument();
    expect(onCardActivate).not.toHaveBeenCalled();
  });

  /**
   * 위 테스트만으로는 장치 둘이 고정되지 않는다 — jsdom 에서 말풍선이 click 전에 사라지면
   * click 이 떼어진 노드에 떨어져 그냥 통과한다. 그래서 **누른 상태**까지만 만들어, 그때
   * 말풍선과 배지 포커스가 그대로인지를 따로 본다 (바깥 닫기의 말풍선 제외 + `mousedown`
   * 기본 동작 막기).
   */
  it('말풍선을 누르고 있는 동안에는 닫히지 않고 배지 포커스도 남는다', async () => {
    render(<RecommendedBadge />);
    const badge = screen.getByRole('button', { name: '추천' });

    await userEvent.click(badge);
    const bubble = screen.getByText(HOSPITAL_TEXT, { ignore: '.sr-only' });
    await userEvent.pointer({ keys: '[MouseLeft>]', target: bubble });

    expect(bubble).toBeInTheDocument();
    expect(badge).toHaveFocus();
  });

  it('배지에 포커스를 두고 Enter 를 쳐도 카드의 키 핸들러는 불리지 않는다', async () => {
    const onCardActivate = vi.fn();
    render(<CardAround onCardActivate={onCardActivate} />);

    await userEvent.click(screen.getByRole('button', { name: '추천' }));
    await userEvent.keyboard('{Enter}');

    expect(onCardActivate).not.toHaveBeenCalled();
  });

  it('버튼 이름은 라벨이고, 설명은 열지 않아도 낭독기에 읽힌다', () => {
    render(<RecommendedBadge />);

    expect(screen.getByRole('button', { name: '추천' })).toHaveAccessibleDescription(HOSPITAL_TEXT);
  });

  it('배지가 둘이면 한 번에 하나만 열린다', async () => {
    render(
      <>
        <RecommendedBadge />
        <RecommendedBadge subject="doctor" label="추천 원장님" />
      </>
    );

    await userEvent.click(screen.getByRole('button', { name: '추천' }));
    await userEvent.click(screen.getByRole('button', { name: '추천 원장님' }));

    expect(openedBubble(DOCTOR_TEXT)).toBeInTheDocument();
    expect(openedBubble(HOSPITAL_TEXT)).not.toBeInTheDocument();
  });
});
