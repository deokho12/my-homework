/**
 * =============================================================================
 * 운영자 권한 부여·회수 CLI — docs/decisions/0001-roles-and-pii.md 결정 4
 * =============================================================================
 *
 * ```bash
 * npm run operator:grant  -- new@x.example    --actor=me@molarmolar.example
 * npm run operator:revoke -- ops@x.example    --actor=me@molarmolar.example
 * npm run operator:revoke -- ops@x.example    --actor=me@molarmolar.example --force  # 마지막 운영자까지
 * ```
 *
 * **`--actor` 는 필수다.** 운영자 승격은 이 시스템의 최고 권한 행위이므로, 기록 없이
 * 성공할 수 있으면 감사가 막으려던 상태 그 자체가 된다. `audit_logs.actor_user_id` 가
 * NOT NULL + FK 라서 OS 사용자를 행위자로 넣을 수 없고, 그래서 실행하는 직원이 자기
 * 계정 이메일을 넘겨야 한다. **운영자일 필요는 없다** — 아무 `users` 행이면 되므로
 * 부트스트랩(운영자가 아직 0명)에서도 실행할 수 있다. `.env` 기본값으로 우회할 수
 * 있게 두지 않은 것도 같은 이유다(기본값이 있으면 필수의 의미가 없다).
 *
 * OS 사용자·호스트는 `audit_logs.user_agent` 에 `cli:operator-role os=user@host` 로 함께
 * 남는다. 둘이 있으면 "누구 계정으로, 어느 머신에서" 가 남는다.
 *
 * **`refresh_tokens` 가 DB 로 옮겨져서 이 CLI 가 세션을 끊을 수 있게 됐다.** 역할을 바꾸면
 * 그 계정의 활성 리프레시 토큰을 같은 트랜잭션에서 폐기한다 (docs/api/README.md §3 의
 * "역할 변경 시 전부 폐기" 를 CLI 도 지킨다). 예전에는 저장소가 서버 프로세스 메모리라
 * 안내문으로 때웠다.
 *
 * **왜 HTTP 엔드포인트가 아닌가 (결정 4 그대로):**
 * 운영자 승격 엔드포인트가 존재하면 그것이 시스템의 최고 권한 상승 표면이 된다 —
 * 인증·인가에 어떤 결함이 생기든 그 경로 하나로 전권을 얻는다. 이 스크립트는
 * **DB 자격증명과 파일시스템 접근 권한**을 요구하므로 네트워크만으로는 도달할 수 없다.
 *
 * 그래서 이 파일에는 HTTP 서버·라우터가 들어오지 않는다. Nest 를 부팅하지 않고
 * PrismaClient 를 직접 쓰는 것도 같은 이유다(부팅하면 컨트롤러가 함께 로드된다).
 */
import { PrismaClient } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';
import * as os from 'node:os';

import { insertAuditLog } from '../audit/audit-log.record';
import type { AuditAction } from '../audit/audit-log.types';
import { revokeActiveRefreshTokens } from '../auth/refresh-token-revocation';
import { isUserRole } from '../auth/auth.types';
import type { UserRole } from '../auth/auth.types';

// `.env` 로드. dotenv 는 devDependency 라 운영 번들에 없을 수 있고, 운영에서는 보통
// 환경변수가 이미 주입되어 있다 — 없으면 조용히 건너뛴다(그러면 DATABASE_URL 이 없어
// PrismaClient 가 명확한 오류를 낸다).
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('dotenv/config');
} catch {
  /* 운영 환경: 환경변수가 이미 있다 */
}

type Action = 'grant' | 'revoke';

const prisma = new PrismaClient();

function usage(): string {
  return [
    '사용법:',
    '  npm run operator:grant  -- <email> --actor=<email>',
    '  npm run operator:revoke -- <email> --actor=<email> [--force]',
    '',
    '  <email>          이미 가입된 계정의 이메일 (대소문자·공백 무시)',
    '  --actor=<email>  ★ 필수. 이 작업을 실행하는 사람의 계정 이메일입니다.',
    '                   audit_logs 의 행위자로 남습니다 (actor_user_id 가 NOT NULL + FK 라서',
    '                   OS 사용자로는 기록할 수 없습니다). operator 일 필요는 없고 가입된',
    '                   계정이면 됩니다 — 운영자가 0명인 부트스트랩에서도 실행됩니다.',
    '  --force          revoke 전용. 마지막 운영자를 회수할 때 필요합니다',
  ].join('\n');
}

