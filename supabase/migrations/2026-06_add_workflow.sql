-- 申請ワークフロー機能のテーブル追加（WorkflowRequest / WorkflowRequestItem）
-- Supabase の SQL Editor に貼り付けて Run してください。1回だけ実行。既存データは変更されません。

BEGIN;

CREATE TABLE "WorkflowRequest" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "engineerId" TEXT NOT NULL,
    "submittedByName" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "leaveUnit" TEXT,
    "hours" DOUBLE PRECISION,
    "days" DOUBLE PRECISION,
    "amount" INTEGER,
    "passPeriodMonths" INTEGER,
    "category" TEXT,
    "reason" TEXT,
    "approverName" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkflowRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowRequestItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "itemDate" TIMESTAMP(3),
    "fromPlace" TEXT,
    "toPlace" TEXT,
    "roundTrip" BOOLEAN NOT NULL DEFAULT false,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "WorkflowRequestItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WorkflowRequest" ADD CONSTRAINT "WorkflowRequest_engineerId_fkey" FOREIGN KEY ("engineerId") REFERENCES "Engineer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowRequestItem" ADD CONSTRAINT "WorkflowRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "WorkflowRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
