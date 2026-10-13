import { useSession } from '@/features/auth/hooks/useSession';
import HospitalDashboard from '@/features/admin/components/HospitalDashboard';
import OperatorHome from '@/features/admin/components/OperatorHome';

/**
 * `/admin` — 역할에 따라 **다른 화면**이다.
 *
 * - `hospital_admin` → 대시보드 (오늘 할 일·숫자·완성도)
 * - `operator` → 병원 목록 + 전문의 검수 (대시보드를 쓰지 않는다 — `OperatorHome` 참고)
 *
 * 공통 크롬(사이드 메뉴·상단바·알림 종)은 여기 없다. `AdminShell` 이 모든 관리자 라우트에
 * 씌운다 — 예전에는 이 화면만 종과 숫자를 들고 있어서, 상담 화면으로 넘어가면 사라졌다.
 */
export default function AdminHomePage() {
  const { isOperator } = useSession();

  return isOperator ? <OperatorHome /> : <HospitalDashboard />;
}
