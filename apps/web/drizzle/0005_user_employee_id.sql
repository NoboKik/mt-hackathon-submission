ALTER TABLE "users" ADD COLUMN "employee_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_employee_id_unique" UNIQUE("employee_id");