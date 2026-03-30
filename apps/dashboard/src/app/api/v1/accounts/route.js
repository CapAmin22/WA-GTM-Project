import { createClient } from '@/lib/supabase/server';
import { requireRole, handleRBACError } from '@/lib/rbac';

/**
 * POST /api/v1/accounts
 * Add a new WhatsApp account (Admin+ only)
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    await requireRole(supabase, ['super_admin', 'admin']);

    const body = await request.json();
    const { phone_number, display_name, daily_limit } = body;

    // Validate phone number
    if (!phone_number || !/^\+[1-9]\d{6,14}$/.test(phone_number)) {
      return Response.json(
        { error: 'Invalid phone number. Must be E.164 format (e.g., +919876543210)' },
        { status: 400 }
      );
    }

    // Check for duplicates
    const { data: existing } = await supabase
      .from('wa_accounts')
      .select('id')
      .eq('phone_number', phone_number)
      .eq('is_archived', false)
      .single();

    if (existing) {
      return Response.json(
        { error: 'This phone number is already registered' },
        { status: 409 }
      );
    }

    // Insert new account
    const { data, error } = await supabase
      .from('wa_accounts')
      .insert({
        phone_number,
        display_name: display_name || 'Unnamed',
        daily_limit: parseInt(daily_limit, 10) || 200,
        status: 'pairing',
        connection_status: 'disconnected',
      })
      .select()
      .single();

    if (error) {
      return Response.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return Response.json({ data }, { status: 201 });
  } catch (error) {
    return handleRBACError(error);
  }
}

/**
 * GET /api/v1/accounts
 * List all active accounts (all authenticated users)
 */
export async function GET() {
  try {
    const supabase = await createClient();
    await requireRole(supabase, ['super_admin', 'admin', 'operator', 'viewer']);

    const { data, error } = await supabase
      .from('wa_accounts')
      .select('*')
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    if (error) {
      return Response.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return Response.json({ data });
  } catch (error) {
    return handleRBACError(error);
  }
}
