export { RequireAuth, type RequireAuthProps } from '@/features/auth/components/RequireAuth';
export { SessionWatcher } from '@/features/auth/components/SessionWatcher';
export { useSession, type Session } from '@/features/auth/hooks/useSession';
export {
  loginSchema,
  signupSchema,
  type LoginInput,
  type SignupInput,
} from '@/features/auth/schemas/authSchemas';
