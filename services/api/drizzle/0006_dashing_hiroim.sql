CREATE TABLE "drives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"kind" varchar(16) NOT NULL,
	"mount_path" varchar(255) NOT NULL,
	"quota_bytes" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drives_mount_path_unique" UNIQUE("mount_path")
);
--> statement-breakpoint
CREATE TABLE "mount_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drive_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"protocol" varchar(16) NOT NULL,
	"os_username" varchar(64) NOT NULL,
	"secret_ref" varchar(255) NOT NULL,
	"iqn" varchar(255),
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mount_credentials_drive_id_user_id_protocol_unique" UNIQUE("drive_id","user_id","protocol")
);
--> statement-breakpoint
CREATE TABLE "share_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drive_id" uuid NOT NULL,
	"grantee_user_id" uuid NOT NULL,
	"access_mode" varchar(16) NOT NULL,
	"granted_by_user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "share_grants_drive_id_grantee_user_id_access_mode_unique" UNIQUE("drive_id","grantee_user_id","access_mode")
);
--> statement-breakpoint
ALTER TABLE "drives" ADD CONSTRAINT "drives_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mount_credentials" ADD CONSTRAINT "mount_credentials_drive_id_drives_id_fk" FOREIGN KEY ("drive_id") REFERENCES "public"."drives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mount_credentials" ADD CONSTRAINT "mount_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_grants" ADD CONSTRAINT "share_grants_drive_id_drives_id_fk" FOREIGN KEY ("drive_id") REFERENCES "public"."drives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_grants" ADD CONSTRAINT "share_grants_grantee_user_id_users_id_fk" FOREIGN KEY ("grantee_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_grants" ADD CONSTRAINT "share_grants_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "drives_owner_id_index" ON "drives" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "drives_kind_index" ON "drives" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "mount_credentials_drive_id_index" ON "mount_credentials" USING btree ("drive_id");--> statement-breakpoint
CREATE INDEX "mount_credentials_user_id_index" ON "mount_credentials" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "share_grants_drive_id_index" ON "share_grants" USING btree ("drive_id");--> statement-breakpoint
CREATE INDEX "share_grants_grantee_user_id_index" ON "share_grants" USING btree ("grantee_user_id");