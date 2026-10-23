import { Star } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';

import { Badge } from '@/components/Badge';

/** 설명 문구의 주인. 병원 카드·병원 상세는 `hospital`, 전문의 카드는 `doctor` 다. */
type RecommendedSubject = 'hospital' | 'doctor';

interface RecommendedBadgeProps {
  /** 카드에서는 `추천`, 병원 상세 머리줄에서는 `추천 병원` 처럼 길게 쓴다. */
  label?: string;
  /** 설명 문구를 고른다. 문구 자체는 이 파일에서만 정한다 — 호출부는 주인만 넘긴다. */
  subject?: RecommendedSubject;
}

const DESCRIPTIONS: Record<RecommendedSubject, string> = {
  hospital: '몰라몰라 운영자가 고른 병원이에요',
  doctor: '몰라몰라 운영자가 고른 원장님이에요',
};

/** 말풍선 자리 계산 상수 (2026-10-23 디자이너 명세). */
const BUBBLE_MAX_WIDTH = 280;
const VIEWPORT_MARGIN = 12;
const BADGE_GAP = 6;

/**
 * 길게 누른 뒤 `click` 을 이어서 보내는 브라우저가 있다. 그 click 으로 방금 열린 설명이
 * 곧바로 닫히지 않게, 이 시간 안에 온 click 은 버린다.
 */
const CLICK_AFTER_LONG_PRESS_MS = 500;

/**
 * 에디터가 고른 추천 표시 — 병원 카드·탐색 카드·전문의 카드·병원 상세가 함께 쓴다.
 * **누르거나 길게 누르면** 운영자가 고른 것이라는 설명 말풍선이 열린다 (SYS-25).
 *
 * **아이콘(`Star`)·색(brand)·설명 문구는 여기서만 정한다.** 네 곳이 각자 `<Badge icon={...} />` 를
 * 적어 두니 한 곳만 `Sparkles` 로 갈라졌던 적이 있다 (SYS-22 리뷰). 호출부는 라벨과 주인만 받는다.
 */
