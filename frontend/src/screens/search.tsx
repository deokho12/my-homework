import { Search } from "lucide-react";

import { router, Stack, useLocalSearchParams } from "@/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Pressable, ScrollView, Text, View, cx } from "@/primitives";
import { SafeAreaView } from "@/primitives";

import { CONTAINER_PADDING } from "@/components/layout/Container";
import { SuggestionList } from "@/features/search/components/SuggestionList";
import { trendingTargetPath } from "@/features/search/trendingTarget";
import {
  MIN_CHARS_HINT,
  firstSuggestion,
  suggestionHref,
  suggestionOptionId,
  type Suggestion,
} from "@/features/search/suggest";
import { useSuggestions } from "@/features/search/useSuggestions";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";
import {
  SPONSORED_SEARCH_SUGGESTIONS,
  TRENDING_SEARCHES,
  type SearchTab,
  type SearchTarget,
  type SearchTrend,
  type TrendingSearchTerm,
} from "@/mocks/fixtures/trendingSearches";

/**
 * 검색 화면.
 *
 * 입력이 있는 동안 **인기 검색어가 있던 자리**에 추천 목록(`시술`/`병원`/`원장님`)을 보여주고,
 * 고르면 그 화면으로 보낸다. Enter 는 **추천 목록의 첫 항목**으로 간다 — 클릭과 Enter 가
 * `firstSuggestion()`·`suggestionHref()` 한 벌만 보므로 같은 줄이 두 곳으로 갈리지 않는다.
 *
 * 시술 매칭은 정적 분류 체계(`searchTaxonomy` = `searchTaxonomyAll()[0]`)가 동기로 끝낸다 —
 * 그래서 시술이 걸린 Enter 는 네트워크를 기다리지 않고 즉시 이동한다. 병원·원장님은 서버
 * `q` 필터와 `selectionToListFilters` 가 정한 시술/분야 질의에 맡긴다(클라이언트가 목록을 훑지 않는다).
 */
const TABS: { key: SearchTab; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "procedure", label: "시술" },
  { key: "hospital", label: "병원" },
  { key: "doctor", label: "의사" },
];

const SUGGEST_LIST_ID = "search-suggest-list";
/** 홈 검색창(`components/SearchBar.tsx`)과 같은 neutral-500 — 두 검색창이 같아 보인다. */
const SEARCH_ICON_COLOR = "#737373";
const SEARCH_FAILED_NOTICE =
  "지금은 검색할 수 없어요. 잠시 후 다시 시도해주세요";

/**
 * 목적지 계산은 `trendingTargetPath`(순수 함수) 한 곳이다 — **홈의 인기 검색어 알약**도
 * 같은 함수를 쓴다. 예전에는 이 파일 안에만 있어서 홈이 `/search?q=` 를 거쳐야 했다.
 */
function navigateToTarget(target: SearchTarget, term?: string) {
  router.push(trendingTargetPath(target, term));
}

function TrendBadge({ trend }: { trend: SearchTrend }) {
  if (trend.type === "up") {
    return (
      <Text className="text-xs font-semibold text-rose-500">
        ▲ {trend.delta}
      </Text>
    );
  }
  if (trend.type === "down") {
    return (
      <Text className="text-xs font-semibold text-blue-500">
        ▼ {trend.delta}
      </Text>
    );
  }
  if (trend.type === "new") {
    return <Text className="text-xs font-semibold text-blue-500">NEW</Text>;
  }
  return <Text className="text-xs text-neutral-300">－</Text>;
}

function SearchRow({
  item,
  onSelect,
}: {
  item: TrendingSearchTerm;
  onSelect: (target: SearchTarget, term: string) => void;
}) {
  return (
    <Pressable
      onPress={() => onSelect(item.target, item.term)}
      className="flex-row items-center justify-between border-b border-neutral-50 py-3"
    >
      <View className="flex-row items-center gap-4">
        <Text className="w-5 text-base font-bold text-neutral-400">
          {item.rank}
        </Text>
        <Text className="text-[15px] font-medium text-neutral-800">
          {item.term}
        </Text>
      </View>
      <TrendBadge trend={item.trend} />
    </Pressable>
  );
}

