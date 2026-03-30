/**
 * RBAC (Role-Based Access Control) helper for API routes.
 * Extracts user from Supabase session and verifies role.
 */

/**
 * Verify the current user has one of the allowed roles.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[]} allowedRoles - Array of allowed role strings
 * @returns {Promise<{ user: object, role: string }>}
 */
export async function requireRole(supabase, allowedRoles) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new RBACError(401, 'Unauthorized — no valid session');
  }

  const role = user.app_metadata?.role || 'viewer';

  if (!allowedRoles.includes(role)) {
    throw new RBACError(
      403,
      `Forbidden — role '${role}' does not have access. Required: ${allowedRoles.join(', ')}`
    );
  }

  return { user, role };
}

/**
 * Custom error class for RBAC failures.
 */
export class RBACError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'RBACError';
  }
}

/**
 * Handle RBAC errors in API route catch blocks.
 * @param {Error} error
 * @returns {Response}
 */
export function handleRBACError(error) {
  if (error instanceof RBACError) {
    return Response.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }
  console.error('Unexpected error:', error);
  return Response.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
