interface EmailPayload {
  to: string;
  subject: string;
  text: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  // Placeholder transport for Sprint 1. BullMQ-backed delivery lands in a later sprint.
  console.info("Email queued", payload);
}
