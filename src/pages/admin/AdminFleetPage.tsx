import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminFleetManagement } from '@/components/admin/AdminFleetManagement';
import { AdminTypeRatings } from '@/components/admin/AdminTypeRatings';

export default function AdminFleetPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminFleetManagement />
        <AdminTypeRatings />
      </div>
    </AdminLayout>
  );
}
