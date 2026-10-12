import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { TextField } from '@/components/TextField';
import { Chip } from '@/components/Chip';
import { ConsentNoticeDialog } from '@/features/consult/components/ConsentNoticeDialog';
import { thirdPartyConsentSummary } from '@/features/consult/content/thirdPartyConsentNotice';
import {
  consultRequestSchema,
  type ConsultRequestFormInput,
} from '@/features/consult/schemas/consultRequestSchema';
import { CONSULT_PREFERRED_TIMES, type Hospital, type ProcedureId } from '@/types/domain';

/** 시술 칩 하나. 라벨은 `{대분류} · {세부시술}` 로 호출부가 미리 만들어 넘긴다. */
export interface ProcedureChoice {
  id: ProcedureId;
  label: string;
}

interface ConsultRequestFormProps {
  hospital: Hospital;
  procedureChoices: ProcedureChoice[];
  /** 로그인한 계정의 이름. 비어 있으면 자동 채움 없음. */
  autofillName: string;
  /** 내 지난 신청의 연락처. 비동기라 늦게 도착할 수 있다. 비어 있으면 자동 채움 없음. */
  autofillPhone: string;
  submitting: boolean;
  onSubmit: (values: ConsultRequestFormInput) => void;
}

const NAME_HINT = '계정 정보에서 자동으로 채웠어요';
const PHONE_HINT = '지난 상담 신청에 쓴 번호예요';

/**
 * 상담 신청 폼. **API 를 부르지 않는다** — 자동 채움 값도 제출도 전부 props 로 오간다
 * (조회·접수는 `pages/ConsultRequestPage.tsx` 가 맡는다).
 *
 * 검사 규칙은 `consultRequestSchema` 하나다. `상담 신청하기` 버튼의 활성 여부도 그 스키마로
 * 판정한다 — 화면이 `이름이 비었나 / 번호가 맞나` 를 따로 적으면 같은 판정이 두 곳으로 갈린다.
 */
