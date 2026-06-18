// Prisma enum の代替（SQLite互換のため TS 定数 + String カラムで表現）
// ラベルは日本語UIにそのまま使用する。

export const UserRole = {
  ADMIN: "ADMIN",
  SALES: "SALES",
  ACCOUNTING: "ACCOUNTING",
  ENGINEER: "ENGINEER",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
export const UserRoleLabel: Record<string, string> = {
  ADMIN: "管理者",
  SALES: "営業",
  ACCOUNTING: "経理",
  ENGINEER: "エンジニア",
};

export const EmploymentType = {
  EMPLOYEE: "EMPLOYEE",
  CONTRACT: "CONTRACT",
  BP: "BP",
} as const;
export const EmploymentTypeLabel: Record<string, string> = {
  EMPLOYEE: "正社員",
  CONTRACT: "契約社員",
  BP: "協力会社(BP)",
};

export const EngineerStatus = {
  ASSIGNED: "ASSIGNED",
  AVAILABLE: "AVAILABLE",
  PARTIAL: "PARTIAL",
  LEAVING: "LEAVING",
  RETIRED: "RETIRED",
} as const;
export const EngineerStatusLabel: Record<string, string> = {
  ASSIGNED: "稼働中",
  AVAILABLE: "待機中",
  PARTIAL: "一部稼働",
  LEAVING: "退場予定",
  RETIRED: "退職",
};
export const EngineerStatusColor: Record<string, string> = {
  ASSIGNED: "bg-emerald-100 text-emerald-700",
  AVAILABLE: "bg-amber-100 text-amber-700",
  PARTIAL: "bg-sky-100 text-sky-700",
  LEAVING: "bg-orange-100 text-orange-700",
  RETIRED: "bg-gray-200 text-gray-600",
};

export const SkillCategory = {
  LANGUAGE: "LANGUAGE",
  FRAMEWORK: "FRAMEWORK",
  DB: "DB",
  INFRA: "INFRA",
  CLOUD: "CLOUD",
  ROLE: "ROLE",
  OTHER: "OTHER",
} as const;
export const SkillCategoryLabel: Record<string, string> = {
  LANGUAGE: "言語",
  FRAMEWORK: "FW",
  DB: "DB",
  INFRA: "インフラ",
  CLOUD: "クラウド",
  ROLE: "ロール",
  OTHER: "その他",
};

export const ClientType = {
  END: "END",
  PRIME: "PRIME",
  PARTNER: "PARTNER",
} as const;
export const ClientTypeLabel: Record<string, string> = {
  END: "エンド",
  PRIME: "元請",
  PARTNER: "協力会社",
};

export const ContractType = {
  QUASI_MANDATE: "QUASI_MANDATE",
  DISPATCH: "DISPATCH",
  CONTRACT: "CONTRACT",
} as const;
export const ContractTypeLabel: Record<string, string> = {
  QUASI_MANDATE: "準委任",
  DISPATCH: "派遣",
  CONTRACT: "請負",
};

export const ProjectStatus = {
  OPEN: "OPEN",
  PROPOSING: "PROPOSING",
  ONGOING: "ONGOING",
  CLOSED: "CLOSED",
  LOST: "LOST",
} as const;
export const ProjectStatusLabel: Record<string, string> = {
  OPEN: "募集中",
  PROPOSING: "提案中",
  ONGOING: "稼働中",
  CLOSED: "終了",
  LOST: "失注",
};
export const ProjectStatusColor: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700",
  PROPOSING: "bg-violet-100 text-violet-700",
  ONGOING: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-gray-200 text-gray-600",
  LOST: "bg-rose-100 text-rose-700",
};

export const AssignmentStatus = {
  PROPOSED: "PROPOSED",
  INTERVIEW: "INTERVIEW",
  ORDERED: "ORDERED",
  ACTIVE: "ACTIVE",
  ENDED: "ENDED",
  DECLINED: "DECLINED",
} as const;
export const AssignmentStatusLabel: Record<string, string> = {
  PROPOSED: "提案",
  INTERVIEW: "面談",
  ORDERED: "参画決定",
  ACTIVE: "稼働中",
  ENDED: "終了",
  DECLINED: "見送り",
};
export const AssignmentStatusColor: Record<string, string> = {
  PROPOSED: "bg-violet-100 text-violet-700",
  INTERVIEW: "bg-sky-100 text-sky-700",
  ORDERED: "bg-indigo-100 text-indigo-700",
  ACTIVE: "bg-emerald-100 text-emerald-700",
  ENDED: "bg-gray-200 text-gray-600",
  DECLINED: "bg-rose-100 text-rose-700",
};

