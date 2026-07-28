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
    id: 'inlay',
    name: '인레이',
    emoji: '🧩',
    shortDescription: '충치 부위만 정밀하게',
    description: '충치로 손상된 부위를 본떠 만든 보철물을 끼워 넣는 시술로, 삭제 범위를 최소화할 수 있어요.',
  },
  {
    id: 'crown',
    name: '크라운',
    emoji: '👑',
    shortDescription: '손상된 치아를 감싸기',
    description: '신경치료 후이거나 손상이 큰 치아를 전체적으로 감싸 씌워 기능과 모양을 회복하는 보철 시술입니다.',
  },
  {
    id: 'whitening',
    name: '치아미백',
    emoji: '🌟',
    shortDescription: '치아 색을 밝게',
    description: '약제를 이용해 치아 표면의 착색을 개선하고 색조를 밝게 만드는 심미 시술입니다.',
  },
  {
    id: 'wisdom-tooth',
    name: '사랑니',
    emoji: '😬',
    shortDescription: '통증 전에 미리 발치',
    description: '매복되었거나 통증·염증을 유발하는 사랑니를 안전하게 발치하는 시술입니다.',
  },
  {
    id: 'cavity',
    name: '충치치료',
    emoji: '🩹',
    shortDescription: '초기 충치부터 신경치료까지',
    description: '충치로 손상된 치아 부위를 제거하고 채워 넣거나, 깊은 경우 신경치료까지 진행하는 보존 치료입니다.',
  },
  {
    id: 'gum-disease',
    name: '잇몸치료',
    emoji: '🌿',
    shortDescription: '스케일링부터 치주치료까지',
    description: '치석 제거(스케일링)와 잇몸 염증·치주질환 관리를 포함하는 잇몸 건강 관리 시술입니다.',
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
    id: 'tmj',
    name: '턱관절',
    emoji: '🦴',
    shortDescription: '통증·소리·개구장애 개선',
    description: '턱관절의 통증, 소리, 입 벌림 제한 등을 진단하고 치료하는 턱관절 질환 관리 시술입니다.',
  },
];

export function getProcedureById(id: string) {
  return procedures.find((p) => p.id === id);
}
