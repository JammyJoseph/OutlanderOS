-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "DealStage" AS ENUM ('NEW_BRIEF', 'PITCHING_FEEDBACK', 'APPROVAL', 'SIGN_OFF', 'IO_SIGNED_KICK_OFF', 'IN_PRODUCTION', 'LIVE', 'COMPLETED', 'PAID', 'LEAD', 'PITCHED', 'DEAL_SIGNED', 'CREATIVE_BRIEF', 'CREATIVE_REVIEW', 'CREATIVE_APPROVED', 'IO_SIGNED', 'CLEARED_FOR_PRODUCTION', 'NEGOTIATING', 'BRIEF_RECEIVED', 'CREATIVE_RESPONSE', 'CLIENT_REVIEW', 'CLIENT_APPROVED', 'CONTRACTED', 'BUDGET_SET');

-- CreateEnum
CREATE TYPE "CampaignType" AS ENUM ('SUPPLIED_ASSET', 'BESPOKE_PRODUCTION', 'WHITE_LABEL', 'EDITORIAL_FEATURE', 'PRINT_AD', 'PARTNERSHIP', 'ADVERTORIAL', 'EVENT', 'EDITORIAL');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('BRIEF_RECEIVED', 'BRIEF_RESPONDED', 'BOOKED', 'LIVE', 'DELIVERED', 'PAID', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProductionStatus" AS ENUM ('DRAFT', 'BRIEFED', 'PRE_PRODUCTION', 'SHOOTING', 'POST_PRODUCTION', 'DELIVERED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CallSheetStatus" AS ENUM ('DRAFT', 'SAVED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "avatarUrl" TEXT,
    "department" TEXT,
    "avatar" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "startDate" TIMESTAMP(3),
    "holidayAllowance" INTEGER NOT NULL DEFAULT 25,
    "salary" DOUBLE PRECISION,
    "teams" JSONB DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "hasSeenWelcome" BOOLEAN NOT NULL DEFAULT false,
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "googleAccessToken" TEXT,
    "googleRefreshToken" TEXT,
    "googleTokenExpiry" TIMESTAMP(3),
    "googleEmail" TEXT,
    "googleConnected" BOOLEAN NOT NULL DEFAULT false,
    "lastEmailScanAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "portal" TEXT,
    "link" TEXT,
    "assignedToId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "escalatedAt" TIMESTAMP(3),
    "escalationLevel" INTEGER NOT NULL DEFAULT 0,
    "staleFlaggedAt" TIMESTAMP(3),
    "taskType" TEXT NOT NULL DEFAULT 'ACTION',
    "completedAt" TIMESTAMP(3),
    "projectId" TEXT,
    "productionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HolidayRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ANNUAL',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HolidayRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "role" TEXT,
    "category" TEXT NOT NULL,
    "tags" TEXT[],
    "instagram" TEXT,
    "website" TEXT,
    "location" TEXT,
    "rating" INTEGER,
    "isFavourite" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "notes" TEXT,
    "portfolioLinks" JSONB NOT NULL DEFAULT '[]',
    "source" TEXT,
    "scanSource" TEXT,
    "confidence" TEXT,
    "followers" INTEGER,
    "profilePic" TEXT,
    "recentPosts" JSONB NOT NULL DEFAULT '[]',
    "collaborations" JSONB NOT NULL DEFAULT '[]',
    "scannedAt" TIMESTAMP(3),
    "printTier" INTEGER,
    "printTierAt" TIMESTAMP(3),
    "isRadar" BOOLEAN NOT NULL DEFAULT false,
    "radarStatus" TEXT,
    "radarLink" TEXT,
    "lastInteraction" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanCache" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'profile',
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScanCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "brandColor" TEXT,
    "xeroContactId" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "CampaignType" NOT NULL,
    "dealTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "workflowType" TEXT NOT NULL DEFAULT 'CREATIVE_BRIEF',
    "jobType" TEXT NOT NULL DEFAULT 'CREATIVE_BRIEF',
    "status" "CampaignStatus" NOT NULL DEFAULT 'BRIEF_RECEIVED',
    "stage" "DealStage" NOT NULL DEFAULT 'NEW_BRIEF',
    "stageUpdatedAt" TIMESTAMP(3),
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "budgetBreakdown" JSONB,
    "marginPercent" DOUBLE PRECISION,
    "marginAmount" DOUBLE PRECISION,
    "allocations" JSONB,
    "budgetLocked" BOOLEAN NOT NULL DEFAULT false,
    "budgetLockedAt" TIMESTAMP(3),
    "budgetLockedBy" TEXT,
    "assignedToId" TEXT,
    "value" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "margin" DOUBLE PRECISION,
    "timelineStart" TIMESTAMP(3),
    "timelineEnd" TIMESTAMP(3),
    "mediaPlan" JSONB,
    "mediaPlanVersion" INTEGER NOT NULL DEFAULT 1,
    "mediaPlanUpdatedAt" TIMESTAMP(3),
    "mediaPlanUpdatedBy" TEXT,
    "mediaPlanLockedAt" TIMESTAMP(3),
    "mediaPlanLink" TEXT,
    "mediaPlanFile" TEXT,
    "dealValue" DOUBLE PRECISION,
    "mediaSpend" DOUBLE PRECISION,
    "productionMarginPct" DOUBLE PRECISION,
    "ioUrl" TEXT,
    "ioSigned" BOOLEAN NOT NULL DEFAULT false,
    "ioSignedAt" TIMESTAMP(3),
    "briefContent" TEXT,
    "briefDueDate" TIMESTAMP(3),
    "briefStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "clientBrief" JSONB,
    "creativeResponse" JSONB,
    "clientFeedback" JSONB,
    "creativeStatus" TEXT,
    "isWhiteLabel" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedToProduction" TIMESTAMP(3),
    "paymentTerms" TEXT,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "archivedById" TEXT,
    "archivedByName" TEXT,
    "stageAtArchive" TEXT,
    "createdById" TEXT NOT NULL,
    "billingContactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeRound" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "title" TEXT,
    "brief" TEXT,
    "feedback" TEXT,
    "objectives" TEXT,
    "targetAudience" TEXT,
    "toneDirection" TEXT,
    "references" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deadline" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "deckUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealActivity" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "userId" TEXT,
    "userName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deliverable" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "title" TEXT,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "postedUrl" TEXT,
    "performance" JSONB,
    "isAdditional" BOOLEAN NOT NULL DEFAULT false,
    "overageCost" DOUBLE PRECISION,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "scheduleStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deliverable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignAsset" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignReport" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL,
    "sentToClient" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "CampaignReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsertionOrder" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "ioNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "advertiserName" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "clientOrAgency" TEXT NOT NULL DEFAULT 'CLIENT',
    "poNumber" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "lineItems" JSONB NOT NULL DEFAULT '[]',
    "totalNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "signedName" TEXT,
    "signedTitle" TEXT,
    "signedAt" TIMESTAMP(3),
    "signedFileUrl" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsertionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Production" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "trelloCardId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'EDITORIAL',
    "billingType" TEXT NOT NULL DEFAULT 'EDITORIAL',
    "campaignBudgetId" TEXT,
    "title" TEXT NOT NULL,
    "clientName" TEXT,
    "brief" TEXT,
    "description" TEXT,
    "figmaUrl" TEXT,
    "status" "ProductionStatus" NOT NULL DEFAULT 'DRAFT',
    "budgetTotal" DOUBLE PRECISION,
    "budgetActual" DOUBLE PRECISION,
    "marginTarget" DOUBLE PRECISION,
    "productionBudgetStatus" TEXT,
    "productionLockedAt" TIMESTAMP(3),
    "productionLockedBy" TEXT,
    "budgetMarkupPercent" DOUBLE PRECISION,
    "budgetVatPercent" DOUBLE PRECISION,
    "shootDates" TIMESTAMP(3)[],
    "editorialRateDiscount" DOUBLE PRECISION,
    "cateringQuotes" JSONB NOT NULL DEFAULT '[]',
    "briefData" JSONB,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "driveFolderId" TEXT,
    "leadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Production_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionShareLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLineItem" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "section" TEXT,
    "role" TEXT,
    "quantity" DOUBLE PRECISION,
    "rate" DOUBLE PRECISION,
    "vatPercent" DOUBLE PRECISION,
    "description" TEXT NOT NULL,
    "budgeted" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "invoiceStatus" TEXT,
    "invoiceUrl" TEXT,
    "poNumber" TEXT,
    "invoicedAmount" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionTask" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "owner" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'LOCKED',
    "dependsOn" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "unlockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionTeamMember" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "rate" DOUBLE PRECISION,
    "ratePer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUGGESTED',
    "notes" TEXT,
    "dietaryRequirements" TEXT,
    "contactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeAsset" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "approvalStatus" TEXT DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "driveFileId" TEXT,
    "driveThumbnail" TEXT,
    "uploadedByName" TEXT,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleBlock" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "shootDay" INTEGER NOT NULL DEFAULT 1,
    "time" TEXT NOT NULL,
    "activity" TEXT NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionDeliverable" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AWAITING',
    "dueDate" TIMESTAMP(3),
    "url" TEXT,
    "notes" TEXT,
    "resolution" TEXT,
    "aspectRatio" TEXT,
    "fileFormat" TEXT,
    "colourSpace" TEXT,
    "linkedShots" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionDeliverable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionMilestone" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'PRE_PRODUCTION',
    "date" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "isMilestone" BOOLEAN NOT NULL DEFAULT false,
    "templateKey" TEXT,
    "parentId" TEXT,
    "assignedTo" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallSheet" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "status" "CallSheetStatus" NOT NULL DEFAULT 'DRAFT',
    "shootTitle" TEXT,
    "shootDate" TIMESTAMP(3) NOT NULL,
    "callTime" TEXT NOT NULL DEFAULT '08:00',
    "unitCallTime" TEXT NOT NULL DEFAULT '',
    "wrapTime" TEXT,
    "location" JSONB NOT NULL,
    "locationLat" DOUBLE PRECISION,
    "locationLng" DOUBLE PRECISION,
    "schedule" JSONB NOT NULL,
    "shotlist" JSONB NOT NULL DEFAULT '[]',
    "locations" JSONB NOT NULL DEFAULT '[]',
    "shotStyle" JSONB NOT NULL DEFAULT '{}',
    "crew" JSONB NOT NULL,
    "talent" JSONB NOT NULL DEFAULT '[]',
    "cateringDetails" JSONB NOT NULL DEFAULT '{}',
    "documents" JSONB NOT NULL DEFAULT '[]',
    "weatherData" JSONB,
    "productionNotes" TEXT,
    "safetyNotes" TEXT,
    "parkingNotes" TEXT,
    "notes" TEXT,
    "shareToken" TEXT,
    "clientShareToken" TEXT,
    "header" JSONB NOT NULL DEFAULT '{}',
    "clientTeam" JSONB NOT NULL DEFAULT '[]',
    "agencyTeam" JSONB NOT NULL DEFAULT '[]',
    "productionCompany" JSONB NOT NULL DEFAULT '{}',
    "callTimes" JSONB NOT NULL DEFAULT '[]',
    "productionMobiles" JSONB NOT NULL DEFAULT '[]',
    "movementOrder" JSONB NOT NULL DEFAULT '{}',
    "equipment" JSONB NOT NULL DEFAULT '{}',
    "distributions" JSONB NOT NULL DEFAULT '[]',
    "distributedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallSheetPresence" (
    "id" TEXT NOT NULL,
    "callSheetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallSheetPresence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionExpense" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "receiptUrl" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionCrew" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "dayRate" DOUBLE PRECISION,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProductionCrew_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintIssue" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "printer" TEXT,
    "printDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrintIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintPage" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "clientId" TEXT,
    "assignedTo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "contentUrl" TEXT,

    CONSTRAINT "PrintPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintDistribution" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "warehouse" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "shippedAt" TIMESTAMP(3),
    "tracking" TEXT,

    CONSTRAINT "PrintDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MagazinePlan" (
    "id" TEXT NOT NULL,
    "issueNumber" INTEGER NOT NULL,
    "issueName" TEXT NOT NULL,
    "totalPages" INTEGER NOT NULL DEFAULT 8,
    "pages" JSONB NOT NULL DEFAULT '[]',
    "seedVersion" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "MagazinePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintBudgetLine" (
    "id" TEXT NOT NULL,
    "magazinePlanId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actual" DOUBLE PRECISION,
    "notes" TEXT,
    "productionId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrintBudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialPiece" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "writerId" TEXT,
    "editor" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pitch',
    "deadline" TIMESTAMP(3),
    "wordCount" INTEGER,
    "printPageId" TEXT,
    "publishedUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorialPiece_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialNote" (
    "id" TEXT NOT NULL,
    "pieceId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EditorialNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "venue" TEXT,
    "capacity" INTEGER,
    "rsvpCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "budget" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventGuest" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "contactId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "rsvpStatus" TEXT NOT NULL DEFAULT 'invited',
    "checkedIn" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EventGuest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncStatus" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "nextSyncAt" TIMESTAMP(3),
    "intervalMs" INTEGER NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'idle',
    "lastError" TEXT,
    "errorCount24h" INTEGER NOT NULL DEFAULT 0,
    "recordsSynced" INTEGER NOT NULL DEFAULT 0,
    "totalRuns" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "meta" JSONB,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceLog" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "campaignId" TEXT,
    "type" TEXT NOT NULL,
    "finding" TEXT NOT NULL,
    "action" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sources" TEXT[],
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntelligenceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateCardPlacement" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "rateType" TEXT NOT NULL DEFAULT 'Flat Fee',
    "measurement" TEXT NOT NULL DEFAULT 'Impressions',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateCardPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaPlan" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "clientName" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "flightStart" TIMESTAMP(3),
    "flightEnd" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "contactName" TEXT,
    "contactEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deadline" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "sourceRef" TEXT,
    "sourceUrl" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "category" TEXT,
    "assignedTo" TEXT,
    "createdBy" TEXT,
    "emailFrom" TEXT,
    "emailSnippet" TEXT,
    "threadId" TEXT,
    "startDate" TIMESTAMP(3),
    "linkedType" TEXT,
    "linkedId" TEXT,
    "rawData" JSONB,
    "completedAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "escalationLevel" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deadline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaPlanLineItem" (
    "id" TEXT NOT NULL,
    "mediaPlanId" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "placement" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rateType" TEXT NOT NULL DEFAULT 'Flat Fee',
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "units" INTEGER NOT NULL DEFAULT 1,
    "grossCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "projectedCreative" TEXT,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'planned',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MediaPlanLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstagramPost" (
    "id" TEXT NOT NULL,
    "igId" TEXT NOT NULL,
    "igAccountId" TEXT NOT NULL,
    "caption" TEXT,
    "mediaType" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "thumbnailUrl" TEXT,
    "permalink" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "reachCount" INTEGER NOT NULL DEFAULT 0,
    "savesCount" INTEGER NOT NULL DEFAULT 0,
    "sharesCount" INTEGER NOT NULL DEFAULT 0,
    "viewsCount" INTEGER NOT NULL DEFAULT 0,
    "engagementRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "brands" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "postType" TEXT NOT NULL DEFAULT 'UNCLASSIFIED',
    "campaignId" TEXT,
    "campaignName" TEXT,
    "notes" TEXT,
    "lastSynced" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrendSignal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "category" TEXT NOT NULL,
    "summary" TEXT,
    "sentiment" TEXT,
    "relevance" INTEGER NOT NULL DEFAULT 50,
    "trending" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "aiAnalysis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrendSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandWatch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "logoUrl" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "signalCount" INTEGER NOT NULL DEFAULT 0,
    "heatScore" INTEGER NOT NULL DEFAULT 50,
    "trajectory" TEXT NOT NULL DEFAULT 'stable',
    "lastChecked" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandWatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrendReport" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "period" TEXT,
    "brandId" TEXT,
    "generatedBy" TEXT NOT NULL DEFAULT 'ai',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrendReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "location" TEXT,
    "description" TEXT,
    "source" TEXT,
    "sourceUrl" TEXT,
    "importance" INTEGER NOT NULL DEFAULT 50,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CulturalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignBudget" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "trelloCardId" TEXT,
    "trelloCardName" TEXT,
    "clientName" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "totalBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "productionBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mediaBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "internalBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submittedBy" TEXT,
    "approvedBy" TEXT,
    "notes" TEXT,
    "productionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostEntry" (
    "id" TEXT NOT NULL,
    "campaignBudgetId" TEXT,
    "budgetLineItemId" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "vendor" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receipt" TEXT,
    "loggedBy" TEXT,
    "portal" TEXT,
    "status" TEXT NOT NULL DEFAULT 'LOGGED',
    "xeroMatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceSubmission" (
    "id" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "supplierEmail" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "description" TEXT,
    "emailSubject" TEXT,
    "emailMessageId" TEXT,
    "attachmentUrl" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentDeadline" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "campaignBudgetId" TEXT,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagNote" TEXT,
    "reviewedBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "xeroPaymentId" TEXT,
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");

-- CreateIndex
CREATE UNIQUE INDEX "ScanCache_handle_kind_key" ON "ScanCache"("handle", "kind");

-- CreateIndex
CREATE INDEX "CreativeRound_campaignId_idx" ON "CreativeRound"("campaignId");

-- CreateIndex
CREATE INDEX "DealActivity_campaignId_createdAt_idx" ON "DealActivity"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "DealActivity_createdAt_idx" ON "DealActivity"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InsertionOrder_ioNumber_key" ON "InsertionOrder"("ioNumber");

-- CreateIndex
CREATE INDEX "InsertionOrder_campaignId_idx" ON "InsertionOrder"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "Production_campaignId_key" ON "Production"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionShareLink_token_key" ON "ProductionShareLink"("token");

-- CreateIndex
CREATE UNIQUE INDEX "CallSheet_shareToken_key" ON "CallSheet"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "CallSheet_clientShareToken_key" ON "CallSheet"("clientShareToken");

-- CreateIndex
CREATE INDEX "CallSheetPresence_callSheetId_lastSeen_idx" ON "CallSheetPresence"("callSheetId", "lastSeen");

-- CreateIndex
CREATE UNIQUE INDEX "CallSheetPresence_callSheetId_userId_key" ON "CallSheetPresence"("callSheetId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MagazinePlan_issueNumber_key" ON "MagazinePlan"("issueNumber");

-- CreateIndex
CREATE INDEX "PrintBudgetLine_magazinePlanId_idx" ON "PrintBudgetLine"("magazinePlanId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncStatus_source_key" ON "SyncStatus"("source");

-- CreateIndex
CREATE INDEX "SyncLog_source_startedAt_idx" ON "SyncLog"("source", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RateCardPlacement_name_key" ON "RateCardPlacement"("name");

-- CreateIndex
CREATE INDEX "Deadline_dueDate_idx" ON "Deadline"("dueDate");

-- CreateIndex
CREATE INDEX "Deadline_status_idx" ON "Deadline"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Deadline_source_sourceRef_key" ON "Deadline"("source", "sourceRef");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramPost_igId_key" ON "InstagramPost"("igId");

-- CreateIndex
CREATE INDEX "InstagramPost_igAccountId_idx" ON "InstagramPost"("igAccountId");

-- CreateIndex
CREATE INDEX "InstagramPost_timestamp_idx" ON "InstagramPost"("timestamp");

-- CreateIndex
CREATE INDEX "InstagramPost_postType_idx" ON "InstagramPost"("postType");

-- CreateIndex
CREATE INDEX "TrendSignal_category_idx" ON "TrendSignal"("category");

-- CreateIndex
CREATE INDEX "TrendSignal_source_idx" ON "TrendSignal"("source");

-- CreateIndex
CREATE INDEX "TrendSignal_createdAt_idx" ON "TrendSignal"("createdAt");

-- CreateIndex
CREATE INDEX "TrendReport_type_idx" ON "TrendReport"("type");

-- CreateIndex
CREATE INDEX "TrendReport_createdAt_idx" ON "TrendReport"("createdAt");

-- CreateIndex
CREATE INDEX "CampaignBudget_status_idx" ON "CampaignBudget"("status");

-- CreateIndex
CREATE INDEX "CampaignBudget_trelloCardId_idx" ON "CampaignBudget"("trelloCardId");

-- CreateIndex
CREATE INDEX "CampaignBudget_productionId_idx" ON "CampaignBudget"("productionId");

-- CreateIndex
CREATE INDEX "CampaignBudget_campaignId_idx" ON "CampaignBudget"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CostEntry_budgetLineItemId_key" ON "CostEntry"("budgetLineItemId");

-- CreateIndex
CREATE INDEX "CostEntry_campaignBudgetId_idx" ON "CostEntry"("campaignBudgetId");

-- CreateIndex
CREATE INDEX "CostEntry_category_idx" ON "CostEntry"("category");

-- CreateIndex
CREATE INDEX "CostEntry_portal_idx" ON "CostEntry"("portal");

-- CreateIndex
CREATE INDEX "CostEntry_status_idx" ON "CostEntry"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceSubmission_emailMessageId_key" ON "InvoiceSubmission"("emailMessageId");

-- CreateIndex
CREATE INDEX "InvoiceSubmission_status_idx" ON "InvoiceSubmission"("status");

-- CreateIndex
CREATE INDEX "InvoiceSubmission_paymentDeadline_idx" ON "InvoiceSubmission"("paymentDeadline");

-- CreateIndex
CREATE INDEX "InvoiceSubmission_campaignBudgetId_idx" ON "InvoiceSubmission"("campaignBudgetId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayRequest" ADD CONSTRAINT "HolidayRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_billingContactId_fkey" FOREIGN KEY ("billingContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeRound" ADD CONSTRAINT "CreativeRound_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealActivity" ADD CONSTRAINT "DealActivity_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignAsset" ADD CONSTRAINT "CampaignAsset_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignReport" ADD CONSTRAINT "CampaignReport_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsertionOrder" ADD CONSTRAINT "InsertionOrder_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Production" ADD CONSTRAINT "Production_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Production" ADD CONSTRAINT "Production_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionShareLink" ADD CONSTRAINT "ProductionShareLink_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLineItem" ADD CONSTRAINT "BudgetLineItem_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTask" ADD CONSTRAINT "ProductionTask_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTeamMember" ADD CONSTRAINT "ProductionTeamMember_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeAsset" ADD CONSTRAINT "CreativeAsset_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleBlock" ADD CONSTRAINT "ScheduleBlock_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionDeliverable" ADD CONSTRAINT "ProductionDeliverable_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMilestone" ADD CONSTRAINT "ProductionMilestone_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMilestone" ADD CONSTRAINT "ProductionMilestone_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProductionMilestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMilestone" ADD CONSTRAINT "ProductionMilestone_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSheet" ADD CONSTRAINT "CallSheet_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSheetPresence" ADD CONSTRAINT "CallSheetPresence_callSheetId_fkey" FOREIGN KEY ("callSheetId") REFERENCES "CallSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionExpense" ADD CONSTRAINT "ProductionExpense_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionCrew" ADD CONSTRAINT "ProductionCrew_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionCrew" ADD CONSTRAINT "ProductionCrew_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintPage" ADD CONSTRAINT "PrintPage_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "PrintIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintPage" ADD CONSTRAINT "PrintPage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintDistribution" ADD CONSTRAINT "PrintDistribution_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "PrintIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintBudgetLine" ADD CONSTRAINT "PrintBudgetLine_magazinePlanId_fkey" FOREIGN KEY ("magazinePlanId") REFERENCES "MagazinePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintBudgetLine" ADD CONSTRAINT "PrintBudgetLine_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialPiece" ADD CONSTRAINT "EditorialPiece_writerId_fkey" FOREIGN KEY ("writerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialNote" ADD CONSTRAINT "EditorialNote_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "EditorialPiece"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGuest" ADD CONSTRAINT "EventGuest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGuest" ADD CONSTRAINT "EventGuest_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceLog" ADD CONSTRAINT "IntelligenceLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaPlan" ADD CONSTRAINT "MediaPlan_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deadline" ADD CONSTRAINT "Deadline_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaPlanLineItem" ADD CONSTRAINT "MediaPlanLineItem_mediaPlanId_fkey" FOREIGN KEY ("mediaPlanId") REFERENCES "MediaPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

