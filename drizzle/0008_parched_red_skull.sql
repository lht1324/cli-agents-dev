-- dev 테스트 데이터 정리: 구 PK(seq 기반) 행은 message id가 없어 이관 불가. 전부 테스트분이므로 삭제 후 재생성.
DELETE FROM "cloud_messages";--> statement-breakpoint
ALTER TABLE "cloud_messages" DROP CONSTRAINT "cloud_messages_tab_id_seq_pk";--> statement-breakpoint
ALTER TABLE "cloud_messages" ADD COLUMN "message_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "cloud_messages" ADD CONSTRAINT "cloud_messages_tab_id_message_id_pk" PRIMARY KEY("tab_id","message_id");
