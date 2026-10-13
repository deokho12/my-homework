import { Heart } from 'lucide-react';

// 배럴(`@/features/favorite`)이 이 파일을 다시 내보내므로 훅은 모듈에서 직접 가져온다 — 순환 import 방지.
import { useIsFavorite } from '@/features/favorite/hooks/useIsFavorite';
import { useToggleFavorite } from '@/features/favorite/hooks/useToggleFavorite';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { Pressable, View } from '@/primitives';

/** 켜진 하트 rose-500, 꺼진 하트 neutral-600 — 흰 배경에서 각각 4.8:1 / 7:1 이다. */
const ON_COLOR = '#f43f5e';
const OFF_COLOR = '#525252';

interface FavoriteHeartButtonProps {
  hospitalId: string;
  /** 접근성 이름에 들어간다 — 목록에 하트가 열한 개면 "찜하기" 만으로는 어느 것인지 알 수 없다. */
  hospitalName: string;
  /**
   * `card` 는 사진 위에 떠 있는 흰 원(36px + hitSlop 4 = 44px 터치),
   * `bar` 는 상세 화면 하단 바의 56px 사각 테두리 버튼이다.
   */
  size?: 'card' | 'bar';
  className?: string;
}

/**
 * 앱의 모든 병원 찜 하트. 탐색·카테고리 카드, 마이 찜 목록 카드(`HospitalCard`),
 * 병원 상세 하단 바(`HospitalDetailView`) 셋이 이 컴포넌트 하나를 쓴다 —
 * 접근성 이름·`aria-pressed`·터치 크기·비로그인 처리가 세 벌로 갈라지지 않게 한다.
 *
 * **카드 안에 넣을 때는 카드 본문의 형제로 둔다.** 카드 자체가 `Pressable`(`div role="button"`)
 * 이라 자식으로 넣으면 버튼 안의 버튼이 되고, 클릭이 부모로 버블링돼 병원 상세로 새어 나간다.
 */
export function FavoriteHeartButton({ hospitalId, hospitalName, size = 'card', className }: FavoriteHeartButtonProps) {
  const isFavorite = useIsFavorite(hospitalId);
  const toggleFavorite = useToggleFavorite();
  const requireAuth = useRequireAuth();

  // `card` 는 **44×44 투명 상자 안의 36px 흰 원**이다. `h-9 w-9` + `hitSlop={4}` 로는 안 된다 —
  // `.rnw-view` 가 `box-sizing: border-box` 라 hitSlop 의 padding 이 36px **안쪽**으로 들어가
  // 터치 영역이 커지지 않고, 함께 붙는 음수 margin 이 원을 모서리 쪽으로 4px 밀어낸다.
  const box =
    size === 'card'
      ? 'h-11 w-11 items-center justify-center'
      : 'h-14 w-14 items-center justify-center rounded-xl border border-neutral-200';

  const icon = (
    // 색만으로 구분하지 않는다 — 채움(찜함) ↔ 윤곽선(안 함)으로 모양이 다르다.
    <Heart
      size={size === 'card' ? 20 : 22}
      color={isFavorite ? ON_COLOR : OFF_COLOR}
      fill={isFavorite ? ON_COLOR : 'none'}
      aria-hidden
    />
  );

  return (
    <Pressable
      onPress={(event) => {
        // 형제 배치라 버블링이 애초에 없지만, 겹침 구조가 바뀌어도 안전하도록 남겨 둔다.
        event.stopPropagation();
        // 비로그인은 `redirect` 없이 로그인 화면으로 간다 — 하트는 그 자리에 머물고 싶은
        // 동작이라 로그인 뒤 `router.back()` 으로 돌아오는 편이 맞다(상세·마이 찜과 같은 규칙).
        requireAuth(() => toggleFavorite.mutate({ hospitalId, isFavorite }));
      }}
      accessibilityLabel={`${hospitalName} ${isFavorite ? '찜 해제' : '찜하기'}`}
      pressed={isFavorite}
      className={className ? `${box} ${className}` : box}
    >
      {size === 'card' ? (
        // 보이는 원은 36px — 사진 위 대비를 위해 흰 바탕을 깐다. 나머지 4px 테두리는
        // 투명한 터치 여유다(카드 모서리에서 12px 떨어뜨리려면 버튼을 8px 에 둔다).
        <View className="h-9 w-9 items-center justify-center rounded-full bg-white/90">{icon}</View>
      ) : (
        icon
      )}
    </Pressable>
  );
}
