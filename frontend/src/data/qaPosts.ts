import type { QAPost } from '@/types/domain';

export const qaPosts: QAPost[] = [
  {
    id: 'q1',
    title: '임플란트 뼈이식 꼭 해야 하나요?',
    content: '어금니 임플란트 상담받았는데 뼈이식이 필요하다고 하네요. 안 하면 안 되는 걸까요?',
    procedureId: 'implant',
    authorName: '익명',
    createdAt: '2026-07-20',
    viewCount: 312,
    answers: [
      {
        id: 'a1',
        authorName: '몰라몰라 자문의',
        isDentist: true,
        content:
          '치조골이 부족하면 임플란트가 흔들리거나 오래 못 버틸 수 있어요. 파노라마·CT로 골량을 확인한 뒤 필요한 경우에만 권장하는 것이 일반적입니다. 다른 병원 소견도 한 번 더 들어보세요.',
        createdAt: '2026-07-20',
      },
    ],
  },
  {
    id: 'q2',
    title: '투명교정 vs 세라믹교정 통증 차이가 클까요?',
    content: '둘 다 고민 중인데 통증이나 발음 문제가 어느 쪽이 더 심한지 궁금해요.',
    procedureId: 'orthodontics',
    authorName: '익명',
    createdAt: '2026-07-18',
    viewCount: 198,
    answers: [
      {
        id: 'a2',
        authorName: '교정경험자',
        isDentist: false,
        content: '투명교정은 장착 초기에만 약간 이물감 있고 세라믹보다 발음 적응이 빨랐어요!',
        createdAt: '2026-07-19',
      },
    ],
  },
  {
    id: 'q3',
    title: '라미네이트 하면 나중에 무조건 크라운 해야 하나요?',
    content: '라미네이트 삭제량이 적다고 들었는데 나중에 재시술 시 크라운으로 바뀌는지 궁금합니다.',
    procedureId: 'laminate',
    authorName: '익명',
    createdAt: '2026-07-15',
    viewCount: 145,
    answers: [],
  },
  {
    id: 'q4',
    title: '코골이장치 착용하면 턱관절 아플 수도 있나요?',
    content: '하악을 앞으로 당기는 장치라던데 턱에 무리가 갈까 걱정돼요.',
    procedureId: 'snoring-device',
    authorName: '익명',
    createdAt: '2026-07-10',
    viewCount: 87,
    answers: [
      {
        id: 'a3',
        authorName: '몰라몰라 자문의',
        isDentist: true,
        content:
          '초기에 약간의 턱관절 불편감이 있을 수 있지만, 대부분 2~3주 내 적응됩니다. 통증이 지속되면 장치 조정이 필요하니 제작 병원에 바로 알려주세요.',
        createdAt: '2026-07-11',
      },
    ],
  },
];
