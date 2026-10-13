import { Bell, ChevronLeft, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { adminBackTo } from '@/components/admin/adminMenu';
import { useUnreadNotificationCount } from '@/features/notification';
import { useScreenOptions } from '@/navigation';

/**
 * 모든 관리자 화면의 상단바. **화면 제목 `h1` 이 여기 하나뿐이다** — 각 화면이 같은 글자를
 * 한 번 더 쓰면 스크린리더가 제목을 두 번 읽는다.
 *
 * 검색은 상담 목록의 `q` 를 그대로 쓴다 (집계에 넣지 않은 이유 — `docs/api/README.md` §14).
 * 선택한 병원 범위 안에서 걸러진다 — 상담 목록이 그 병원으로 이미 좁혀져 있기 때문이다.
 */
export function AdminTopBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { title } = useScreenOptions();
  const { data: unread } = useUnreadNotificationCount('admin');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const backTo = adminBackTo(pathname);
  // 아직 모르는 동안(로딩·실패)에는 점을 찍지 않는다 — 안 읽은 알림이 있다고 지어내지 않는다.
  const unreadCount = unread?.unreadCount ?? 0;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    const keyword = query.trim();
    // 빈 검색은 무시한다 — 목록을 통째로 다시 여는 것은 검색이 아니다.
    if (keyword.length === 0) return;

    setSearchOpen(false);
    // 상태·기간을 풀어서 연다 — 목록의 기본값(`신규`·`최근 30일`) 위에 얹으면 예약확정이거나
    // 오래된 환자는 "없다" 고 나온다. 찾는 사람이 어느 탭에 있는지 모르는 것이 검색의 전제다.
    navigate(`/admin/consultations?status=all&period=all&q=${encodeURIComponent(keyword)}`);
  };

  const searchForm = (id: string, className: string) => (
    <form role="search" onSubmit={submit} className={className}>
      <label htmlFor={id} className="sr-only">
        환자 검색
      </label>
      <input
        id={id}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="환자 이름, 연락처 검색"
        className="h-10 w-full rounded-full border border-neutral-200 px-4 text-sm outline-none focus:border-brand-600 lg:w-[190px]"
      />
    </form>
  );

  return (
    <header className="sticky top-0 z-40 flex shrink-0 flex-col border-b border-neutral-200 bg-white">
      <div className="flex min-h-[56px] items-center gap-2 px-3 md:px-6 lg:px-8">
        {/* 넓은 화면은 목록과 상세가 나란히 서서 돌아갈 곳이 이미 보인다. */}
        {backTo ? (
          <Link
            to={backTo}
            aria-label="목록으로"
            className="-ml-1 flex h-10 w-10 items-center justify-center rounded-full hover:bg-neutral-50 lg:hidden"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </Link>
        ) : null}

        <h1 className="min-w-0 flex-1 truncate text-[17px] font-bold text-neutral-900 lg:text-xl">{title}</h1>

        {searchForm('admin-patient-q', 'hidden lg:flex')}

        <button
          type="button"
          aria-expanded={searchOpen}
          aria-controls="admin-search-row"
          aria-label="환자 검색 열기"
          onClick={() => setSearchOpen((value) => !value)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200 lg:hidden"
        >
          <Search size={18} aria-hidden="true" />
        </button>

        <Link
          to="/admin/notifications"
          aria-label={unreadCount > 0 ? `알림, 안 읽음 ${unreadCount}건` : '알림'}
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200"
        >
          <Bell size={18} aria-hidden="true" />
          {/* 숫자가 아니라 점이다 — 알림함 안에서 세면 되고, 상단바는 "있다" 만 말한다. */}
          {unreadCount > 0 ? (
            <span
              data-testid="admin-bell-dot"
              aria-hidden="true"
              className="absolute right-2 top-2 h-2 w-2 rounded-full border border-white bg-rose-500"
            />
          ) : null}
        </Link>
      </div>

      <div id="admin-search-row" hidden={!searchOpen} className="px-3 pb-3 lg:hidden">
        {searchForm('admin-patient-q-narrow', 'flex')}
      </div>
    </header>
  );
}
