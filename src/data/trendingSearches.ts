import type { ProcedureId } from '@/types/domain';

export type SearchTrend =
  | { type: 'up'; delta: number }
  | { type: 'down'; delta: number }
  | { type: 'same' }
  | { type: 'new' };

export type SearchTarget =
  | { kind: 'procedure'; procedureId: ProcedureId }
  | { kind: 'hospital'; hospitalId: string }
  | { kind: 'doctor'; doctorId: string };

export interface TrendingSearchTerm {
  rank: number;
  term: string;
  trend: SearchTrend;
  target: SearchTarget;
}

export type SearchTab = 'all' | 'procedure' | 'hospital' | 'doctor';

const procedureTerms: TrendingSearchTerm[] = [
  { rank: 1, term: '임플란트', trend: { type: 'up', delta: 2 }, target: { kind: 'procedure', procedureId: 'implant' } },
  { rank: 2, term: '교정', trend: { type: 'same' }, target: { kind: 'procedure', procedureId: 'orthodontics' } },
  { rank: 3, term: '라미네이트', trend: { type: 'up', delta: 1 }, target: { kind: 'procedure', procedureId: 'laminate' } },
  { rank: 4, term: '잇몸치료', trend: { type: 'new' }, target: { kind: 'procedure', procedureId: 'gum-disease' } },
  { rank: 5, term: '사랑니', trend: { type: 'down', delta: 1 }, target: { kind: 'procedure', procedureId: 'wisdom-tooth' } },
  { rank: 6, term: '충치치료', trend: { type: 'up', delta: 3 }, target: { kind: 'procedure', procedureId: 'cavity' } },
  { rank: 7, term: '크라운', trend: { type: 'new' }, target: { kind: 'procedure', procedureId: 'crown' } },
  { rank: 8, term: '인레이', trend: { type: 'down', delta: 2 }, target: { kind: 'procedure', procedureId: 'inlay' } },
  { rank: 9, term: '치아미백', trend: { type: 'same' }, target: { kind: 'procedure', procedureId: 'whitening' } },
  { rank: 10, term: '턱관절', trend: { type: 'new' }, target: { kind: 'procedure', procedureId: 'tmj' } },
];

const hospitalTerms: TrendingSearchTerm[] = [
  { rank: 1, term: '강남 스마일 치과', trend: { type: 'up', delta: 1 }, target: { kind: 'hospital', hospitalId: 'h1' } },
  { rank: 2, term: '더화이트 라미네이트클리닉', trend: { type: 'same' }, target: { kind: 'hospital', hospitalId: 'h6' } },
  { rank: 3, term: '연세 바른교정치과', trend: { type: 'up', delta: 2 }, target: { kind: 'hospital', hospitalId: 'h2' } },
  { rank: 4, term: '미소가득 치과의원', trend: { type: 'new' }, target: { kind: 'hospital', hospitalId: 'h3' } },
  { rank: 5, term: '리본 수면치과', trend: { type: 'down', delta: 1 }, target: { kind: 'hospital', hospitalId: 'h4' } },
  { rank: 6, term: '해피덴탈의원', trend: { type: 'down', delta: 3 }, target: { kind: 'hospital', hospitalId: 'h5' } },
];

const doctorTerms: TrendingSearchTerm[] = [
  { rank: 1, term: '김민준 원장', trend: { type: 'up', delta: 1 }, target: { kind: 'doctor', doctorId: 'd1' } },
  { rank: 2, term: '한소연 원장', trend: { type: 'same' }, target: { kind: 'doctor', doctorId: 'd6' } },
  { rank: 3, term: '박도윤 원장', trend: { type: 'new' }, target: { kind: 'doctor', doctorId: 'd3' } },
  { rank: 4, term: '이서연 원장', trend: { type: 'up', delta: 2 }, target: { kind: 'doctor', doctorId: 'd2' } },
  { rank: 5, term: '최지후 원장', trend: { type: 'down', delta: 1 }, target: { kind: 'doctor', doctorId: 'd4' } },
  { rank: 6, term: '정하은 원장', trend: { type: 'same' }, target: { kind: 'doctor', doctorId: 'd5' } },
  { rank: 7, term: '이하윤 원장', trend: { type: 'new' }, target: { kind: 'doctor', doctorId: 'd7' } },
  { rank: 8, term: '최민서 원장', trend: { type: 'down', delta: 2 }, target: { kind: 'doctor', doctorId: 'd8' } },
];

const allTerms: TrendingSearchTerm[] = [
  { rank: 1, term: '임플란트', trend: { type: 'up', delta: 2 }, target: { kind: 'procedure', procedureId: 'implant' } },
  { rank: 2, term: '강남 스마일 치과', trend: { type: 'up', delta: 1 }, target: { kind: 'hospital', hospitalId: 'h1' } },
  { rank: 3, term: '교정', trend: { type: 'same' }, target: { kind: 'procedure', procedureId: 'orthodontics' } },
  { rank: 4, term: '김민준 원장', trend: { type: 'up', delta: 1 }, target: { kind: 'doctor', doctorId: 'd1' } },
  { rank: 5, term: '라미네이트', trend: { type: 'up', delta: 1 }, target: { kind: 'procedure', procedureId: 'laminate' } },
  {
    rank: 6,
    term: '더화이트 라미네이트클리닉',
    trend: { type: 'same' },
    target: { kind: 'hospital', hospitalId: 'h6' },
  },
  { rank: 7, term: '잇몸치료', trend: { type: 'new' }, target: { kind: 'procedure', procedureId: 'gum-disease' } },
  { rank: 8, term: '한소연 원장', trend: { type: 'same' }, target: { kind: 'doctor', doctorId: 'd6' } },
  { rank: 9, term: '연세 바른교정치과', trend: { type: 'up', delta: 2 }, target: { kind: 'hospital', hospitalId: 'h2' } },
  { rank: 10, term: '사랑니', trend: { type: 'down', delta: 1 }, target: { kind: 'procedure', procedureId: 'wisdom-tooth' } },
];

export const TRENDING_SEARCHES: Record<SearchTab, TrendingSearchTerm[]> = {
  all: allTerms,
  procedure: procedureTerms,
  hospital: hospitalTerms,
  doctor: doctorTerms,
};

export const SPONSORED_SEARCH_SUGGESTIONS = [
  '몰라몰라 PICK 인기 임플란트',
  '교정',
  '몰라몰라만 누리는 라미네이트 할인',
  '원데이 가능 병원 모음',
  '코골이장치 상담',
  '치아미백 이벤트',
];