export function RecommendedBadge({ label = '추천', subject = 'hospital' }: RecommendedBadgeProps) {
  // 열린 상태와 그때의 배지 위치를 한 값으로 든다 — 위치 없이 열린 상태가 생길 수 없다.
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const longPressedAt = useRef(0);
  const descriptionId = useId();

  const open = anchor !== null;
  const description = DESCRIPTIONS[subject];

  const close = useCallback(() => setAnchor(null), []);

  const openBubble = () => {
    const button = buttonRef.current;
    if (button === null) return;
    setAnchor(button.getBoundingClientRect());
  };

  /**
   * 말풍선이 붙는 순간 폭을 먼저 적고, 그 폭에서의 높이를 재서 자리를 정한다. 아래로 넘치면
   * 배지 위로 뒤집는다.
   *
   * 높이는 그려 보기 전에 알 수 없고 한 번 쓰면 끝이라서, 상태를 하나 더 두고 다시 렌더하는
   * 대신 페인트 전에 DOM 에 직접 적는다 (`useLayoutEffect` + setState 와 결과는 같다).
   *
   * 누르기도 여기서 **네이티브 리스너**로 받는다. 세 가지 이유가 겹친다:
   *  - QA 에서 말풍선을 탭하자 아래 카드가 눌려 병원 상세로 넘어갔다. portal 로 띄워도 React
   *    합성 이벤트는 **React 트리**를 따라 카드(`Pressable`)의 `onClick` 까지 올라간다.
   *    React 는 portal 컨테이너(`document.body`)에도 위임 리스너를 달아 두는데, 말풍선
   *    자신에 붙인 네이티브 리스너가 그 **버블** 리스너로 가는 길을 끊는다. 다만 캡처
   *    리스너는 말풍선보다 **먼저** 돌고 `on*Capture` 를 모으므로, 이 배지 위쪽에
   *    `onClickCapture` 를 다는 코드가 생기면 이 장치로는 막지 못한다
   *  - `mousedown` 의 기본 동작(포커스 이동)을 막아야 배지가 blur 되며 먼저 닫히지 않는다.
   *    전파도 함께 멈춘다 — 카드 `Pressable` 의 `onMouseDown`(눌린 모양)이 반응하지 않게
   *  - 말풍선은 `aria-hidden` 장식이라 JSX 에 `onClick` 을 달 수 없다 (jsx-a11y)
   */
  const mountBubble = (node: HTMLDivElement | null) => {
    bubbleRef.current = node;
    if (node === null || anchor === null) return;

    const width = Math.min(BUBBLE_MAX_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
    const centered = anchor.left + anchor.width / 2 - width / 2;
    const rightLimit = window.innerWidth - width - VIEWPORT_MARGIN;
    node.style.width = `${width}px`;
    node.style.left = `${Math.min(Math.max(VIEWPORT_MARGIN, centered), rightLimit)}px`;

    const below = anchor.bottom + BADGE_GAP;
    const height = node.offsetHeight;
    const overflows = below + height > window.innerHeight - VIEWPORT_MARGIN;
    // 뒤집은 쪽도 위 여백을 지킨다 — 가로 clamp 와 같은 규칙이다.
    const above = Math.max(VIEWPORT_MARGIN, anchor.top - BADGE_GAP - height);
    node.style.top = `${overflows ? above : below}px`;

    const keepBadgeFocused = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    const closeOnly = (event: Event) => {
      event.stopPropagation();
      close();
    };
    node.addEventListener('mousedown', keepBadgeFocused);
    node.addEventListener('click', closeOnly);

    return () => {
      bubbleRef.current = null;
      node.removeEventListener('mousedown', keepBadgeFocused);
      node.removeEventListener('click', closeOnly);
    };
  };

  // 바깥을 누르거나 화면이 움직이면 닫는다. 배지가 여럿이어도 전역 상태 없이 하나만 열린다 —
  // 다른 배지를 누른 pointerdown 이 capture 단계에서 먼저 와 열려 있던 쪽을 닫는다.
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target === null) return;
      // 말풍선 안은 "바깥" 이 아니다 — 여기서 닫아 버리면 뒤따르는 click 이 사라진 말풍선
      // 자리의 카드에 떨어진다. 말풍선을 닫는 일은 말풍선 자신의 click 리스너가 한다.
      if (buttonRef.current?.contains(target) || bubbleRef.current?.contains(target)) return;
      close();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    // 스크롤은 버블링하지 않는다 — capture 로 받아야 카드 안쪽 스크롤에서도 닫힌다.
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open, close]);

  /*
   * 아래 핸들러들이 전파를 멈추는 이유: 이 배지는 카드(`Pressable` = `div role="button"` +
   * 자체 `onKeyDown`) **안**에 있다. 멈추지 않으면 설명을 보려고 누른 것이 병원·전문의 상세로
   * 이동한다 (DEBT-6 "버튼 안의 버튼" 과 같은 성격이다).
   */
  const handleClick = (event: MouseEvent) => {
    event.stopPropagation();
    if (Date.now() - longPressedAt.current < CLICK_AFTER_LONG_PRESS_MS) return;
    if (open) close();
    else openBubble();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation();
    // Enter·Space 로 여닫는 것은 `<button>` 이 보내는 click 이 한다 — 여기서 또 토글하지 않는다.
    if (event.key === 'Escape' && open) close();
  };

  const handleContextMenu = (event: MouseEvent) => {
    // 모바일 길게 누르기. 카드의 `Pressable` 은 `onContextMenu` 를 `onLongPress` 로 쓴다.
    event.preventDefault();
    event.stopPropagation();
    longPressedAt.current = Date.now();
    openBubble();
  };

  return (
    <span className="relative inline-flex shrink-0">
      <button
        ref={buttonRef}
        type="button"
        /*
         * `aria-expanded` 를 쓰지 않는다 — 말풍선은 `aria-hidden` 장식이고 설명은 아래
         * `aria-describedby` 로 **열지 않아도** 읽히므로, 낭독기에게는 열리는 것이 없다.
         */
        aria-describedby={descriptionId}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onContextMenu={handleContextMenu}
        onBlur={close}
        /*
         * `after:*` 는 보이지 않는 확장 영역이다 — 배지 크기는 그대로 두고 누를 수 있는 높이만
         * 44px 로 넓힌다. `select-none`·콜아웃 끄기는 길게 눌렀을 때 글자가 선택되거나
         * 모바일 공유 메뉴가 뜨는 것을 막는다.
         */
        className="relative inline-flex cursor-pointer select-none rounded-full [-webkit-touch-callout:none] after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-[''] active:opacity-80 focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1"
      >
        <Badge icon={Star} label={label} tone="brand" as="span" />
      </button>

      {/* 버튼의 이름은 라벨(`추천`)뿐이라, 무엇을 뜻하는 표시인지는 설명으로 알린다. */}
      <span id={descriptionId} className="sr-only">
        {description}
      </span>

      {open
        ? createPortal(
            // 카드가 `overflow-hidden` 이라 카드 안에 그리면 잘린다 — body 에 고정으로 띄운다.
            // 낭독기에는 위 설명으로 이미 읽혔으므로 말풍선 자체는 숨긴다 (두 번 읽지 않게).
            // 누르면 말풍선만 닫는다 — 누르기를 받지 않으면 아래 카드가 눌린다 (`mountBubble`).
            <div
              ref={mountBubble}
              aria-hidden="true"
              // `cursor-pointer` — WebKit 은 커서가 포인터인 요소에만 탭의 click 을 보낸다.
              className="fixed z-50 cursor-pointer select-none rounded-xl border border-neutral-300 bg-white px-3 py-2 text-[13px] leading-relaxed text-neutral-700"
            >
              {description}
            </div>,
            document.body
          )
        : null}
    </span>
  );
}
