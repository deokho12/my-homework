import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import { Chip } from '@/components/Chip';
import {
  INQUIRY_CONTENT_MAX,
  INQUIRY_CONTENT_MIN,
  inquirySchema,
  type InquiryFormInput,
} from '@/features/inquiry/schemas/inquirySchema';
import { router } from '@/navigation';
import { INQUIRY_TOPICS, INQUIRY_TOPIC_LABEL, type Hospital } from '@/types/domain';

interface InquiryFormProps {
  hospital: Hospital;
  submitting: boolean;
  onSubmit: (values: InquiryFormInput) => void;
}

/**
 * 문의 작성 폼. **API 를 부르지 않는다** — 조회도 접수도 `pages/InquiryPage.tsx` 가 맡는다.
 *
 * 검사 규칙은 `inquirySchema` 하나이고, `문의 남기기` 버튼의 활성 여부도 그 스키마로
 * 판정한다 — 화면이 `주제를 골랐나 / 몇 자인가` 를 따로 적으면 판정이 두 곳으로 갈린다.
 */
export function InquiryForm({ hospital, submitting, onSubmit }: InquiryFormProps) {
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<InquiryFormInput>({
    resolver: zodResolver(inquirySchema),
    // 오류는 **칸을 벗어난 뒤에야** 보여준다 — 아직 다 쓰지도 않은 문장을 짧다고 말하지 않는다.
    mode: 'onTouched',
    defaultValues: {
      // 주제는 **기본 선택이 없다** (계약: 고르지 않으면 접수되지 않는다).
      topic: null as unknown as InquiryFormInput['topic'],
      content: '',
      // `다른 사람도 볼 수 있게 공개` — 기본 켜짐.
      isPublic: true,
    },
  });

  const values = useWatch({ control });
  const canSubmit = !submitting && inquirySchema.safeParse(values).success;
  const contentLength = values.content?.length ?? 0;
  const overLimit = contentLength > INQUIRY_CONTENT_MAX;

  return (
    <>
      <h1 className="text-xl font-extrabold text-neutral-900">{hospital.name}에 문의</h1>
      <p className="mt-0.5 mb-5 truncate text-sm text-neutral-500">
        {hospital.region} · {hospital.address}
      </p>

      <p className="mb-6 rounded-2xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm leading-relaxed text-neutral-600">
        연락처 없이 앱 안에서 답변을 받아요. 예약까지 원하시면{' '}
        <button
          type="button"
          className="font-semibold text-brand-700 underline"
          // `replace` 인 이유: 형제 폼 사이를 오갈 때 뒤로 가기가 왕복 이력에 갇히지 않게.
          onClick={() => router.replace(`/consult/${hospital.id}`)}
        >
          상담 신청
        </button>
        이 더 빨라요.
      </p>

      <form
        noValidate
        onSubmit={(event) => {
          void handleSubmit(onSubmit)(event);
        }}
      >
        <fieldset className="mb-6">
          <legend className="mb-2 text-sm font-semibold text-neutral-700">무엇이 궁금하세요?</legend>
          <div className="flex flex-row flex-wrap">
            {INQUIRY_TOPICS.map((topic) => (
              <Chip
                key={topic}
                label={INQUIRY_TOPIC_LABEL[topic]}
                selected={values.topic === topic}
                onPress={() => setValue('topic', topic, { shouldValidate: true })}
              />
            ))}
          </div>
        </fieldset>

        <div className="mb-6">
          <label htmlFor="inquiry-content" className="mb-2 block text-sm font-semibold text-neutral-700">
            내용
          </label>
          <textarea
            id="inquiry-content"
            rows={6}
            placeholder="예) 인레이 금과 세라믹 차이가 궁금해요"
            aria-invalid={errors.content ? true : undefined}
            aria-describedby="inquiry-content-count inquiry-content-error"
            className={`min-h-[140px] w-full resize-y rounded-xl border px-4 py-3 text-[15px] leading-relaxed outline-none focus:border-brand-600 ${
              errors.content ? 'border-rose-400' : 'border-neutral-200'
            }`}
            {...register('content')}
          />
          <div className="mt-1.5 flex items-start justify-between gap-3">
            <p id="inquiry-content-error" className="text-sm text-rose-500">
              {errors.content?.message}
            </p>
            <span
              id="inquiry-content-count"
              className={`shrink-0 text-xs ${overLimit ? 'text-rose-500' : 'text-neutral-400'}`}
            >
              {contentLength}/{INQUIRY_CONTENT_MAX}
            </span>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-neutral-200 px-4 py-3">
          <div className="flex items-start gap-2">
            <input
              id="inquiry-public"
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 accent-brand-600"
              aria-describedby="inquiry-public-desc"
              {...register('isPublic')}
            />
            <div className="min-w-0 flex-1">
              <label htmlFor="inquiry-public" className="block text-sm font-bold text-neutral-900">
                다른 사람도 볼 수 있게 공개
              </label>
              {/* 공개해도 **작성자 표기가 아예 없다** — 요청서의 `닉네임만 보임` 과 다르고,
                  이쪽이 결정이다 (`docs/api/README.md` §4). */}
              <p id="inquiry-public-desc" className="mt-1 text-sm leading-relaxed text-neutral-500">
                병원이 답변하고 공개에 동의하면 병원 상세의 &lsquo;문의&rsquo;에 질문과 답변이 남아요. 이름은
                보이지 않아요.
              </p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-3.5 text-base font-semibold text-white active:bg-brand-700 disabled:opacity-40"
        >
          {submitting ? '보내는 중' : '문의 남기기'}
        </button>
        {/* 주제 미선택은 빨간 오류로 말하지 않는다 — 아직 하지 않은 일을 틀렸다고 하지 않는다. */}
        {!canSubmit && !submitting ? (
          <p className="mt-2 text-center text-xs text-neutral-400">
            주제를 고르고 내용을 {INQUIRY_CONTENT_MIN}자 이상 적으면 보낼 수 있어요
          </p>
        ) : null}
      </form>
    </>
  );
}
