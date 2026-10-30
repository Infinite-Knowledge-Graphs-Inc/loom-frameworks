CREATE TABLE "reading_set" (
	"id" text PRIMARY KEY NOT NULL,
	"courseId" text,
	"userId" text NOT NULL,
	"scopeKey" text NOT NULL,
	"name" text NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reading_set_userId_courseId_scopeKey_unique" UNIQUE NULLS NOT DISTINCT("userId","courseId","scopeKey")
);
--> statement-breakpoint
ALTER TABLE "reading_set" ADD CONSTRAINT "reading_set_courseId_course_id_fk" FOREIGN KEY ("courseId") REFERENCES "public"."course"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_set" ADD CONSTRAINT "reading_set_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;