/** 이 CLI 를 실행한 OS 사용자. audit_logs.user_agent 스냅샷과 stdout 줄에 함께 남는다. */
function osActor(): string {
  return `${os.userInfo().username}@${os.hostname()}`;
}

/**
 * 감사 기록 한 줄 (stdout). DB 기록과 **함께** 남긴다 — `audit_logs` 는 DB 를 읽을 수 있는
 * 사람만 보고, 이 줄은 CI/셸 로그·터미널 기록에 남아서 두 경로가 서로를 검증한다.
 */
function auditLine(
  action: string,
  target: { id: string; email: string },
  actor: { email: string },
  extra?: string,
): string {
  return (
    `[AUDIT] ${new Date().toISOString()} action=${action} ` +
    `actor=${actor.email} actor_os_user=${osActor()} ` +
    `target_user_id=${target.id} target_email=${target.email}` +
    (extra ? ` ${extra}` : '')
  );
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function toRole(value: string): UserRole {
  return isUserRole(value) ? value : 'user';
}

/**
 * `--actor=<email>` 로 지정된 행위자 — `audit_logs.actor_user_id` 에 들어갈 실제 계정이다.
 * 필수 인자이므로 `null` 인 상태는 존재하지 않는다.
 */
interface AuditActor {
  id: string;
  email: string;
  role: UserRole;
}

/**
 * 행위자를 찾는다. **역할을 검사하지 않는다** — 운영자가 0명인 부트스트랩에서도 실행되어야
 * 하고, 어차피 이 CLI 를 돌릴 수 있는 사람은 이미 DB 자격증명을 가진 사람이다. 여기서
 * 얻는 것은 권한 판정이 아니라 "누가 지시했는가" 의 식별자다.
 */
async function resolveActor(email: string): Promise<AuditActor | 'not-found'> {
  const row = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
    select: { id: true, email: true, role: true, deletedAt: true },
  });

  if (!row || row.deletedAt) {
    return 'not-found';
  }

  return { id: row.id, email: row.email, role: toRole(row.role) };
}

/**
 * 역할 변경을 **한 트랜잭션**으로 처리한다: `users.role` UPDATE + 활성 리프레시 토큰 폐기
 * + `audit_logs` INSERT.
 *
 * 감사 쓰기를 같은 트랜잭션에 넣은 이유는 `AuditLogService` 의 정책과 같다 — 이 행위의
 * `pii_masked` 는 `false`(대상 계정의 이메일·이름을 봤다)이고, 기록되지 않은 권한 변경은
 * 허용하지 않는다. 실패하면 역할 변경도 함께 롤백된다(부분 적용이 없다).
 */
async function applyRoleChange(input: {
  target: { id: string; email: string };
  fromRole: UserRole;
  toRole: UserRole;
  action: AuditAction;
  actor: AuditActor;
}): Promise<{ revokedSessions: number; auditLogId: string }> {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: input.target.id }, data: { role: input.toRole, updatedAt: now } });

    // 역할 변경 시 그 계정의 리프레시 토큰을 전부 폐기한다 (docs/api/README.md §3).
    // 액세스 토큰은 무상태 검증이라 만료(최대 15분)까지 옛 역할로 남는다.
    const revokedSessions = await revokeActiveRefreshTokens(tx, input.target.id, now);

    const auditLogId = await insertAuditLog(
      tx,
      {
        actorUserId: input.actor.id,
        // 행위 시점의 역할 스냅샷 (users.role 을 나중에 조인하지 않는다)
        actorRole: input.actor.role,
        action: input.action,
        targetType: 'user',
        targetId: input.target.id,
        hospitalId: null,
        // 대상 계정의 이메일·이름을 마스킹 없이 보고 실행한다 (§11.2 의 hospital_admin.assign 과 같은 판단)
        piiMasked: false,
        // HTTP 요청이 아니므로 requestId 를 만들어 넣는다. 접두어로 출처를 구분한다
        requestId: `cli-${createId()}`,
        ip: null,
        // OS 사용자·호스트를 여기 남긴다. actor_user_id 만으로는 "어느 머신에서
        // DB 자격증명으로 실행했는가" 가 남지 않는다
        userAgent: `cli:operator-role os=${osActor()}`,
        beforeValue: input.fromRole,
        afterValue: input.toRole,
      },
      now,
    );

    return { revokedSessions, auditLogId };
  });
}

