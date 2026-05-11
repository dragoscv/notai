-- Push subscription table now stores both web push (VAPID) and native
-- mobile push (FCM tokens). VAPID-specific columns become nullable so
-- FCM rows can omit them. A composite unique on (user, device, platform)
-- lets a single device update its token in place across reinstalls.

ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "platform" text NOT NULL DEFAULT 'web';
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "device_id" text;
ALTER TABLE "push_subscriptions" ALTER COLUMN "p256dh" DROP NOT NULL;
ALTER TABLE "push_subscriptions" ALTER COLUMN "auth" DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_user_device_platform_unq"
  ON "push_subscriptions" ("user_id", "device_id", "platform")
  WHERE "device_id" IS NOT NULL;
