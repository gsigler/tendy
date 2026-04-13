CREATE TABLE "oauth_clients" (
	"client_id" varchar(255) PRIMARY KEY NOT NULL,
	"client_secret" varchar(255),
	"client_id_issued_at" integer NOT NULL,
	"client_secret_expires_at" integer,
	"redirect_uris" jsonb NOT NULL,
	"client_name" varchar(255),
	"token_endpoint_auth_method" varchar(50),
	"grant_types" jsonb,
	"response_types" jsonb,
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_codes" (
	"code" varchar(255) PRIMARY KEY NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"user_id" uuid NOT NULL,
	"code_challenge" varchar(255) NOT NULL,
	"redirect_uri" text NOT NULL,
	"scope" text,
	"resource" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_tokens" (
	"token" varchar(512) PRIMARY KEY NOT NULL,
	"token_type" varchar(20) NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"user_id" uuid NOT NULL,
	"scope" text,
	"resource" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "oauth_codes" ADD CONSTRAINT "oauth_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