export function ConsultRequestForm({
  hospital,
  procedureChoices,
  autofillName,
  autofillPhone,
  submitting,
  onSubmit,
}: ConsultRequestFormProps) {
  const {
    control,
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, dirtyFields, touchedFields },
  } = useForm<ConsultRequestFormInput>({
    resolver: zodResolver(consultRequestSchema),
    // 오류는 **칸을 벗어난 뒤에야** 보여주고, 그 뒤로는 입력마다 다시 본다 — 아직 다 쓰지도
    // 않은 번호를 틀렸다고 말하지 않기 위해서다.
    mode: 'onTouched',
    defaultValues: {
      name: '',
      phone: '',
      procedureId: null,
      preferredTime: CONSULT_PREFERRED_TIMES[0],
      message: '',
      // 동의는 화면에 들어올 때마다 새로 받는다 (요청서: 신청할 때마다).
      thirdPartyConsent: false,
    },
  });

  /**
   * 자동 채움은 **칸이 비어 있고 사용자가 손대지 않았을 때만** 한 번. 연락처는 지난 신청
   * 조회가 끝나야 와서 첫 렌더 뒤에 도착한다 — 그 사이 사용자가 입력했다면 덮어쓰지 않는다.
   *
   * `shouldValidate` 를 **이미 한 번 벗어난 칸에만** 켜는 이유: 빈 칸을 지나쳐(blur) `연락처를
   * 입력해주세요` 를 본 뒤에 값이 도착하면, 다시 판정하지 않는 한 채워진 번호 위에 그 오류가
   * 그대로 남는다. 반대로 아직 손대지 않은 칸을 검사하면 "blur 이후에만 오류" 규칙이 깨진다.
   */
  useEffect(() => {
    if (autofillName === '' || dirtyFields.name || getValues('name') !== '') return;

    setValue('name', autofillName, { shouldValidate: touchedFields.name === true });
  }, [autofillName, dirtyFields.name, touchedFields.name, getValues, setValue]);

  useEffect(() => {
    if (autofillPhone === '' || dirtyFields.phone || getValues('phone') !== '') return;

    setValue('phone', autofillPhone, { shouldValidate: touchedFields.phone === true });
  }, [autofillPhone, dirtyFields.phone, touchedFields.phone, getValues, setValue]);

  const values = useWatch({ control });
  const canSubmit = !submitting && consultRequestSchema.safeParse(values).success;

  const [consentOpen, setConsentOpen] = useState(false);
  const detailButtonRef = useRef<HTMLButtonElement>(null);

  const closeConsentNotice = () => {
    setConsentOpen(false);
    // 포커스를 연 자리로 돌려준다. 그러지 않으면 키보드 사용자는 문서 맨 앞으로 떨어진다.
    detailButtonRef.current?.focus();
  };

  return (
    <>
      <div className="mb-6 rounded-2xl border border-neutral-100 bg-neutral-50 px-4 py-3">
        <p className="text-base font-bold text-neutral-900">{hospital.name}</p>
        <p className="mt-0.5 truncate text-sm text-neutral-500">
          {hospital.region} · {hospital.address}
        </p>
      </div>

      <form
        noValidate
        onSubmit={(event) => {
          void handleSubmit(onSubmit)(event);
        }}
      >
        <fieldset className="mb-6">
          <legend className="mb-2 text-sm font-semibold text-neutral-700">
            어떤 시술을 상담받고 싶으세요?
          </legend>
          <div className="flex flex-row flex-wrap">
            {procedureChoices.map((choice) => (
              <Chip
                key={choice.id}
                label={choice.label}
                selected={values.procedureId === choice.id}
                onPress={() => setValue('procedureId', choice.id)}
              />
            ))}
            {/* 항상 마지막이고 기본 선택이다. 고르지 않은 채 신청하는 것이 정상 경로다. */}
            <Chip
              label="잘 모르겠어요"
              selected={values.procedureId === null}
              onPress={() => setValue('procedureId', null)}
            />
          </div>
        </fieldset>

        <fieldset className="mb-6">
          <legend className="mb-2 text-sm font-semibold text-neutral-700">언제 연락받기 편하세요?</legend>
          <div className="grid grid-cols-2 gap-2">
            {CONSULT_PREFERRED_TIMES.map((slot) => (
              <button
                key={slot}
                type="button"
                aria-pressed={values.preferredTime === slot}
                onClick={() => setValue('preferredTime', slot)}
                className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                  values.preferredTime === slot
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-neutral-200 bg-white text-neutral-600'
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
        </fieldset>

        <TextField
          id="consult-name"
          label="이름"
          autoComplete="name"
          placeholder="이름을 입력해주세요"
          error={errors.name?.message}
          // 힌트는 **값이 자동으로 채운 값과 아직 같을 때만**. 한 글자라도 고치면 사라진다.
          hint={autofillName !== '' && values.name === autofillName ? NAME_HINT : undefined}
          {...register('name')}
        />

        <TextField
          id="consult-phone"
          label="연락처"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={13}
          placeholder="010-0000-0000"
          error={errors.phone?.message}
          hint={autofillPhone !== '' && values.phone === autofillPhone ? PHONE_HINT : undefined}
          {...register('phone')}
        />

        <div className="mb-6">
          <label htmlFor="consult-message" className="mb-2 block text-sm font-semibold text-neutral-700">
            남기고 싶은 말 (선택)
          </label>
          <textarea
            id="consult-message"
            rows={4}
            placeholder="궁금한 점이나 요청사항을 적어주세요"
            className="min-h-[96px] w-full resize-y rounded-xl border border-neutral-200 px-4 py-3 text-[15px] outline-none focus:border-brand-600"
            {...register('message')}
          />
        </div>

        <div className="mb-6 rounded-xl border border-neutral-200 px-4 py-3">
          <div className="flex items-start gap-2">
            <input
              id="consult-consent"
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 accent-brand-600"
              aria-describedby="consult-consent-desc"
              {...register('thirdPartyConsent')}
            />
            <div className="min-w-0 flex-1">
              <label htmlFor="consult-consent" className="block text-sm font-bold text-neutral-900">
                [필수] 개인정보 제3자 제공 동의
              </label>
              <p id="consult-consent-desc" className="mt-1 text-sm leading-relaxed text-neutral-500">
                {thirdPartyConsentSummary(hospital.name)}
              </p>
              {/* 미체크는 오류 문구 없이 버튼 비활성으로만 말한다 — 아직 하지 않은 일을
                  틀렸다고 말하지 않는다. */}
              <button
                type="button"
                ref={detailButtonRef}
                onClick={() => setConsentOpen(true)}
                className="mt-1.5 inline-block text-xs font-semibold text-brand-700 underline"
              >
                자세히
              </button>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-3.5 text-base font-semibold text-white active:bg-brand-700 disabled:opacity-40"
        >
          {submitting ? '신청 중' : '상담 신청하기'}
        </button>
        {!canSubmit && !submitting ? (
          <p className="mt-2 text-center text-xs text-neutral-400">
            이름 · 연락처 · 동의를 모두 채우면 신청할 수 있어요
          </p>
        ) : null}
      </form>

      <ConsentNoticeDialog visible={consentOpen} hospitalName={hospital.name} onClose={closeConsentNotice} />
    </>
  );
}
