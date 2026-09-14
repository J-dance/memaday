ALTER TABLE "reactions" DROP CONSTRAINT "reactions_selection_id_user_id_emoji_pk";--> statement-breakpoint
ALTER TABLE "reactions" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "reactions" ADD COLUMN "nonce" text NOT NULL;--> statement-breakpoint
ALTER TABLE "reactions" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;