export const ContractStatus = {
  DRAFT: "DRAFT",
  SENT: "SENT",
  SIGNED: "SIGNED",
  EXPIRED: "EXPIRED",
} as const;
export const ContractStatusLabel: Record<string, string> = {
  DRAFT: "作成中",
  SENT: "送付済",
  SIGNED: "締結済",
  EXPIRED: "終了",
};

// 契約単価の区分（月額 / 時給）
export const RateType = {
  MONTHLY: "MONTHLY",
  HOURLY: "HOURLY",
} as const;
export const RateTypeLabel: Record<string, string> = {
  MONTHLY: "月額",
  HOURLY: "時給",
};
export const RateTypeUnit: Record<string, string> = {
  MONTHLY: "／月",
  HOURLY: "／時間",
};

// 精算条件のタイプ
export const SettlementType = {
  RANGE: "RANGE",
  FIXED: "FIXED",
  BUSINESSDAY_BUFFER: "BUSINESSDAY_BUFFER",
} as const;
export const SettlementTypeLabel: Record<string, string> = {
  RANGE: "上限・下限方式",
  FIXED: "固定（精算なし/基準固定）",
  BUSINESSDAY_BUFFER: "営業日数×標準時間±バッファ方式",
};

// 控除・超過の精算方式
export const SettlementMethod = {
  MIDDLE: "MIDDLE",
  UPPER_LOWER: "UPPER_LOWER",
  MANUAL: "MANUAL",
  NONE: "NONE",
} as const;
export const SettlementMethodLabel: Record<string, string> = {
  MIDDLE: "中間割（控除・超過とも中央時間で算出）",
  UPPER_LOWER: "上下割（控除＝下限/超過＝上限で算出）",
  MANUAL: "個別指定（控除・超過単価を直接入力）",
  NONE: "精算なし",
};

export const TimesheetStatus = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
} as const;
export const TimesheetStatusLabel: Record<string, string> = {
  DRAFT: "下書き",
  SUBMITTED: "提出済",
  APPROVED: "承認済",
};

export const InvoiceStatus = {
  DRAFT: "DRAFT",
  ISSUED: "ISSUED",
  SENT: "SENT",
  PAID: "PAID",
  OVERDUE: "OVERDUE",
} as const;
export const InvoiceStatusLabel: Record<string, string> = {
  DRAFT: "下書き",
  ISSUED: "発行済",
  SENT: "送付済",
  PAID: "入金済",
  OVERDUE: "未入金(期限超過)",
};
export const InvoiceStatusColor: Record<string, string> = {
  DRAFT: "bg-gray-200 text-gray-600",
  ISSUED: "bg-blue-100 text-blue-700",
  SENT: "bg-sky-100 text-sky-700",
  PAID: "bg-emerald-100 text-emerald-700",
  OVERDUE: "bg-rose-100 text-rose-700",
};

export const RenewalIntent = {
  UNDECIDED: "UNDECIDED",
  EXTEND: "EXTEND",
  LEAVE: "LEAVE",
} as const;
export const RenewalIntentLabel: Record<string, string> = {
  UNDECIDED: "未回答",
  EXTEND: "延長希望",
  LEAVE: "離脱希望",
};
export const RenewalIntentColor: Record<string, string> = {
  UNDECIDED: "bg-gray-100 text-gray-500",
  EXTEND: "bg-emerald-100 text-emerald-700",
  LEAVE: "bg-orange-100 text-orange-700",
};

export const OfferStatus = {
  OFFERED: "OFFERED",
  PROCEED: "PROCEED",
  DECLINED: "DECLINED",
  WITHDRAWN: "WITHDRAWN",
} as const;
export const OfferStatusLabel: Record<string, string> = {
  OFFERED: "提案中",
  PROCEED: "進める",
  DECLINED: "辞退",
  WITHDRAWN: "取下げ",
};
export const OfferStatusColor: Record<string, string> = {
  OFFERED: "bg-blue-100 text-blue-700",
  PROCEED: "bg-emerald-100 text-emerald-700",
  DECLINED: "bg-rose-100 text-rose-700",
  WITHDRAWN: "bg-gray-200 text-gray-500",
};

