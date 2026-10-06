"use client";

import { useWatch, type UseFormReturn } from "react-hook-form";

export type PasswordValues = { password: string; confirm: string };
const INPUT = "mt-1.5 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 aria-[invalid=true]:border-rose-400 dark:border-white/15 dark:bg-background-dark-primary";

export default function PasswordFields({ form }: { form: UseFormReturn<PasswordValues> }) {
  const { register, getValues, formState: { errors } } = form;
  const [password, confirm] = useWatch({ control: form.control, name: ["password", "confirm"] });
  const lengthOk = password.length >= 8 && password.length <= 128 && password.trim().length > 0;
  const matches = Boolean(confirm) && password === confirm;
  return <>
    <div><label htmlFor="new-password" className="text-sm font-bold">비밀번호</label><input id="new-password" type="password" autoComplete="new-password" maxLength={128} aria-invalid={Boolean(errors.password)} aria-describedby="password-rules password-error" className={INPUT} {...register("password", { required: "비밀번호를 입력해주세요.", minLength: { value: 8, message: "8자 이상 입력해주세요." }, maxLength: { value: 128, message: "128자 이하로 입력해주세요." }, validate: value => Boolean(value.trim()) || "공백만으로 설정할 수 없습니다.", deps: ["confirm"] })} />{errors.password && <p id="password-error" role="alert" className="mt-1 text-xs text-rose-600">{errors.password.message}</p>}</div>
    <div><label htmlFor="confirm-password" className="text-sm font-bold">비밀번호 확인</label><input id="confirm-password" type="password" autoComplete="new-password" maxLength={128} aria-invalid={Boolean(errors.confirm)} aria-describedby="password-rules confirm-error" className={INPUT} {...register("confirm", { required: "비밀번호를 한 번 더 입력해주세요.", validate: value => value === getValues("password") || "비밀번호가 서로 다릅니다." })} />{errors.confirm && <p id="confirm-error" role="alert" className="mt-1 text-xs text-rose-600">{errors.confirm.message}</p>}</div>
    <ul id="password-rules" aria-live="polite" className="space-y-1 rounded-xl bg-slate-50 p-3 text-xs dark:bg-white/5">
      <li className={lengthOk ? "text-emerald-700 dark:text-emerald-300" : "text-text-secondary"}>{lengthOk ? "✓" : "○"} 8자 이상</li>
      <li className={matches ? "text-emerald-700 dark:text-emerald-300" : "text-text-secondary"}>{matches ? "✓" : "○"} 비밀번호 확인 일치</li>
    </ul>
  </>;
}
