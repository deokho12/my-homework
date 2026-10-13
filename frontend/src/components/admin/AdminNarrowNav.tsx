import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { AdminHospitalPicker } from "@/components/admin/AdminHospitalPicker";
import { AdminMenuItem } from "@/components/admin/AdminMenuItem";
import {
  AdminMenuFooter,
  AdminMenuGroupList,
  type AdminMenuContentProps,
} from "@/components/admin/AdminSideMenu";
import { cx } from "@/primitives";

/**
 * 좁은 화면(lg 미만)의 메뉴.
 *
 * **매일 보는 업무 항목 셋은 접지 않는다** — 배지가 붙는 자리라 접으면 "오늘 할 일이 있다"
 * 는 신호가 사라진다. 그룹·준비중·선택기·하단 카드는 `더보기` 패널 안이다.
 */
export function AdminNarrowNav({
  className,
  ...content
}: AdminMenuContentProps & { className?: string }) {
  const { pathname } = useLocation();
  // **열어 둔 주소**를 기억한다. 화면을 옮기면 그 주소가 달라져 패널이 저절로 닫힌다 —
  // 효과로 닫으면 라우트가 바뀔 때마다 렌더가 한 번 더 돈다.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const open = openedAt === pathname;

  const close = () => {
    setOpenedAt(null);
    // 닫힌 패널 안에 포커스가 남으면 다음 Tab 이 어디로 갈지 알 수 없다.
    buttonRef.current?.focus();
  };

  // Esc 는 문서 수준에서 받는다 — 패널 안 어디에 포커스가 있어도 닫히고, 상호작용 핸들러를
  // 일반 `div` 에 붙이지 않는다.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const work = content.groups.find((group) => group.key === "work");
  const rest = content.groups.filter((group) => group.key !== "work");

  return (
    <nav
      aria-label="관리자 메뉴"
      className={cx("border-b border-neutral-200 bg-white", className)}
    >
      {/* 가로 스크롤은 이 줄에만 허용한다 — 본문은 360px 에서도 가로로 흐르지 않는다. */}
      <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-1.5">
        {work?.items.map((item) => (
          <AdminMenuItem key={item.key} item={item} variant="chip" />
        ))}
        <button
          ref={buttonRef}
          type="button"
          id="admin-more-btn"
          aria-expanded={open}
          aria-controls="admin-more-panel"
          onClick={() => setOpenedAt(open ? null : pathname)}
          className="flex min-h-[40px] shrink-0 items-center gap-1 rounded-full border border-neutral-200 px-3 text-sm font-medium text-neutral-600"
        >
          더보기 <ChevronDown size={14} aria-hidden="true" />
        </button>
      </div>

      {/*
        `hidden` 을 단 요소에는 display 유틸리티를 걸지 않는다 — 작성자 스타일 `display:flex` 가
        UA 의 `[hidden]{display:none}` 을 이겨서, 속성은 닫혀 있는데 패널이 그대로 보인다.
        그래서 접는 바깥 상자와 배치하는 안쪽 상자를 나눈다.
      */}
      <div id="admin-more-panel" hidden={!open}>
        <div className="flex flex-col gap-4 border-t border-neutral-100 px-3 pb-4 pt-3">
          {content.showPicker ? (
            <AdminHospitalPicker
              id={content.pickerId}
              value={content.hospitalId}
              options={content.hospitalOptions}
              onSelect={content.onSelectHospital}
            />
          ) : null}

          {rest.map((group) => (
            <AdminMenuGroupList
              key={group.key}
              group={group}
              idPrefix="admin-more-menu"
            />
          ))}

          <AdminMenuFooter
            hospitalName={content.hospitalName}
            userName={content.userName}
          />
        </div>
      </div>
    </nav>
  );
}
