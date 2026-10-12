import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

import {
  THIRD_PARTY_CONSENT_NOTICE_INTRO,
  thirdPartyConsentNoticeItems,
} from '@/features/consult/content/thirdPartyConsentNotice';
import { Modal } from '@/primitives';

interface ConsentNoticeDialogProps {
  visible: boolean;
  hospitalName: string;
  onClose: () => void;
}

/**
 * 개인정보 제3자 제공 **안내문**. 읽기 전용이다 — 여기서 동의할 수 없고, `확인` 은 닫기일 뿐이다.
 * 동의는 폼의 체크박스 한 곳에서만 일어난다 (두 곳에서 켜지면 "무엇을 눌러 동의했는가" 가 흐려진다).
 *
 * 문구와 버전은 `content/thirdPartyConsentNotice.ts` 한 곳에서 온다 — 화면에 띄운 문구와
 * 저장되는 `noticeVersion` 이 갈리면 동의 기록이 증빙이 되지 않는다.
 */
export function ConsentNoticeDialog({ visible, hospitalName, onClose }: ConsentNoticeDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // 열리면 닫기 버튼으로 포커스를 옮긴다. 옮기지 않으면 키보드 사용자는 뒤쪽 폼에 포커스를 둔 채
  // 떠 있는 안내문을 읽게 된다. 닫을 때의 포커스 복귀는 여는 쪽(`자세히` 버튼)이 맡는다.
  useEffect(() => {
    if (visible) closeButtonRef.current?.focus();
  }, [visible]);

  // 열려 있는 동안 뒤 배경이 스크롤되지 않게 한다 (모바일 바텀시트에서 특히 거슬린다).
  useEffect(() => {
    if (!visible) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previous;
    };
  }, [visible]);

  return (
    <Modal visible={visible} transparent onRequestClose={onClose}>
      {/* 딤 영역(이 div 자체)을 누르면 닫힌다 — 안쪽 카드에서 올라온 클릭은 `currentTarget`
          비교로 걸러낸다. 키보드 사용자에게는 Esc(Modal)·닫기·확인 버튼이 있으므로 이 div
          에는 역할을 주지 않는다. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        className="flex h-full w-full items-end justify-center bg-black/40 md:items-center md:p-6"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="consent-dialog-title"
          className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white md:rounded-2xl"
        >
          <div className="sticky top-0 flex items-center justify-between border-b border-neutral-100 bg-white px-4 py-3">
            <h2 id="consent-dialog-title" className="text-base font-bold text-neutral-900">
              개인정보 제3자 제공 동의
            </h2>
            <button type="button" ref={closeButtonRef} onClick={onClose} aria-label="닫기" className="p-1">
              <X size={20} className="text-neutral-700" aria-hidden="true" />
            </button>
          </div>
          <div className="px-4 py-4">
            <p className="mb-4 text-sm text-neutral-500">{THIRD_PARTY_CONSENT_NOTICE_INTRO}</p>
            <dl className="space-y-4">
              {thirdPartyConsentNoticeItems(hospitalName).map((item) => (
                <div key={item.term}>
                  <dt className="text-xs font-semibold text-neutral-500">{item.term}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-neutral-800">
                    {item.pending ? <span className="font-semibold text-amber-700">[확정 필요] </span> : null}
                    {item.description}
                  </dd>
                </div>
              ))}
            </dl>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-600 active:bg-neutral-50"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
