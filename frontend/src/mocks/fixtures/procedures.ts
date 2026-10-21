import { SUB_PROCEDURES, type SubProcedureId } from '@/features/procedure/taxonomy';
import type { Procedure } from '@/types/domain';

/**
 * `GET /procedures` 응답의 목 데이터 (31개).
 *
 * **id·이름·순서·분야는 `taxonomy.ts` 에서 파생한다** — 같은 값을 세 번째로 베끼지 않는다
 * (원본은 `backend/prisma/seed/data/procedures.ts`, 두 번째 사본이 `taxonomy.ts` 이고
 * 그 둘은 `taxonomy.sync.test.ts` 가 묶는다). 이 파일이 직접 들고 있는 것은 **목 데이터용
 * 이모지와 문구**뿐이다 — 서버의 최종 문구는 시드 파일에 있다.
 *
 * `isAvailable` 은 서버가 "그 시술을 하는 병원이 1곳 이상인가" 로 매번 집계하는 값이라
 * 고정 목록에 진짜 값이 있을 수 없다. 여기서는 전부 `true` 로 두고, `준비중` 을 보는
 * 테스트가 자기 값으로 덮는다.
 */

interface MockProcedureCopy {
  emoji: string;
  shortDescription: string;
  description: string;
}

const MOCK_COPY: Record<SubProcedureId, MockProcedureCopy> = {
  'implant-general': { emoji: '🦷', shortDescription: '자연치아처럼 튼튼하게', description: '상실된 치아 자리에 인공 치근을 심고 보철물을 올리는 시술입니다. 재료와 식립 개수에 따라 비용과 기간이 달라져요.' },
  'bone-graft': { emoji: '🧱', shortDescription: '임플란트 심을 자리를 만들어요', description: '잇몸뼈(치조골)가 부족할 때 뼈를 채워 임플란트를 심을 수 있는 상태로 만드는 시술입니다.' },
  'sinus-lift': { emoji: '⛰️', shortDescription: '위턱 어금니 임플란트를 위해', description: '위턱 어금니 쪽 뼈가 얇을 때 상악동 점막을 들어 올려 뼈를 보강한 뒤 임플란트를 심는 시술입니다.' },
  'implant-denture': { emoji: '🔩', shortDescription: '틀니를 임플란트로 고정', description: '임플란트 몇 개를 심어 틀니를 단단히 고정하는 방식입니다. 잇몸으로만 지지하는 틀니보다 잘 흔들리지 않아요.' },
  'scaling': { emoji: '🪥', shortDescription: '치석을 제거해 잇몸 건강을 지켜요', description: '칫솔질로 닿지 않는 치석과 치태를 기구로 제거하는 기본 예방 처치입니다.' },
  'fluoride': { emoji: '🧴', shortDescription: '충치에 강한 치아로', description: '치아 표면에 불소를 발라 산에 대한 저항성을 높이고 초기 충치를 예방하는 처치입니다.' },
  'sealant': { emoji: '🧷', shortDescription: '어금니 홈을 미리 메워요', description: '어금니 씹는 면의 깊은 홈을 메워 음식물이 끼지 않게 하는 충치 예방 처치입니다.' },
  'halitosis': { emoji: '🌬️', shortDescription: '입냄새의 원인을 찾아서', description: '입냄새의 구강 내 원인(치주질환·설태·건조)을 찾아 치료하고 관리법을 안내하는 진료입니다.' },
  'clear-aligner': { emoji: '💎', shortDescription: '눈에 잘 띄지 않는 교정', description: '투명한 장치를 단계별로 바꿔 끼며 치아를 움직이는 교정 방식입니다. 탈착이 가능해요.' },
  'lingual-braces': { emoji: '🫥', shortDescription: '장치를 치아 안쪽에', description: '교정 장치를 치아 안쪽 면에 붙여 겉으로 보이지 않게 하는 교정 방식입니다.' },
  'bracket-braces': { emoji: '😁', shortDescription: '가장 널리 쓰는 교정 방식', description: '치아 바깥면에 브라켓을 붙이고 와이어로 치아를 움직이는 교정입니다. 메탈·세라믹 브라켓을 고를 수 있어요.' },
  'partial-ortho': { emoji: '⏱️', shortDescription: '필요한 곳만 짧게', description: '앞니 등 일부 구간만 움직이는 교정입니다. 전체 교정보다 기간과 비용이 작아요.' },
  'resin': { emoji: '🩹', shortDescription: '충치 부위를 치아색으로', description: '충치를 제거한 자리를 치아 색 레진으로 채우는 보존 치료입니다. 하루에 끝나는 경우가 많아요.' },
  'inlay': { emoji: '🧩', shortDescription: '충치 부위만 정밀하게', description: '충치로 손상된 부위를 본떠 만든 보철물을 끼워 넣는 시술로, 삭제 범위를 최소화할 수 있어요.' },
  'onlay': { emoji: '🔷', shortDescription: '씹는 면까지 덮어서', description: '인레이보다 손상 범위가 클 때 치아의 씹는 면(교두)까지 덮어 복원하는 보철입니다.' },
  'crown': { emoji: '👑', shortDescription: '손상된 치아를 감싸기', description: '신경치료 후이거나 손상이 큰 치아를 전체적으로 감싸 씌워 기능과 모양을 회복하는 보철 시술입니다.' },
  'root-canal': { emoji: '🪡', shortDescription: '치아를 살려서 쓰기 위해', description: '충치가 신경까지 닿았을 때 염증이 생긴 치수를 제거하고 내부를 소독·충전하는 치료입니다.' },
  'laminate': { emoji: '✨', shortDescription: '치아 앞면을 얇게 코팅', description: '치아 앞면을 얇게 삭제한 뒤 세라믹 조각을 부착해 색과 모양을 개선하는 심미 시술입니다.' },
  'whitening': { emoji: '🌟', shortDescription: '치아 색을 밝게', description: '약제를 이용해 치아 표면의 착색을 개선하고 색조를 밝게 만드는 심미 시술입니다.' },
  'gum-contouring': { emoji: '💗', shortDescription: '웃을 때 잇몸이 많이 보인다면', description: '잇몸 라인을 다듬어 치아와 잇몸의 비율을 맞추는 심미 시술입니다.' },
  'gum-treatment': { emoji: '🌿', shortDescription: '잇몸 염증을 가라앉혀요', description: '잇몸 속 치석과 염증 조직을 제거해 치주질환의 진행을 막는 치료입니다.' },
  'periodontal-surgery': { emoji: '🩺', shortDescription: '깊은 치주질환에는 수술로', description: '비수술 치료로 닿지 않는 깊은 치주 조직을 잇몸을 열어 직접 치료하는 수술입니다.' },
  'gum-graft': { emoji: '🌱', shortDescription: '내려앉은 잇몸을 덮어요', description: '잇몸이 퇴축해 치아 뿌리가 드러난 부위에 연조직을 이식해 덮는 시술입니다.' },
  'tmj-treatment': { emoji: '🦴', shortDescription: '통증·소리·개구장애 개선', description: '턱관절의 통증, 소리, 입 벌림 제한 등을 진단하고 치료하는 턱관절 질환 관리 진료입니다.' },
  'splint': { emoji: '🛡️', shortDescription: '턱관절에 가는 힘을 분산', description: '교합을 안정시켜 턱관절과 근육의 부담을 줄이는 구강 내 장치 치료입니다.' },
  'bruxism-device': { emoji: '🌙', shortDescription: '자는 동안 치아를 보호', description: '수면 중 이갈이로부터 치아 마모와 턱 근육 긴장을 막아 주는 장치입니다.' },
  'snoring-device': { emoji: '😴', shortDescription: '수면 중 코골이 완화', description: '하악을 전방으로 유도해 기도를 확보, 코골이와 수면무호흡을 완화하는 구강 내 장치입니다.' },
  'bruxism-botox': { emoji: '💉', shortDescription: '이갈이로 뭉친 근육을 풀어요', description: '저작근에 보톡스를 주입해 이갈이·이악물기로 인한 근육 긴장과 턱 통증을 완화하는 시술입니다.' },
  'masseter-botox': { emoji: '💆', shortDescription: '턱선을 갸름하게', description: '발달한 교근에 보톡스를 주입해 턱선을 부드럽게 만드는 시술입니다.' },
  'wisdom-tooth': { emoji: '😬', shortDescription: '통증 전에 미리 발치', description: '매복되었거나 통증·염증을 유발하는 사랑니를 안전하게 발치하는 시술입니다.' },
  'general-extraction': { emoji: '✂️', shortDescription: '보존이 어려운 치아는 빼요', description: '살릴 수 없는 치아를 빼내고 이후 보철·임플란트 계획을 함께 세우는 진료입니다.' },
};

export const procedures: Procedure[] = SUB_PROCEDURES.map((sub) => ({
  id: sub.id,
  name: sub.name,
  categoryId: sub.categoryId,
  isAvailable: true,
  ...MOCK_COPY[sub.id],
}));
