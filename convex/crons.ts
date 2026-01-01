import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run daily at 9:00 AM UTC to check for orders needing payment reminders
crons.daily(
  "send payment reminders",
  { hourUTC: 9, minuteUTC: 0 },
  internal.crons.processPaymentReminders
);

export default crons;

