import { FirebaseTimestamp } from './index';

export interface AdvancedSearchParams {
  searchType: 'all' | 'userName' | 'realName' | 'email' | 'school';
  searchTerm: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
  levelRange?: {
    min: number;
    max: number;
  };
  experienceRange?: {
    min: number;
    max: number;
  };
  regions?: {
    sido?: string;
    sigungu?: string;
  };
  hasWarnings?: boolean;
  isActive?: boolean;
}

export interface EnhancedAdminUserListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  searchType?: 'all' | 'userName' | 'realName' | 'email' | 'school';
  role?: 'all' | 'admin' | 'user';
  status?: 'all' | 'active' | 'inactive' | 'suspended';
  sortBy?: 'createdAt' | 'lastActiveAt' | 'totalExperience' | 'userName';
  sortOrder?: 'asc' | 'desc';
  dateRange?: {
    from: Date;
    to: Date;
  };
  levelRange?: {
    min: number;
    max: number;
  };
  experienceRange?: {
    min: number;
    max: number;
  };
  regions?: {
    sido?: string;
    sigungu?: string;
  };
  hasWarnings?: boolean;
}

export interface SuspensionSettings {
  type: 'temporary' | 'permanent';
  duration?: number; // 일 단위
  reason: string;
  autoRestore: boolean;
  notifyUser: boolean;
  suspendedUntil?: Date;
}

export interface AdminActionLog {
  id: string;
  adminId: string;
  adminName: string;
  action: 'role_change' | 'status_change' | 'delete_user' | 'add_warning' | 'update_experience' | 'bulk_update';
  targetUserId?: string;
  targetUserName?: string;
  targetUserIds?: string[]; // 대량 작업용
  oldValue?: string | number | boolean | object | null;
  newValue?: string | number | boolean | object | null;
  reason?: string;
  timestamp: FirebaseTimestamp;
  ipAddress?: string;
  userAgent?: string;
}

export interface ExportOptions {
  format: 'csv' | 'excel';
  fields: string[];
  filters: EnhancedAdminUserListParams;
  includeStats: boolean;
  includeSensitiveData: boolean;
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: EnhancedAdminUserListParams;
  isDefault: boolean;
  createdBy: string;
  createdAt: FirebaseTimestamp;
} 