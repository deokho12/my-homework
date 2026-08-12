import type { Promotion } from '@/types/domain';

export const promotions: Promotion[] = [
  {
    id: 'p1',
    hospitalId: 'h1',
    procedureId: 'implant',
    title: '임플란트 1개 진단+식립 패키지',
    originalPrice: 1800000,
    salePrice: 1290000,
    badge: '얼리버드',
  },
  {
    id: 'p2',
    hospitalId: 'h2',
    procedureId: 'orthodontics',
    title: '투명교정 상담+구강스캔 패키지',
    originalPrice: 6500000,
    salePrice: 5200000,
    badge: '첫방문 할인',
  },
  {
    id: 'p3',
    hospitalId: 'h4',
    procedureId: 'snoring-device',
    title: '코골이장치 정밀진단 패키지',
    originalPrice: 900000,
    salePrice: 650000,
    badge: '여름 프로모션',
  },
  {
    id: 'p4',
    hospitalId: 'h6',
    procedureId: 'laminate',
    title: '라미네이트 6개 + 미백 세트',
    originalPrice: 4800000,
    salePrice: 3900000,
    badge: '인기',
  },
];

export function getPromotionByHospital(hospitalId: string) {
  return promotions.find((p) => p.hospitalId === hospitalId);
}
