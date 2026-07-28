import type { Procedure } from '@/types/domain';

export const procedures: Procedure[] = [
  {
    id: 'implant',
    name: '임플란트',
    emoji: '🦷',
    shortDescription: '자연치아처럼 튼튼하게',
    description:
      '상실된 치아를 대체하는 인공 치아 시술입니다. 재료, 식립 개수, 골이식 여부에 따라 비용과 기간이 달라져요.',
  },
  {
    id: 'orthodontics',
    name: '교정',
    emoji: '😁',
    shortDescription: '가지런한 치열 만들기',
    description: '치아 배열과 교합을 개선하는 시술입니다. 투명교정, 세라믹교정, 설측교정 등 방식이 다양해요.',
  },
  {
    id: 'laminate',
    name: '라미네이트',
    emoji: '✨',
    shortDescription: '치아 앞면을 얇게 코팅',
    description: '치아 앞면을 얇게 삭제한 뒤 세라믹 조각을 부착해 색과 모양을 개선하는 심미 시술입니다.',
  },
  {
    id: 'splint',
    name: '스플린트',
    emoji: '🛡️',
    shortDescription: '이갈이·턱관절 보호',
    description: '수면 중 이갈이나 턱관절 통증을 완화하기 위해 착용하는 장치 시술입니다.',
  },
  {
    id: 'snoring-device',
    name: '코골이장치',
    emoji: '😴',
    shortDescription: '수면 중 코골이 완화',
    description: '하악을 전방으로 유도해 기도를 확보, 코골이와 수면무호흡을 완화하는 구강 내 장치입니다.',
  },
  {
    id: 'scaling',
    name: '스케일링',
    emoji: '🪥',
    shortDescription: '치석 제거 및 잇몸 관리',
    description: '치아 표면과 잇몸 사이의 치석·플라크를 제거해 잇몸 건강을 지키는 기본 관리 시술입니다.',
  },
  {
    id: 'root-canal',
    name: '신경치료',
    emoji: '💉',
    shortDescription: '통증의 원인을 근본적으로',
    description: '충치나 감염으로 손상된 치아 신경을 제거하고 세척·충전하는 보존 치료입니다.',
  },
];

export function getProcedureById(id: string) {
  return procedures.find((p) => p.id === id);
}
