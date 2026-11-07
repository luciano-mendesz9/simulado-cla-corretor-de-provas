CREATE TYPE "Role" AS ENUM ('COORDENACAO', 'PROFESSOR');
CREATE TYPE "UserStatus" AS ENUM ('ATIVO', 'INATIVO');
CREATE TABLE "User" (
  "id" UUID NOT NULL, "firstName" VARCHAR(80) NOT NULL, "lastName" VARCHAR(80) NOT NULL,
  "email" VARCHAR(160) NOT NULL, "passwordHash" TEXT NOT NULL, "role" "Role" NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'ATIVO', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Classroom" (
  "id" UUID NOT NULL, "name" VARCHAR(80) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Classroom_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Student" (
  "id" UUID NOT NULL, "firstName" VARCHAR(80) NOT NULL, "lastName" VARCHAR(80) NOT NULL,
  "classroomId" UUID NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Session" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "refreshHash" VARCHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3), "rotatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "LoginThrottle" (
  "key" VARCHAR(64) NOT NULL, "attempts" INTEGER NOT NULL DEFAULT 0,
  "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "LoginThrottle_pkey" PRIMARY KEY ("key")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_email_ci_key" ON "User"(lower("email"));
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");
CREATE UNIQUE INDEX "Classroom_name_key" ON "Classroom"("name");
CREATE UNIQUE INDEX "Classroom_name_ci_key" ON "Classroom"(lower("name"));
CREATE INDEX "Student_classroomId_lastName_firstName_idx" ON "Student"("classroomId", "lastName", "firstName");
CREATE UNIQUE INDEX "Session_refreshHash_key" ON "Session"("refreshHash");
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
ALTER TABLE "Student" ADD CONSTRAINT "Student_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
