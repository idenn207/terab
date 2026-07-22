-- 방어 확인: partial unique index 는 (drive_id,user_id,protocol) active 중복이 있으면 생성 실패한다.
-- 기존 unique 제약 때문에 결과가 나올 수 없지만, 무증상 실패보다 명시적 확인이 낫다:
--   SELECT drive_id, user_id, protocol, count(*) FROM mount_credentials
--   WHERE revoked_at IS NULL GROUP BY 1,2,3 HAVING count(*) > 1;
ALTER TABLE "mount_credentials" DROP CONSTRAINT "mount_credentials_drive_id_user_id_protocol_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "mount_credentials_active_unique" ON "mount_credentials" USING btree ("drive_id","user_id","protocol") WHERE "mount_credentials"."revoked_at" IS NULL;