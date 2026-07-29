import { BRACES_CLOSEUP, OPEN_MOUTH_CLOSEUP, PROCEDURE_IN_PROGRESS, RETAINER_CLOSEUP, sized } from '@/config/stockImages';
import type { GuideContent } from '@/types/domain';

export const guides: GuideContent[] = [
  {
    id: 'g1',
    title: '임플란트, 뼈이식이 꼭 필요할까요?',
    summary: '골이식이 필요한 경우와 비용 차이를 쉽게 정리했어요.',
    thumbnail: sized(PROCEDURE_IN_PROGRESS, 600),
    procedureId: 'implant',
  },
  {
    id: 'g2',
    title: '투명교정 vs 세라믹교정, 나에게 맞는 건?',
    summary: '생활 패턴과 교정 난이도에 따른 선택 기준을 알려드려요.',
    thumbnail: sized(BRACES_CLOSEUP, 600),
    procedureId: 'orthodontics',
  },
  {
    id: 'g3',
    title: '라미네이트 부작용, 미리 알아두세요',
    summary: '시술 전 삭제량과 사후 관리 팁을 정리했습니다.',
    thumbnail: sized(OPEN_MOUTH_CLOSEUP, 600),
    procedureId: 'laminate',
  },
  {
    id: 'g4',
    title: '코골이장치, 수면다원검사부터 시작하세요',
    summary: '장치 제작 전에 확인해야 할 검사 항목을 알려드려요.',
    thumbnail: sized(RETAINER_CLOSEUP, 600),
    procedureId: 'snoring-device',
  },
];