function formatNowLabel(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm} 기준`;
}

export default function SearchScreen() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(q ?? "");
  const [tab, setTab] = useState<SearchTab>("all");
  /** 화살표로 고른 줄. `-1` 이면 활성 없음(= Enter 는 첫 항목으로 간다). */
  const [activeIndex, setActiveIndex] = useState(-1);
  /** Esc 로 추천을 접은 상태. 글자는 그대로 두고 인기 검색어로 돌아간다. */
  const [collapsed, setCollapsed] = useState(false);
  /** 마지막으로 Enter·돋보기 버튼으로 제출한 검색어. 질의 실패 안내를 그 검색어에만 붙인다. */
  const [submittedTerm, setSubmittedTerm] = useState<string | null>(
    q?.trim() ?? null,
  );
  const nowLabel = useMemo(() => formatNowLabel(), []);

  const trimmed = query.trim();
  const suggestions = useSuggestions(query);
  const { groups, flat, count, isSettled, hasError, networkSkipped, flush } =
    suggestions;

  /**
   * 응답을 기다리는 Enter 가 하나라도 있는가.
   *
   * state 가 아니라 ref 인 이유: 아래 effect 가 이 값을 끄면서 `router.push` 만 하면 되고,
   * setState 를 effect 본문에서 하면 연쇄 렌더가 된다. 시퀀스 번호도 필요 없다 — 추천
   * 그룹은 **항상 지금 입력된 검색어의 것**이라(queryKey 에 검색어가 들어간다) 늦게 온
   * 이전 검색어의 응답이 이 자리에 올 수 없다.
   */
  const pendingSubmitRef = useRef(Boolean(q?.trim()));

  useEffect(() => {
    const timeout = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(timeout);
  }, []);

  /**
   * 기다리던 Enter(또는 `?q=` 자동 실행)의 이동. 목적지 결정은 `firstSuggestion()` 하나다.
   * 시술 그룹에 항목이 있으면 네트워크를 기다리지 않는다 — 동기 매칭이라 이미 확정이다.
   */
  useEffect(() => {
    if (!pendingSubmitRef.current) return;
    if (groups.procedures.length > 0) {
      pendingSubmitRef.current = false;
      router.push(suggestionHref(groups.procedures[0]));
      return;
    }
    if (!isSettled) return;
    pendingSubmitRef.current = false;
    const target = firstSuggestion(groups);
    if (target) router.push(suggestionHref(target));
  }, [groups, isSettled]);

  const go = (suggestion: Suggestion) => {
    pendingSubmitRef.current = false;
    router.push(suggestionHref(suggestion));
  };

  const changeQuery = (next: string) => {
    setQuery(next);
    // 글자가 바뀌면 활성 항목은 항상 초기화한다 — 3번째 줄을 고른 채 글자를 지웠는데
    // 다른 항목이 활성인 상태는 거짓 정보다.
    setActiveIndex(-1);
    setCollapsed(false);
    setSubmittedTerm(null);
    pendingSubmitRef.current = false;
  };

  const submit = () => {
    if (!trimmed) return;
    setSubmittedTerm(trimmed);
    setCollapsed(false);

    // 활성 항목이 있으면 그것, 없으면 첫 항목. 활성 번호가 목록 밖이면(응답이 늦게 와서
    // 줄 수가 줄어든 경우) 첫 항목으로 되돌린다 — Enter 가 아무 일도 하지 않는 것보다 낫다.
    const target =
      (activeIndex >= 0 ? flat[activeIndex] : undefined) ??
      firstSuggestion(groups);
    if (target) {
      go(target);
      return;
    }
    if (!isSettled || networkSkipped) {
      // 디바운스를 즉시 끊고 같은 queryKey 의 응답을 기다린다 — 도착하면 위 effect 가 간다.
      // 최소 글자 수(2자)는 "입력 중 자동 질의" 에만 거는 규칙이다. Enter 는 명시적
      // 의사표시라 1자여도 네트워크 경로를 실행한다(오늘과 같다).
      pendingSubmitRef.current = true;
      flush();
      return;
    }
    pendingSubmitRef.current = false;
    // 0건·실패 안내는 아래에서 상태로부터 파생된다.
  };

  const moveActive = (delta: number) => {
    if (flat.length === 0) return;
    // 접힌 목록에서 화살표는 목록을 다시 편다 — 보이지 않는 줄을 활성으로 만들면
    // `aria-activedescendant` 가 그려지지 않은 id 를 가리킨다.
    if (collapsed) {
      setCollapsed(false);
      return;
    }
    setActiveIndex((current) => {
      // 끝에서 처음으로 순환한다 — 최대 9줄이라 헷갈리지 않고 되돌아가기가 빠르다.
      const next = current + delta;
      if (next < 0) return flat.length - 1;
      if (next >= flat.length) return 0;
      return next;
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // 한글 조합 중 Enter(후보 확정)는 검색이 아니다.
    const composing = event.nativeEvent.isComposing || event.keyCode === 229;

    switch (event.key) {
      case "Enter":
        if (composing) return;
        event.preventDefault();
        submit();
        return;
      case "ArrowDown":
        if (composing) return;
        event.preventDefault();
        moveActive(1);
        return;
      case "ArrowUp":
        if (composing) return;
        event.preventDefault();
        moveActive(-1);
        return;
      case "Home":
        if (composing || flat.length === 0) return;
        event.preventDefault();
        setActiveIndex(0);
        return;
      case "End":
        if (composing || flat.length === 0) return;
        event.preventDefault();
        setActiveIndex(flat.length - 1);
        return;
      case "Escape":
        event.preventDefault();
        // Esc 는 "그만" 이다 — 응답을 기다리던 Enter 도 함께 취소한다.
        pendingSubmitRef.current = false;
        if (activeIndex >= 0) setActiveIndex(-1);
        else if (!collapsed) setCollapsed(true);
        else changeQuery("");
        return;
      default:
    }
  };

  // 제출한 검색어의 응답을 아직 기다리는 중인가(= 입력칸 옆 스피너 조건).
  const awaitingSubmit =
    submittedTerm !== null && submittedTerm === trimmed && !isSettled;
  const showSubmitSpinner = useDelayedFlag(awaitingSubmit, 200);

  const hasGroupActivity =
    count > 0 || suggestions.hospitals.isError || suggestions.doctors.isError;
  const suggestionsOpen =
    trimmed.length > 0 && !collapsed && (hasGroupActivity || !isSettled);
  const activeSuggestion =
    activeIndex >= 0 ? (flat[activeIndex] ?? null) : null;

  // 추천 0건이면 기존 안내 문구를 그대로 쓰고 **인기 검색어를 되살린다** — 문구가
  // "아래 인기 검색어를 살펴보세요" 라고 아래를 가리키기 때문이다.
  // 1자·미완성 자모는 아직 아무것도 못 찾은 것이 아니라 **덜 찾은** 상태라 안내하지 않는다.
  const emptyNotice =
    trimmed.length > 0 &&
    isSettled &&
    !hasError &&
    !networkSkipped &&
    count === 0
      ? `"${trimmed}"에 대한 검색 결과가 없어요. 아래 인기 검색어를 살펴보세요`
      : null;
  // Enter 가 기다리던 질의가 실패한 경우. 예전에는 아무 일도 일어나지 않고 콘솔에
  // unhandled rejection 만 남았다.
  const failureNotice =
    submittedTerm === trimmed && isSettled && hasError
      ? SEARCH_FAILED_NOTICE
      : null;
  const notice = failureNotice ?? emptyNotice;

  // 그룹이 전부 확정된 뒤 한 번만 발표한다 — 시술만 먼저 발표하면 바로 뒤에 다시 읽힌다.
  const liveMessage =
    trimmed.length === 0 || !isSettled || collapsed
      ? ""
      : networkSkipped
        ? // 묻지 않은 병원·원장님을 "0개" 로 발표하지 않는다 — 화면의 안내 한 줄과 같은 말을 한다.
          groups.procedures.length > 0
          ? `시술 ${groups.procedures.length}개를 찾았어요. ${MIN_CHARS_HINT}`
          : ""
        : count === 0
          ? "추천 결과가 없어요"
          : `시술 ${groups.procedures.length}개, 병원 ${groups.hospitals.length}개, 원장님 ${groups.doctors.length}개를 찾았어요`;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View
        className={cx(CONTAINER_PADDING, "flex-row items-center gap-2 pt-3")}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          className="px-1 py-2"
        >
          <Text className="text-2xl text-neutral-400">‹</Text>
        </Pressable>
        <View className="flex-1 flex-row items-center rounded-full border-[1.5px] border-brand-600 bg-white px-4 py-2.5">
          {/*
            primitives 의 `TextInput` 은 `onKeyDown`·`aria-*`·composition 이벤트를 아래로
            넘기지 않는다 — 콤보박스 패턴과 IME 가드에 그것들이 반드시 필요해서 이 입력
            하나만 평범한 `<input>` 으로 둔다 (AGENTS.md 가 허용한다). primitive 자체는
            다른 화면 27곳이 쓰므로 손대지 않는다.
          */}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="시술, 병원, 원장님 이름을 검색해보세요"
            role="combobox"
            aria-label="시술, 병원, 원장님 검색"
            aria-expanded={suggestionsOpen}
            // 목록이 그려져 있을 때만 가리킨다 — 닫힌 동안에는 그 id 가 문서에 없다.
            aria-controls={suggestionsOpen ? SUGGEST_LIST_ID : undefined}
            aria-autocomplete="list"
            aria-activedescendant={
              activeSuggestion
                ? suggestionOptionId(activeSuggestion)
                : undefined
            }
            enterKeyHint="search"
            className="flex-1 bg-transparent text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400"
          />
          {/*
            아이콘만 있는 버튼이라 이름을 `accessibilityLabel` 로 준다(primitive 가
            `aria-label` 로 내보낸다). `hitSlop` 13 + 아이콘 18 = 누를 수 있는 영역 44px.
          */}
          <Pressable onPress={submit} hitSlop={13} accessibilityLabel="검색">
            <Search size={18} color={SEARCH_ICON_COLOR} aria-hidden />
          </Pressable>
          {/*
            Enter 가 응답을 기다리는 동안의 표시. 돋보기 버튼을 **치우지 않고 옆에** 둔다 —
            아이콘이 사라졌다 돌아오면 그 순간 그 버튼을 잡고 있던 코드(와 사용자의 손가락)가
            빈 자리를 누르게 된다. 200ms 이상 걸릴 때만 나타난다(목서버 180ms 에서 깜빡임 없음).
          */}
          {showSubmitSpinner ? (
            <span
              aria-hidden="true"
              className="ml-1.5 h-3.5 w-3.5 rounded-full border-2 border-neutral-200 border-t-brand-600 motion-safe:animate-spin"
            />
          ) : null}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-8"
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName={cx(CONTAINER_PADDING, "gap-2 pb-2 pt-4")}
        >
          {SPONSORED_SEARCH_SUGGESTIONS.map((suggestion) => (
            <Pressable
              key={suggestion}
              onPress={() => changeQuery(suggestion)}
              className="flex-row items-center gap-1 rounded-full border border-neutral-200 px-3 py-2"
            >
              <Text className="text-xs text-brand-600">✦</Text>
              <Text className="text-[13px] text-neutral-700">{suggestion}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {notice ? (
          <View className="mx-5 mb-2 mt-2 rounded-xl bg-neutral-50 px-4 py-3">
            <Text className="text-sm text-neutral-500">{notice}</Text>
          </View>
        ) : null}

        <div aria-live="polite" className="sr-only">
          {liveMessage}
        </div>

        {suggestionsOpen ? (
          <SuggestionList
            listId={SUGGEST_LIST_ID}
            query={trimmed}
            groups={groups}
            activeId={
              activeSuggestion ? suggestionOptionId(activeSuggestion) : null
            }
            onSelect={go}
            hospitals={suggestions.hospitals}
            doctors={suggestions.doctors}
            showMinCharsHint={networkSkipped && groups.procedures.length > 0}
          />
        ) : (
          <>
            <View
              className={cx(
                CONTAINER_PADDING,
                "mb-1 mt-4 flex-row items-center justify-between",
              )}
            >
              <Text className="text-lg font-extrabold text-neutral-900">
                인기 검색어
              </Text>
              <Text className="text-xs text-neutral-400">{nowLabel}</Text>
            </View>

            <View
              className={cx(
                CONTAINER_PADDING,
                "mb-2 flex-row border-b border-neutral-100",
              )}
            >
              {TABS.map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => setTab(item.key)}
                  className={`mr-6 border-b-2 py-3 ${tab === item.key ? "border-neutral-900" : "border-transparent"}`}
                >
                  <Text
                    className={`text-sm font-semibold ${tab === item.key ? "text-neutral-900" : "text-neutral-400"}`}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View className={CONTAINER_PADDING}>
              {TRENDING_SEARCHES[tab].map((item) => (
                <SearchRow
                  key={`${tab}-${item.rank}`}
                  item={item}
                  onSelect={(target, term) => navigateToTarget(target, term)}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
