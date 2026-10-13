import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * 등록된 시술이 0개일 때의 경고. **완성도 백분율과 별개 판정**이다 (`noProcedures`) —
 * 7분의 1만 비어 `86%` 로 보이지만 환자가 시술로는 이 병원을 찾을 수 없다.
 *
 * **`앱에 노출되지 않아요` 라고 적지 않는다 — 사실이 아니다.** 시술 0개 병원은 시술로 찾는
 * 경로(홈 격자·탐색 칩·가격 비교표)에서 전부 빠지지만, **이름 검색·찜 목록·꿀팁 관련 병원·
 * 병원 상세 직접 링크**로는 그대로 보이고 상담도 받는다 (`docs/database/README.md` §13.7).
 */
export function ExposureWarning({ hospitalId }: { hospitalId: string }) {
  return (
    <section aria-labelledby="exposure-h" className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-rose-600" />
        <div className="min-w-0">
          <h2 id="exposure-h" className="text-[15px] font-extrabold text-rose-700">
            시술로 찾을 때 병원이 나오지 않아요
          </h2>
          <p className="mt-1 text-sm text-rose-700">
            시술을 등록하지 않으면 환자가 시술로 검색할 때 병원이 나오지 않아요. 이름으로 찾거나 찜한 환자에게는
            그대로 보여요.
          </p>
          <Link
            to={`/admin/hospital/${hospitalId}?field=procedureIds`}
            className="mt-3 inline-flex min-h-[40px] items-center rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white"
          >
            시술 등록하러 가기
          </Link>
        </div>
      </div>
    </section>
  );
}
