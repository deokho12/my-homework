import type { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { createNotificationWithRecipients, findHospitalAdminUserIds } from '../src/notification/notification.tx';
import { buildNotificationRow, buildRecipientRows } from '../src/notification/notification.write';

/**
 * 알림 행 만들기 — **모양은 순수 함수**(`notification.write.ts`), **삽입은 tx 헬퍼**
 * (`notification.tx.ts`).
 *
 * 원작성: 협업자(2026-08 hospital-doctor-domain-api 브랜치), 가져와 수정
 * (수정한 것: 순수/삽입이 갈리면서 단정도 갈렸다. `consultStatus` 케이스를 더했다.)
 *
 * 이 헬퍼가 존재하는 이유는 **트랜잭션을 갈라놓지 않기 위해서**다. 검수 결정은 검수 이력과,
 * 상담 접수는 상담 행과 원자적이어야 한다. 여기서는 **판단**만 고정한다(수신자 0명 처리,
 * 중복 제거, 필드 매핑). Prisma 가 이 모양을 실제로 받는지는 e2e 가 확인한다.
 */

const NOW = new Date('2026-10-22T03:00:00.000Z');

describe('buildNotificationRow — 순수 변환', () => {
  it('선택 필드를 명시적으로 null 로 채운다 (키가 없는 것과 섞이면 안 된다)', () => {
    expect(
      buildNotificationRow(
        'ntf-1',
        {
          audience: 'user',
          type: 'system',
          title: 't',
          message: 'm',
          consultStatus: null,
          recipientUserIds: ['u1'],
        },
        NOW,
      ),
    ).toEqual({
      id: 'ntf-1',
      audience: 'user',
      type: 'system',
      title: 't',
      message: 'm',
      consultStatus: null,
      relatedType: null,
      relatedId: null,
      hospitalId: null,
      createdAt: NOW,
    });
  });

  it('★ consultStatus 는 선택이 아니라 필수 키다 — 새로 만드는 상담 알림은 반드시 적는다', () => {
    const row = buildNotificationRow(
      'ntf-2',
      {
        audience: 'admin',
        type: 'consult-status',
        title: '새로운 상담 신청',
        message: '박서영님이 상담을 신청했어요',
        consultStatus: 'new',
        relatedType: 'consult_request',
        relatedId: 'cr9',
        hospitalId: 'h1',
        recipientUserIds: [],
      },
      NOW,
    );

    expect(row.consultStatus).toBe('new');
    expect(row.relatedType).toBe('consult_request');
  });
});

describe('buildRecipientRows — 순수 변환', () => {
  const ids = (): (() => string) => {
    let n = 0;

    return () => `nr-${(n += 1)}`;
  };

  it('★ 같은 사용자가 두 번 들어와도 행은 하나다 (unique 제약 위반 방지)', () => {
    expect(buildRecipientRows('ntf-1', ['u1', 'u1', 'u2'], ids()).map((row) => row.userId)).toEqual([
      'u1',
      'u2',
    ]);
  });

  it('수신자 행은 모두 같은 알림을 가리키고 id 가 각자 다르다', () => {
    const rows = buildRecipientRows('ntf-1', ['u1', 'u2'], ids());

    expect(new Set(rows.map((row) => row.notificationId))).toEqual(new Set(['ntf-1']));
    expect(new Set(rows.map((row) => row.id)).size).toBe(2);
  });

  it('수신자가 0명이면 빈 배열이다', () => {
    expect(buildRecipientRows('ntf-1', [], ids())).toEqual([]);
  });
});

interface Recorded {
  notificationData: Record<string, unknown> | null;
  recipientRows: { id: string; notificationId: string; userId: string }[] | null;
  createManyCalls: number;
}

function stubTx(): { tx: Prisma.TransactionClient; recorded: Recorded } {
  const recorded: Recorded = { notificationData: null, recipientRows: null, createManyCalls: 0 };

  const tx = {
    notification: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        recorded.notificationData = args.data;

        return { id: String(args.data.id) };
      }),
    },
    notificationRecipient: {
      createMany: vi.fn(async (args: { data: Recorded['recipientRows'] }) => {
        recorded.recipientRows = args.data;
        recorded.createManyCalls += 1;

        return { count: args.data?.length ?? 0 };
      }),
    },
  } as unknown as Prisma.TransactionClient;

  return { tx, recorded };
}

describe('createNotificationWithRecipients', () => {
  it('알림 행과 수신자 행을 함께 만든다', async () => {
    const { tx, recorded } = stubTx();

    const id = await createNotificationWithRecipients(
      tx,
      {
        audience: 'admin',
        type: 'consult-status',
        title: '새로운 상담 신청',
        message: '박서영님이 상담을 신청했어요',
        consultStatus: 'new',
        relatedType: 'consult_request',
        relatedId: 'cr9',
        hospitalId: 'h1',
        recipientUserIds: ['u-admin-h1', 'u-admin-h1b'],
      },
      NOW,
    );

    expect(recorded.notificationData).toMatchObject({
      id,
      audience: 'admin',
      type: 'consult-status',
      consultStatus: 'new',
      relatedType: 'consult_request',
      relatedId: 'cr9',
      hospitalId: 'h1',
      createdAt: NOW,
    });
    expect(recorded.recipientRows?.map((row) => row.userId)).toEqual(['u-admin-h1', 'u-admin-h1b']);
    expect(new Set(recorded.recipientRows?.map((row) => row.notificationId))).toEqual(new Set([id]));
  });

  it('★ 수신자가 0명이면 알림만 남기고 createMany 를 부르지 않는다', async () => {
    const { tx, recorded } = stubTx();

    await createNotificationWithRecipients(
      tx,
      { audience: 'admin', type: 'system', title: 't', message: 'm', consultStatus: null, recipientUserIds: [] },
      NOW,
    );

    expect(recorded.notificationData).not.toBeNull();
    expect(recorded.createManyCalls).toBe(0);
  });

  it('id 는 알림과 수신자 각각 다른 값이다', async () => {
    const { tx, recorded } = stubTx();

    await createNotificationWithRecipients(
      tx,
      { audience: 'user', type: 'system', title: 't', message: 'm', consultStatus: null, recipientUserIds: ['u1'] },
      NOW,
    );

    expect(recorded.recipientRows?.[0]?.id).not.toBe(recorded.notificationData?.id);
  });
});

describe('findHospitalAdminUserIds', () => {
  it('그 병원 담당자의 userId 만 돌려준다', async () => {
    const tx = {
      hospitalAdmin: {
        findMany: vi.fn(async () => [{ userId: 'u-admin-h1' }, { userId: 'u-admin-h1b' }]),
      },
    } as unknown as Prisma.TransactionClient;

    expect(await findHospitalAdminUserIds(tx, 'h1')).toEqual(['u-admin-h1', 'u-admin-h1b']);
  });

  it('담당자가 없으면 빈 배열이다 — 호출자가 알림만 남길 수 있어야 한다', async () => {
    const tx = {
      hospitalAdmin: { findMany: vi.fn(async () => []) },
    } as unknown as Prisma.TransactionClient;

    expect(await findHospitalAdminUserIds(tx, 'h404')).toEqual([]);
  });
});
