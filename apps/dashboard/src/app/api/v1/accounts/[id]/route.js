import { createClient } from '@/lib/supabase/server';
import { requireRole, handleRBACError } from '@/lib/rbac';

/**
 * DELETE /api/v1/accounts/:id
 * Soft-delete (archive) an account — Super Admin ONLY
 */
export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    await requireRole(supabase, ['super_admin']);

    const { id } = await params;

    const { error } = await supabase
      .from('wa_accounts')
      .update({
        is_archived: true,
        status: 'disconnected',
        connection_status: 'disconnected',
        pairing_qr: null,
      })
      .eq('id', id);

    if (error) {
      return Response.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleRBACError(error);
  }
}

/**
 * PATCH /api/v1/accounts/:id
 * Update account settings (display name, daily limit) — Admin+ only
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    await requireRole(supabase, ['super_admin', 'admin']);

    const { id } = await params;
    const body = await request.json();
    const { display_name, daily_limit } = body;

    const updatePayload = {};
    if (display_name !== undefined) updatePayload.display_name = display_name;
    if (daily_limit !== undefined) updatePayload.daily_limit = parseInt(daily_limit, 10);

    if (Object.keys(updatePayload).length === 0) {
      return Response.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('wa_accounts')
      .update(updatePayload)
      .eq('id', id)
      .eq('is_archived', false)
      .select()
      .single();

    if (error) {
      return Response.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return Response.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    return Response.json({ data });
  } catch (error) {
    return handleRBACError(error);
  }
}
