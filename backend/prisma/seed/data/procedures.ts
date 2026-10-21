/**
 * 세부 시술 31개 — **서버가 갖는 원본** (docs/database/README.md §17.4).
 *
 * 이 파일도 `procedure-categories.ts` 와 같은 이유로 **import 가 하나도 없다** —
 * 프론트엔드의 동기화 테스트가 상대 경로로 읽는다 (§17.8).
 *
 * - id·이름·순서·분야는 `frontend/src/features/procedure/taxonomy.ts` 의 `SUB_PROCEDURES`
 *   와 같다 (요청서 14 — "이름·순서는 taxonomy.ts 그대로")
 * - `sort_order` 는 **31개 전체의 통짜 순서**(이 배열의 인덱스)다. 분야 순서 × 분야 안
 *   순서를 한 줄로 편 값이라, 분야별 두 번째 순서 컬럼을 두지 않는다 (§17.3)
 * - 옛 서버 id 6개는 여기 없다 (`implant`→`implant-general`, `orthodontics`→`bracket-braces`,
 *   `cavity`→`resin`, `gum-disease`→`gum-treatment`, `tmj`→`tmj-treatment`,
 *   `botox`→`bruxism-botox`). **서버는 옛 id 를 받지 않는다** — 바깥에 이미 나간 주소·
 *   브라우저 저장소의 옛 id 는 화면의 별칭 표 하나가 푼다 (§17.5)
 */

export interface ProcedureSeedRow {
  id: string;
  name: string;
  emoji: string;
  shortDescription: string;
  description: string;
  /** `procedureCategories` 의 id 9개 중 하나. 분야 없는 시술은 없다. */
  categoryId: string;
}

