import { cronJobs } from "convex/server";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Internal action to process payment reminders (called by cron)
 */
export const processPaymentReminders = internalAction({
  args: {},
  handler: async (ctx): Promise<{ totalProcessed: number; successCount: number; errorCount: number }> => {
    // Get orders needing reminders
    const orders = await ctx.runQuery(internal.orders.getPendingOrdersForReminders);

    console.log(`Processing ${orders.length} orders for payment reminders`);

    let successCount = 0;
    let errorCount = 0;

    for (const order of orders) {
      try {
        if (!order.userEmail) {
          console.error(`Order ${order.orderNumber} has no user email, skipping`);
          errorCount++;
          continue;
        }

        const reminderCount = (order.reminderCount || 0) + 1;
        const isFinalNotice = reminderCount > 3;

        // Determine email kind
        const emailKind = isFinalNotice ? 'final_notice' : 'payment_reminder';

        // Call the email API
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/send-order-confirmation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            kind: emailKind,
            orderId: order._id,
            orderNumber: order.orderNumber,
            email: order.userEmail,
            amount: order.amount,
            totalPages: order.totalPages,
            fileCount: order.files.length,
            sourceLanguage: order.sourceLanguage,
            detectedSourceLanguage: (order as any).detectedSourceLanguage || null,
            targetLanguage: order.targetLanguage,
            reminderNumber: isFinalNotice ? undefined : reminderCount,
          }),
        });

        if (!response.ok) {
          throw new Error(`Email API returned ${response.status}`);
        }

        // Update order tracking
        if (isFinalNotice) {
          await ctx.runMutation(internal.orders.markFinalNoticeSent, {
            orderId: order._id,
          });
          console.log(`Final notice sent for order ${order.orderNumber}`);
        } else {
          await ctx.runMutation(internal.orders.updateOrderReminder, {
            orderId: order._id,
            reminderCount,
          });
          console.log(`Reminder ${reminderCount} sent for order ${order.orderNumber}`);
        }

        successCount++;
      } catch (error) {
        console.error(`Failed to process reminder for order ${order.orderNumber}:`, error);
        errorCount++;
      }
    }

    console.log(`Payment reminders processed: ${successCount} success, ${errorCount} errors`);

    return {
      totalProcessed: orders.length,
      successCount,
      errorCount,
    };
  },
});

const crons = cronJobs();

// Run daily at 9:00 AM UTC to check for orders needing payment reminders
crons.daily(
  "send payment reminders",
  { hourUTC: 9, minuteUTC: 0 },
  internal.crons.processPaymentReminders
);

export default crons;
