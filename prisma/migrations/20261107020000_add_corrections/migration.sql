-- CreateTable
CREATE TABLE "CorrectionBatch" (
    "id" UUID NOT NULL,
    "examId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "maxCards" INTEGER NOT NULL,
    "analysisRequests" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorrectionBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectionDraft" (
    "id" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "examId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "imageHash" VARCHAR(64) NOT NULL,
    "answerKeyHash" VARCHAR(64) NOT NULL,
    "layoutVersion" INTEGER NOT NULL,
    "readings" JSONB NOT NULL,
    "quality" JSONB NOT NULL,
    "manualChanges" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" UUID,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorrectionDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Correction" (
    "id" UUID NOT NULL,
    "examId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "sourceDraftId" UUID NOT NULL,
    "studentName" VARCHAR(170) NOT NULL,
    "className" VARCHAR(80) NOT NULL,
    "examName" VARCHAR(120) NOT NULL,
    "confirmedByName" VARCHAR(170) NOT NULL,
    "answerKeyHash" VARCHAR(64) NOT NULL,
    "total" INTEGER NOT NULL,
    "correct" INTEGER NOT NULL,
    "incorrect" INTEGER NOT NULL,
    "blank" INTEGER NOT NULL,
    "multiple" INTEGER NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "confirmedById" UUID NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Correction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectionAnswer" (
    "correctionId" UUID NOT NULL,
    "question" INTEGER NOT NULL,
    "selected" JSONB NOT NULL,
    "correct" VARCHAR(1) NOT NULL,
    "status" VARCHAR(24) NOT NULL,
    "score" INTEGER NOT NULL,
    "manual" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CorrectionAnswer_pkey" PRIMARY KEY ("correctionId","question")
);

-- CreateTable
CREATE TABLE "CorrectionEvent" (
    "id" UUID NOT NULL,
    "correctionId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "action" VARCHAR(32) NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorrectionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CorrectionBatch_createdById_expiresAt_idx" ON "CorrectionBatch"("createdById", "expiresAt");

-- CreateIndex
CREATE INDEX "CorrectionBatch_expiresAt_idx" ON "CorrectionBatch"("expiresAt");

-- CreateIndex
CREATE INDEX "CorrectionDraft_examId_studentId_idx" ON "CorrectionDraft"("examId", "studentId");

-- CreateIndex
CREATE INDEX "CorrectionDraft_expiresAt_idx" ON "CorrectionDraft"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CorrectionDraft_batchId_studentId_key" ON "CorrectionDraft"("batchId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Correction_sourceDraftId_key" ON "Correction"("sourceDraftId");

-- CreateIndex
CREATE INDEX "Correction_examId_correct_idx" ON "Correction"("examId", "correct");

-- CreateIndex
CREATE UNIQUE INDEX "Correction_examId_studentId_key" ON "Correction"("examId", "studentId");

-- CreateIndex
CREATE INDEX "CorrectionEvent_correctionId_createdAt_idx" ON "CorrectionEvent"("correctionId", "createdAt");

-- AddForeignKey
ALTER TABLE "CorrectionBatch" ADD CONSTRAINT "CorrectionBatch_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionBatch" ADD CONSTRAINT "CorrectionBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionDraft" ADD CONSTRAINT "CorrectionDraft_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "CorrectionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionDraft" ADD CONSTRAINT "CorrectionDraft_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionDraft" ADD CONSTRAINT "CorrectionDraft_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionDraft" ADD CONSTRAINT "CorrectionDraft_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correction" ADD CONSTRAINT "Correction_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correction" ADD CONSTRAINT "Correction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correction" ADD CONSTRAINT "Correction_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionAnswer" ADD CONSTRAINT "CorrectionAnswer_correctionId_fkey" FOREIGN KEY ("correctionId") REFERENCES "Correction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionEvent" ADD CONSTRAINT "CorrectionEvent_correctionId_fkey" FOREIGN KEY ("correctionId") REFERENCES "Correction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionEvent" ADD CONSTRAINT "CorrectionEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain constraints supplement the server-side validation.
ALTER TABLE "CorrectionBatch" ADD CONSTRAINT "CorrectionBatch_limits_check" CHECK ("maxCards" BETWEEN 1 AND 60 AND "analysisRequests" BETWEEN 0 AND 60);
ALTER TABLE "Correction" ADD CONSTRAINT "Correction_totals_check" CHECK ("total" BETWEEN 1 AND 40 AND "correct" >= 0 AND "incorrect" >= 0 AND "blank" >= 0 AND "multiple" >= 0 AND "correct" + "incorrect" + "blank" + "multiple" = "total" AND "percentage" BETWEEN 0 AND 100);
ALTER TABLE "CorrectionAnswer" ADD CONSTRAINT "CorrectionAnswer_values_check" CHECK ("question" BETWEEN 1 AND 40 AND "correct" IN ('A','B','C','D','E') AND "status" IN ('CORRETA','INCORRETA','EM_BRANCO','MULTIPLA_MARCACAO') AND "score" IN (0,1));
