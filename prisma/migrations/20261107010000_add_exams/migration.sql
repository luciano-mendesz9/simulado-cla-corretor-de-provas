CREATE TABLE "Exam" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "classroomId" UUID NOT NULL,
    "questions" INTEGER NOT NULL,
    "applicationDate" DATE NOT NULL,
    "correctionOpensAt" DATE NOT NULL,
    "correctionClosesAt" DATE NOT NULL,
    "answerKey" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Exam_questions_check" CHECK ("questions" BETWEEN 1 AND 100),
    CONSTRAINT "Exam_dates_check" CHECK ("applicationDate" <= "correctionOpensAt" AND "correctionOpensAt" <= "correctionClosesAt")
);
CREATE INDEX "Exam_classroomId_applicationDate_idx" ON "Exam"("classroomId", "applicationDate");
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
