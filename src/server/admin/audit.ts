import "server-only";
import { adminDb } from "./client";

/**
 * Records a read-type event (PDF generated, export downloaded) in the insert-only
 * audit log. Call only AFTER the caller has been authorised.
 */
export async function auditEvent(actorId: string, action: string, entityType: string, entityId: string | null, meta?: Record<string, unknown>) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  await adminDb().from("audit_logs").insert({ actor_id: actorId, action, entity_type: entityType, entity_id: entityId, after: meta ?? null });
}