/** 감사·세션 처리 결과를 stdout 으로 알린다. */
function reportSideEffects(result: { revokedSessions: number; auditLogId: string }, actor: AuditActor): void {
  console.log(`  audit_logs 에 기록했습니다 (id=${result.auditLogId}, actor=${actor.email}).`);

  console.log('');

  if (result.revokedSessions > 0) {
    console.log(`  ⚠ 이 계정의 활성 세션 ${result.revokedSessions}개를 폐기했습니다 — 해당 기기는`);
    console.log('    **다시 로그인**해야 합니다. 액세스 토큰은 최대 15분간 옛 역할로 남습니다.');
  } else {
    console.log('  ⚠ 폐기할 활성 세션이 없었습니다. 이 계정이 로그인해 있다면 액세스 토큰이');
    console.log('    만료될 때까지(최대 15분) 옛 역할로 남고, 그 뒤 **다시 로그인**하면 새 역할이 적용됩니다.');
  }
}

async function grant(email: string, actor: AuditActor): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true, deletedAt: true },
  });

  if (!user) {
    console.error(`✗ '${email}' 로 가입된 계정이 없습니다.`);
    console.error('  운영자 승격은 **기존 계정**만 대상입니다. 먼저 회원가입을 안내하세요');
    console.error('  (docs/api/README.md §3 "병원 관리자 계정을 만드는 방법 — 기존 계정 승격").');

    return 1;
  }

  if (user.deletedAt) {
    console.error(`✗ '${email}' 는 탈퇴한 계정입니다 (deleted_at=${user.deletedAt.toISOString()}).`);

    return 1;
  }

  if (user.role === 'operator') {
    console.log(`= '${email}' 는 이미 operator 입니다. 아무것도 바꾸지 않았습니다.`);

    return 0;
  }

  // 운영자는 병원 담당자를 겸할 수 없다. 겸직하면 자기 병원 전문의를 스스로 검수할 수 있어
  // operator 를 만든 이유(역할 분리)가 무너진다 — 결정 4 마지막 문단, API 의 422 CANNOT_ASSIGN_OPERATOR.
  const managed = await prisma.hospitalAdmin.findMany({
    where: { userId: user.id },
    select: { hospitalId: true },
  });

  if (managed.length > 0) {
    console.error(`✗ '${email}' 는 병원 담당자입니다 (${managed.map((m) => m.hospitalId).join(', ')}).`);
    console.error('  운영자는 병원 담당자를 겸할 수 없습니다 — 자기 병원 전문의를 스스로 검수할 수 있게 됩니다.');
    console.error('  먼저 담당을 해제하세요 (DELETE /api/v1/hospitals/{id}/admins/{userId}).');

    return 1;
  }

  const result = await applyRoleChange({
    target: user,
    fromRole: toRole(user.role),
    toRole: 'operator',
    action: 'user.role_grant_operator',
    actor,
  });

  console.log(`✓ '${email}' (${user.name}) 의 역할을 ${user.role} → operator 로 올렸습니다.`);
  // stdout 줄을 그대로 남긴다: **어느 OS 사용자가 실행했는가** 는 audit_logs 의 어떤 컬럼도
  // 1급으로 담지 않고(user_agent 안의 문자열이다), 셸 로그는 DB 와 별개로 보존된다.
  console.log(auditLine('user.role_grant_operator', user, actor, `from_role=${user.role}`));
  reportSideEffects(result, actor);

  return 0;
}