/** `sort_order` 는 이 배열의 인덱스다 (시드가 넣는다). */
export const procedures: ProcedureSeedRow[] = [
  {
    id: 'implant-general',
    name: '일반 임플란트',
    emoji: '🦷',
    shortDescription: '자연치아처럼 튼튼하게',
    description:
      '상실된 치아 자리에 인공 치근을 심고 보철물을 올리는 시술입니다. 재료와 식립 개수에 따라 비용과 기간이 달라져요.',
    categoryId: 'implant',
  },
  {
    id: 'bone-graft',
    name: '뼈이식',
    emoji: '🧱',
    shortDescription: '임플란트 심을 자리를 만들어요',
    description: '잇몸뼈(치조골)가 부족할 때 뼈를 채워 임플란트를 심을 수 있는 상태로 만드는 시술입니다.',
    categoryId: 'implant',
  },
  {
    id: 'sinus-lift',
    name: '상악동거상술',
    emoji: '⛰️',
    shortDescription: '위턱 어금니 임플란트를 위해',
    description:
      '위턱 어금니 쪽 뼈가 얇을 때 상악동 점막을 들어 올려 뼈를 보강한 뒤 임플란트를 심는 시술입니다.',
    categoryId: 'implant',
  },
  {
    id: 'implant-denture',
    name: '임플란트 틀니',
    emoji: '🔩',
    shortDescription: '틀니를 임플란트로 고정',
    description:
      '임플란트 몇 개를 심어 틀니를 단단히 고정하는 방식입니다. 잇몸으로만 지지하는 틀니보다 잘 흔들리지 않아요.',
    categoryId: 'implant',
  },
  {
    id: 'scaling',
    name: '스케일링',
    emoji: '🪥',
    shortDescription: '치석을 제거해 잇몸 건강을 지켜요',
    description: '칫솔질로 닿지 않는 치석과 치태를 기구로 제거하는 기본 예방 처치입니다.',
    categoryId: 'prevention',
  },
  {
    id: 'fluoride',
    name: '불소도포',
    emoji: '🧴',
    shortDescription: '충치에 강한 치아로',
    description: '치아 표면에 불소를 발라 산에 대한 저항성을 높이고 초기 충치를 예방하는 처치입니다.',
    categoryId: 'prevention',
  },
  {
    id: 'sealant',
    name: '실란트',
    emoji: '🧷',
    shortDescription: '어금니 홈을 미리 메워요',
    description: '어금니 씹는 면의 깊은 홈을 메워 음식물이 끼지 않게 하는 충치 예방 처치입니다.',
    categoryId: 'prevention',
  },
  {
    id: 'halitosis',
    name: '구취관리',
    emoji: '🌬️',
    shortDescription: '입냄새의 원인을 찾아서',
    description: '입냄새의 구강 내 원인(치주질환·설태·건조)을 찾아 치료하고 관리법을 안내하는 진료입니다.',
    categoryId: 'prevention',
  },
  {
    id: 'clear-aligner',
    name: '투명교정',
    emoji: '💎',
    shortDescription: '눈에 잘 띄지 않는 교정',
    description: '투명한 장치를 단계별로 바꿔 끼며 치아를 움직이는 교정 방식입니다. 탈착이 가능해요.',
    categoryId: 'orthodontics',
  },
  {
    id: 'lingual-braces',
    name: '설측교정',
    emoji: '🫥',
    shortDescription: '장치를 치아 안쪽에',
    description: '교정 장치를 치아 안쪽 면에 붙여 겉으로 보이지 않게 하는 교정 방식입니다.',
    categoryId: 'orthodontics',
  },
  {
    id: 'bracket-braces',
    name: '일반(브라켓)교정',
    emoji: '😁',
    shortDescription: '가장 널리 쓰는 교정 방식',
    description:
      '치아 바깥면에 브라켓을 붙이고 와이어로 치아를 움직이는 교정입니다. 메탈·세라믹 브라켓을 고를 수 있어요.',
    categoryId: 'orthodontics',
  },
  {
    id: 'partial-ortho',
    name: '부분교정',
    emoji: '⏱️',
    shortDescription: '필요한 곳만 짧게',
    description: '앞니 등 일부 구간만 움직이는 교정입니다. 전체 교정보다 기간과 비용이 작아요.',
    categoryId: 'orthodontics',
  },
  {
    id: 'resin',
    name: '레진',
    emoji: '🩹',
    shortDescription: '충치 부위를 치아색으로',
    description: '충치를 제거한 자리를 치아 색 레진으로 채우는 보존 치료입니다. 하루에 끝나는 경우가 많아요.',
    categoryId: 'cavity',
  },
  {
    id: 'inlay',
    name: '인레이',
    emoji: '🧩',
    shortDescription: '충치 부위만 정밀하게',
    description: '충치로 손상된 부위를 본떠 만든 보철물을 끼워 넣는 시술로, 삭제 범위를 최소화할 수 있어요.',
    categoryId: 'cavity',
  },
  {
    id: 'onlay',
    name: '온레이',
    emoji: '🔷',
    shortDescription: '씹는 면까지 덮어서',
    description: '인레이보다 손상 범위가 클 때 치아의 씹는 면(교두)까지 덮어 복원하는 보철입니다.',
    categoryId: 'cavity',
  },
  {
    id: 'crown',
    name: '크라운',
    emoji: '👑',
    shortDescription: '손상된 치아를 감싸기',
    description: '신경치료 후이거나 손상이 큰 치아를 전체적으로 감싸 씌워 기능과 모양을 회복하는 보철 시술입니다.',
    categoryId: 'cavity',
  },
  {
    id: 'root-canal',
    name: '신경치료',
    emoji: '🪡',
    shortDescription: '치아를 살려서 쓰기 위해',
    description: '충치가 신경까지 닿았을 때 염증이 생긴 치수를 제거하고 내부를 소독·충전하는 치료입니다.',
    categoryId: 'cavity',
  },
  {
    id: 'laminate',
    name: '라미네이트',
    emoji: '✨',
    shortDescription: '치아 앞면을 얇게 코팅',
    description: '치아 앞면을 얇게 삭제한 뒤 세라믹 조각을 부착해 색과 모양을 개선하는 심미 시술입니다.',
    categoryId: 'aesthetic',
  },
  {
    id: 'whitening',
    name: '치아미백',
    emoji: '🌟',
    shortDescription: '치아 색을 밝게',
    description: '약제를 이용해 치아 표면의 착색을 개선하고 색조를 밝게 만드는 심미 시술입니다.',
    categoryId: 'aesthetic',
  },
  {
    id: 'gum-contouring',
    name: '잇몸성형',
    emoji: '💗',
    shortDescription: '웃을 때 잇몸이 많이 보인다면',
    description: '잇몸 라인을 다듬어 치아와 잇몸의 비율을 맞추는 심미 시술입니다.',
    categoryId: 'aesthetic',
  },
  {
    id: 'gum-treatment',
    name: '잇몸치료',
    emoji: '🌿',
    shortDescription: '잇몸 염증을 가라앉혀요',
    description: '잇몸 속 치석과 염증 조직을 제거해 치주질환의 진행을 막는 치료입니다.',
    categoryId: 'gum',
  },
  {
    id: 'periodontal-surgery',
    name: '치주수술',
    emoji: '🩺',
    shortDescription: '깊은 치주질환에는 수술로',
    description: '비수술 치료로 닿지 않는 깊은 치주 조직을 잇몸을 열어 직접 치료하는 수술입니다.',
    categoryId: 'gum',
  },
  {
    id: 'gum-graft',
    name: '잇몸이식',
    emoji: '🌱',
    shortDescription: '내려앉은 잇몸을 덮어요',
    description: '잇몸이 퇴축해 치아 뿌리가 드러난 부위에 연조직을 이식해 덮는 시술입니다.',
    categoryId: 'gum',
  },
  {
    id: 'tmj-treatment',
    name: '턱관절장애 치료',
    emoji: '🦴',
    shortDescription: '통증·소리·개구장애 개선',
    description: '턱관절의 통증, 소리, 입 벌림 제한 등을 진단하고 치료하는 턱관절 질환 관리 진료입니다.',
    categoryId: 'tmj',
  },
  {
    id: 'splint',
    name: '스플린트',
    emoji: '🛡️',
    shortDescription: '턱관절에 가는 힘을 분산',
    description: '교합을 안정시켜 턱관절과 근육의 부담을 줄이는 구강 내 장치 치료입니다.',
    categoryId: 'tmj',
  },
  {
    id: 'bruxism-device',
    name: '이갈이장치',
    emoji: '🌙',
    shortDescription: '자는 동안 치아를 보호',
    description: '수면 중 이갈이로부터 치아 마모와 턱 근육 긴장을 막아 주는 장치입니다.',
    categoryId: 'tmj',
  },
  {
    id: 'snoring-device',
    name: '코골이장치',
    emoji: '😴',
    shortDescription: '수면 중 코골이 완화',
    description: '하악을 전방으로 유도해 기도를 확보, 코골이와 수면무호흡을 완화하는 구강 내 장치입니다.',
    categoryId: 'tmj',
  },
  {
    id: 'bruxism-botox',
    name: '이갈이 보톡스',
    emoji: '💉',
    shortDescription: '이갈이로 뭉친 근육을 풀어요',
    description: '저작근에 보톡스를 주입해 이갈이·이악물기로 인한 근육 긴장과 턱 통증을 완화하는 시술입니다.',
    categoryId: 'botox',
  },
  {
    id: 'masseter-botox',
    name: '사각턱(교근) 보톡스',
    emoji: '💆',
    shortDescription: '턱선을 갸름하게',
    description: '발달한 교근에 보톡스를 주입해 턱선을 부드럽게 만드는 시술입니다.',
    categoryId: 'botox',
  },
  {
    id: 'wisdom-tooth',
    name: '사랑니 발치',
    emoji: '😬',
    shortDescription: '통증 전에 미리 발치',
    description: '매복되었거나 통증·염증을 유발하는 사랑니를 안전하게 발치하는 시술입니다.',
    categoryId: 'extraction',
  },
  {
    id: 'general-extraction',
    name: '일반 발치',
    emoji: '✂️',
    shortDescription: '보존이 어려운 치아는 빼요',
    description: '살릴 수 없는 치아를 빼내고 이후 보철·임플란트 계획을 함께 세우는 진료입니다.',
    categoryId: 'extraction',
  },
];
