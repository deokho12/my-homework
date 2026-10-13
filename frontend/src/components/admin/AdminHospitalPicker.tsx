import type { AdminHospitalOption } from '@/features/admin/hooks/useAdminHospital';

interface AdminHospitalPickerProps {
  id: string;
  value: string | null;
  options: AdminHospitalOption[];
  onSelect: (hospitalId: string) => void;
}

/**
 * 담당 병원 드롭다운. **2곳 이상일 때만** 렌더된다 (부모가 판정한다) — 1곳이면 고를 것이
 * 없고, 고를 것이 없는 선택기는 "다른 병원도 있다" 는 거짓 신호다.
 *
 * `id` 를 받는 이유: 세로 메뉴와 좁은 화면의 `더보기` 패널에 **둘 다** 그려지므로 같은
 * id 를 쓰면 라벨이 어느 칸을 가리키는지 모호해진다.
 */
export function AdminHospitalPicker({ id, value, options, onSelect }: AdminHospitalPickerProps) {
  return (
    <div className="px-3">
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-neutral-500">
        담당 병원
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(event) => onSelect(event.target.value)}
        className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-brand-600"
      >
        {/* 목록이 아직 안 왔으면 id 라도 고를 수 있게 둔다 — 선택이 잠기지 않는다. */}
        {options.length === 0 && value ? <option value={value}>{value}</option> : null}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}
