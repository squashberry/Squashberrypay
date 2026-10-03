import { httpServerHandler } from "cloudflare:node";
import { runSubscriptionReminderJob, runWebhookDeliveryJob } from "./server.js";

export default httpServerHandler({ port: 3000 });

export const scheduled = async () => {
  try {
    await runSubscriptionReminderJob();
  } catch (error) {
    console.error("Subscription reminder scheduled job failed:", error);
  }

  try {
    await runWebhookDeliveryJob();
  } catch (error) {
    console.error("Webhook delivery scheduled job failed:", error);
  }
};
