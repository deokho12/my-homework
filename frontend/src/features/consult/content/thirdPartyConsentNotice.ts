/**
 * 상담 신청 화면의 **개인정보 제3자 제공 안내문**.
 *
 * 화면에 띄우는 문구와 저장되는 동의 기록(`noticeVersion`)이 **같은 곳에서 나와야** 한다 —
 * 둘이 갈리면 "무엇에 동의했는가" 를 나중에 증명할 수 없다. 그래서 문구와 버전을
 * 이 파일 하나에 둔다 (`ConsultThirdPartyConsentInput.noticeVersion` 이 요구하는 값이다).
 *
 * TODO(legal): **문구 5개 전부 법무 검토 전이다.** 특히
 * - 4번 `보유·이용 기간` 은 회사가 기간을 확정하지 않아 `[확정 필요]` 가 사용자에게 그대로 보인다.
 *   출시 전에 반드시 실제 기간으로 교체하고 버전을 올린다.
 * - 안내문이 `GET /legal-documents/{slug}` 로 옮겨가면 이 상수는 사라지고
 *   버전 자리에 `LegalDocument.version` 이 들어온다. 그때까지는 프론트엔드 상수가 원본이다.
 */

/**
 * 안내문 개정일. **문구를 한 글자라도 고치면 이 값을 올린다** — 올리지 않으면 옛 동의와
 * 새 문구가 같은 버전으로 기록돼 둘을 구분할 수 없다.
 */
export const THIRD_PARTY_CONSENT_NOTICE_VERSION = '2026-10-12';

export interface ThirdPartyConsentNoticeItem {
  term: string;
  description: string;
  /** 아직 확정되지 않은 항목. 화면에 `[확정 필요]` 가 앞에 붙는다. */
  pending?: boolean;
}

/** 팝업 상단 안내 한 줄. */
export const THIRD_PARTY_CONSENT_NOTICE_INTRO = '아래 내용에 동의하시면 상담 신청을 접수할 수 있어요.';

/** 체크박스 옆 한 줄 설명. 어느 병원에 넘기는지를 이름으로 밝힌다. */
export function thirdPartyConsentSummary(hospitalName: string): string {
  return `상담 연락을 위해 이름과 연락처를 ${hospitalName}에 제공해요.`;
}

/** 팝업 본문. 제공받는 자가 병원마다 다르므로 병원 이름을 받는다. */
export function thirdPartyConsentNoticeItems(hospitalName: string): ThirdPartyConsentNoticeItem[] {
  return [
    { term: '제공받는 자', description: hospitalName },
    { term: '제공 목적', description: '상담 연락 및 예약 안내' },
    { term: '제공 항목', description: '이름, 연락처, 희망 시술, 희망 연락 시간, 남기고 싶은 말' },
    { term: '보유·이용 기간', description: '회사에서 보유 기간을 확정하는 대로 안내드릴게요.', pending: true },
    {
      term: '동의를 거부할 권리 및 거부 시 불이익',
      description: '동의를 거부할 수 있어요. 다만 이름과 연락처를 병원에 전달할 수 없어 상담 신청은 접수되지 않아요.',
    },
  ];
}
