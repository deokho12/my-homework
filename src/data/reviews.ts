import type { Review } from '@/types/domain';

export const reviews: Review[] = [
  {
    id: 'r1',
    hospitalId: 'h1',
    procedureId: 'implant',
    authorName: '김**',
    rating: 5,
    content: '상담부터 시술까지 꼼꼼하게 설명해주셔서 불안하지 않았어요. 통증도 생각보다 적었습니다.',
    createdAt: '2026-06-02',
  },
  {
    id: 'r2',
    hospitalId: 'h1',
    procedureId: 'laminate',
    authorName: '이**',
    rating: 4,
    content: '색이 자연스럽게 나와서 만족해요. 가격은 조금 있는 편입니다.',
    createdAt: '2026-05-18',
  },
  {
    id: 'r3',
    hospitalId: 'h2',
    procedureId: 'orthodontics',
    authorName: '박**',
    rating: 5,
    content: '투명교정 6개월차인데 경과가 좋아요. 원장님이 케이스마다 신경써서 봐주십니다.',
    createdAt: '2026-07-01',
  },
  {
    id: 'r4',
    hospitalId: 'h4',
    procedureId: 'snoring-device',
    authorName: '최**',
    rating: 5,
    content: '와이프가 코골이 줄었다고 좋아하네요. 장치도 생각보다 편해요.',
    createdAt: '2026-06-25',
  },
  {
    id: 'r5',
    hospitalId: 'h6',
    procedureId: 'laminate',
    authorName: '정**',
    rating: 5,
    content: '연예인들이 많이 간다는 얘기 듣고 갔는데 결과물이 정말 자연스러워요.',
    createdAt: '2026-07-10',
  },
];

export function getReviewsByHospital(hospitalId: string) {
  return reviews.filter((r) => r.hospitalId === hospitalId);
}