async function revoke(email: string, force: boolean, actor: AuditActor): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!user) {
    console.error(`✗ '${email}' 로 가입된 계정이 없습니다.`);

    return 1;
  }

  if (user.role !== 'operator') {
    console.error(`✗ '${email}' 는 operator 가 아닙니다 (현재 역할: ${user.role}).`);

    return 1;
  }

  const operatorCount = await prisma.user.count({ where: { role: 'operator', deletedAt: null } });

  if (operatorCount <= 1 && !force) {
    console.error(`✗ '${email}' 는 **마지막 운영자**입니다. 회수하면 다음이 불가능해집니다:`);
    console.error('    - 병원 생성, 병원 담당자 지정, 전문의 인증 검수, 입점 문의 심사');
    console.error('  그리고 운영자 승격은 HTTP 로 불가능하므로(결정 4) 이 CLI 로만 되돌릴 수 있습니다.');
    console.error('  정말 회수하려면 --force 를 붙이세요.');

    return 1;
  }

  // 담당 병원이 없으므로 role='user' 로 되돌리는 것이 맞다. (grant 가 겸직을 막았다)
  const result = await applyRoleChange({
    target: user,
    fromRole: 'operator',
    toRole: 'user',
    action: 'user.role_revoke_operator',
    actor,
  });

  console.log(`✓ '${email}' (${user.name}) 의 역할을 operator → user 로 되돌렸습니다.`);
  console.log(auditLine('user.role_revoke_operator', user, actor, `remaining_operators=${operatorCount - 1}`));

  if (operatorCount - 1 === 0) {
    console.log('');
    console.log('  ⚠ 남은 운영자가 0명입니다. 운영자 전용 기능이 모두 멈춥니다.');
  }

  reportSideEffects(result, actor);

  return 0;
}

async function main(): Promise<number> {
  const [rawAction, rawEmail, ...rest] = process.argv.slice(2);

  if (rawAction !== 'grant' && rawAction !== 'revoke') {
    console.error(`✗ 알 수 없는 동작: '${rawAction ?? ''}'\n`);
    console.error(usage());

    return 2;
  }

  const action: Action = rawAction;

  if (!rawEmail || rawEmail.startsWith('-')) {
    console.error('✗ 이메일을 주세요.\n');
    console.error(usage());

    return 2;
  }

  const email = normalizeEmail(rawEmail);
  const force = rest.includes('--force');
  const actorEmail = rest.find((arg) => arg.startsWith('--actor='))?.slice('--actor='.length).trim();

  // ★ --actor 는 필수다. 없으면 **DB 를 건드리기 전에** 멈춘다 — 운영자 승격이 기록 없이
  //   성공하는 경로를 남기지 않는다. 환경변수 기본값으로 채우지 않는 것도 의도다.
  if (!actorEmail) {
    console.error('✗ --actor=<email> 은 필수입니다. 이 작업을 실행하는 사람의 계정 이메일을 주세요.\n');
    console.error('  운영자 승격·회수는 이 시스템의 최고 권한 행위라서, 감사 기록 없이 성공할 수');
    console.error('  없게 두었습니다 (audit_logs.actor_user_id 가 NOT NULL + FK 이고 OS 사용자로는');
    console.error('  기록할 수 없습니다). 아무것도 바꾸지 않았습니다.\n');
    console.error(usage());

    return 2;
  }

  const actor = await resolveActor(actorEmail);

  if (actor === 'not-found') {
    console.error(`✗ --actor 로 준 '${actorEmail}' 계정을 찾을 수 없습니다 (탈퇴 계정도 안 됩니다).`);
    console.error('  감사 기록의 행위자는 실제 계정이어야 합니다 (audit_logs.actor_user_id FK).');
    console.error('  operator 일 필요는 없습니다 — 가입된 계정이면 됩니다. 아무것도 바꾸지 않았습니다.');

    return 1;
  }

  return action === 'grant' ? grant(email, actor) : revoke(email, force, actor);
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error('✗ 실행 중 오류가 발생했습니다:');
    console.error(error instanceof Error ? (error.stack ?? error.message) : error);
    process.exitCode = 1;
  })
  .finally(() => {
    // SQLite 파일 락을 놓는다. 안 놓으면 다음 명령이 막힌다.
    void prisma.$disconnect();
  });
