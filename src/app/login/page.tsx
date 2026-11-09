'use client';

import { useRouter } from 'next/navigation';
import { PasswordForm } from '@/components/PasswordForm';

export default function LoginPage() {
  const router = useRouter();
  return (
    <PasswordForm
      title="Mindmap"
      subtitle="Nhập mật khẩu để vào"
      endpoint="/api/auth/login"
      onSuccess={() => {
        router.replace('/');
        router.refresh();
      }}
    />
  );
}
