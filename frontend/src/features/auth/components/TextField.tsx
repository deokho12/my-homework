import { forwardRef, type InputHTMLAttributes } from 'react';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'id'> {
  id: string;
  label: string;
  /** 있으면 입력 칸 아래에 빨간 글씨로 표시하고 `aria-invalid` 를 붙인다. */
  error?: string;
}

/**
 * 라벨 + 입력 + **필드별 오류**를 한 묶음으로 렌더한다.
 *
 * `primitives` 의 `TextInput` 대신 평범한 `<input>` 을 쓴다 (AGENTS.md — 새 화면은
 * primitives 를 쓰지 않아도 된다). 이유는 두 가지다:
 *
 * 1. `TextInput` 은 `value`/`onChangeText` 전용이라 react-hook-form 의 `register()`
 *    (`name`/`onBlur`/`ref`)를 받을 수 없다.
 * 2. 지금 로그인·회원가입 화면에는 `<label>` 이 아예 없다. 스크린 리더가 어느 칸인지
 *    읽어 줄 수 없고, `aria-describedby` 로 오류를 연결할 수도 없다.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { id, label, error, ...inputProps },
  ref
) {
  const errorId = `${id}-error`;

  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-neutral-700">
        {label}
      </label>
      <input
        {...inputProps}
        id={id}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`w-full rounded-xl border px-4 py-3 text-[15px] outline-none focus:border-brand-600 ${
          error ? 'border-rose-400' : 'border-neutral-200'
        }`}
      />
      {error ? (
        <p id={errorId} className="mt-1.5 text-sm text-rose-500">
          {error}
        </p>
      ) : null}
    </div>
  );
});
