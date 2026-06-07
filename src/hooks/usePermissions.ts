import { useAuth } from '../components/AuthProvider';
import {
  canApprove,
  canCreate,
  canDelete,
  canEdit,
  canExport,
  hasPermission,
  RbacAction,
  RbacModule,
} from '../rbac';

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role;
  const permissions = user?.effectivePermissions;

  return {
    role,
    hasPermission: (module: RbacModule, action: RbacAction) => hasPermission(role, module, action, permissions),
    canApprove: (module: RbacModule) => canApprove(role, module, permissions),
    canCreate: (module: RbacModule) => canCreate(role, module, permissions),
    canDelete: (module: RbacModule) => canDelete(role, module, permissions),
    canEdit: (module: RbacModule) => canEdit(role, module, permissions),
    canExport: (module: RbacModule) => canExport(role, module, permissions),
  };
}
