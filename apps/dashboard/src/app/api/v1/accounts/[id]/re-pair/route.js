import { createClient } from '@/lib/supabase/server';
import { requireRole, handleRBACError } from '@/lib/rbac';

/**
 * POST /api/v1/accounts/:id/re-pair
 * Reset account session and trigger new QR pairing — Super Admin ONLY
 */
export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    await requireRole(supabase, ['super_admin']);

    const { id } = await params;

    // 1. Reset the account to pairing state
    const { data, error: updateError } = await supabase
      .from('wa_accounts')
      .update({
        status: 'pairing',
        connection_status: 'disconnected',
        pairing_qr: null,
        session_data: null,
      })
      .eq('id', id)
      .eq('is_archived', false)
      .select()
      .single();

    if (updateError) {
      return Response.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    if (!data) {
      return Response.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // 2. Delete existing Baileys sessions and keys for this account
    // We must use the service_role key to bypass RLS for these tables
    const { createServerSupabaseClient } = await import('@wa-gtm/shared');
    const adminSupabase = createServerSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    await adminSupabase
      .from('baileys_sessions')
      .delete()
      .eq('account_id', id);

    await adminSupabase
      .from('baileys_keys')
      .delete()
      .eq('account_id', id);

    return Response.json({ data });
  } catch (error) {
    return handleRBACError(error);
  }
}
