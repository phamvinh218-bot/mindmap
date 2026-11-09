'use client';

import { useRouter } from 'next/navigation';
import { PasswordForm } from '@/components/PasswordForm';

export function ShareGate({ token, title }: { token: string; title: string }) {
  const router = useRouter();
  return (
    <PasswordForm
      title="Mindmap được chia sẻ"
      subtitle={`Nhập mật khẩu để mở «${title}»`}
      endpoint={`/api/s/${encodeURIComponent(token)}/login`}
      onSuccess={() => router.refresh()}
    />
  );
}
