import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminPendingPireps } from '@/components/admin/AdminPendingPireps';

export default function AdminPirepsPage() {
  return (
    <AdminLayout>
      <AdminPendingPireps />
    </AdminLayout>
  );
}
