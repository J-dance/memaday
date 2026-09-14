ALTER TABLE "public"."photos" ALTER COLUMN "state" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "public"."photos" ALTER COLUMN "state" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."photo_state";--> statement-breakpoint
CREATE TYPE "public"."photo_state" AS ENUM('pending', 'ready', 'shown');--> statement-breakpoint
ALTER TABLE "public"."photos" ALTER COLUMN "state" SET DATA TYPE "public"."photo_state" USING "state"::"public"."photo_state";--> statement-breakpoint
ALTER TABLE "public"."photos" ALTER COLUMN "state" SET DEFAULT 'pending';