export const WorkRole = {
  PG: "PG",
  SE: "SE",
  PL: "PL",
  PM: "PM",
  OTHER: "OTHER",
} as const;
export const WorkRoleLabel: Record<string, string> = {
  PG: "PG（プログラマ）",
  SE: "SE（システムエンジニア）",
  PL: "PL（プロジェクトリーダー）",
  PM: "PM（プロジェクトマネージャー）",
  OTHER: "その他",
};

// 担当工程（システム開発の標準工程）
export const PhaseType = {
  REQUIREMENT: "REQUIREMENT",
  BASIC_DESIGN: "BASIC_DESIGN",
  DETAIL_DESIGN: "DETAIL_DESIGN",
  IMPLEMENT: "IMPLEMENT",
  UNIT_TEST: "UNIT_TEST",
  INTEGRATION_TEST: "INTEGRATION_TEST",
  SYSTEM_TEST: "SYSTEM_TEST",
  MAINTENANCE: "MAINTENANCE",
} as const;
export const PhaseTypeLabel: Record<string, string> = {
  REQUIREMENT: "要件定義",
  BASIC_DESIGN: "基本設計",
  DETAIL_DESIGN: "詳細設計",
  IMPLEMENT: "製造",
  UNIT_TEST: "単体テスト",
  INTEGRATION_TEST: "結合テスト",
  SYSTEM_TEST: "総合テスト",
  MAINTENANCE: "運用保守",
};
export const PhaseTypeShort: Record<string, string> = {
  REQUIREMENT: "要件",
  BASIC_DESIGN: "基本",
  DETAIL_DESIGN: "詳細",
  IMPLEMENT: "製造",
  UNIT_TEST: "単体",
  INTEGRATION_TEST: "結合",
  SYSTEM_TEST: "総合",
  MAINTENANCE: "保守",
};

// 申請種別（ワークフロー）
export const RequestType = {
  TRANSPORT: "TRANSPORT",
  EXPENSE: "EXPENSE",
  PAID_LEAVE: "PAID_LEAVE",
  COMMUTER_PASS: "COMMUTER_PASS",
  SUMMER_LEAVE: "SUMMER_LEAVE",
  CONDOLENCE_LEAVE: "CONDOLENCE_LEAVE",
  HEALTH_CHECKUP: "HEALTH_CHECKUP",
} as const;
export type RequestType = (typeof RequestType)[keyof typeof RequestType];
export const RequestTypeLabel: Record<string, string> = {
  TRANSPORT: "交通費精算",
  EXPENSE: "経費精算",
  PAID_LEAVE: "有給休暇",
  COMMUTER_PASS: "定期券",
  SUMMER_LEAVE: "夏季休暇",
  CONDOLENCE_LEAVE: "慶弔休暇",
  HEALTH_CHECKUP: "健康診断",
};
export const RequestTypeIcon: Record<string, string> = {
  TRANSPORT: "🚃",
  EXPENSE: "🧾",
  PAID_LEAVE: "🏖️",
  COMMUTER_PASS: "🎫",
  SUMMER_LEAVE: "☀️",
  CONDOLENCE_LEAVE: "🎌",
  HEALTH_CHECKUP: "🩺",
};

// 申請ステータス
export const RequestStatus = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;
export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus];
export const RequestStatusLabel: Record<string, string> = {
  DRAFT: "下書き",
  SUBMITTED: "申請中",
  APPROVED: "承認",
  REJECTED: "差戻し",
  CANCELLED: "取消",
};
export const RequestStatusColor: Record<string, string> = {
  DRAFT: "bg-gray-200 text-gray-600",
  SUBMITTED: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-600",
  CANCELLED: "bg-gray-200 text-gray-500",
};

// 有給休暇の単位
export const LeaveUnit = {
  FULL: "FULL",
  HALF: "HALF",
  HOURLY: "HOURLY",
} as const;
export const LeaveUnitLabel: Record<string, string> = {
  FULL: "全休（1日）",
  HALF: "半休（0.5日）",
  HOURLY: "時間休",
};

export const ActivityType = {
  VISIT: "VISIT",
  CALL: "CALL",
  MAIL: "MAIL",
  PROPOSAL: "PROPOSAL",
  OTHER: "OTHER",
} as const;
export const ActivityTypeLabel: Record<string, string> = {
  VISIT: "訪問",
  CALL: "電話",
  MAIL: "メール",
  PROPOSAL: "提案",
  OTHER: "その他",
};
