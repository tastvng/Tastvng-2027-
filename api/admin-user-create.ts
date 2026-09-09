import { createClient } from "@supabase/supabase-js";
import { applyCorsHeaders } from "./_cors";
import { verifySupabaseAdminToken } from "./_supabase-auth";

/**
 * Serverless Handler: POST /api/admin-user-create
 * Securely creates a new administrator or staff account in Supabase Auth and registers their profile.
 * Passwords are treated with zero-leakage discipline: never logged, never stored in database tables,
 * and never returned in API responses.
 * Strictly protected: Requires active session with profiles.role === 'admin'.
 * Always sets Content-Type: application/json and returns pure JSON.
 */
export default async function adminUserCreateHandler(req: any, res: any) {
  // Always ensure JSON output header
  if (res.setHeader) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }

  // Handle CORS
  applyCorsHeaders(req, res, "POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.status ? res.status(200).end() : res.sendStatus(200);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: `Mètode ${req.method} no permès a /api/admin-user-create. Utilitzeu POST.`
    });
  }

  // 1. Authenticate calling administrator
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';

  if (!token) {
    return res.status(401).json({
      error: "Accés no autoritzat (401): Cal una capçalera Authorization: Bearer <token> amb sessió activa."
    });
  }

  const adminAuth = await verifySupabaseAdminToken(token);
  if (!adminAuth.valid || !adminAuth.userId) {
    return res.status(403).json({
      error: "Accés denegat (403): Només els usuaris amb el rol 'admin' a public.profiles poden crear nous usuaris de personal."
    });
  }

  // 2. Validate input fields
  const body = req.body || {};
  const nom = String(body.nom || body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const roleRaw = String(body.role || 'staff').trim().toLowerCase();
  const password = String(body.password || '');
  const confirmPassword = String(body.confirmPassword || '');

  if (!nom) {
    return res.status(400).json({ error: "Cal introduir el nom complet del membre." });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "L'adreça de correu electrònic no té un format vàlid." });
  }

  if (roleRaw !== 'admin' && roleRaw !== 'staff') {
    return res.status(400).json({ error: "El rol ha de ser 'admin' o 'staff'." });
  }
  const role: 'admin' | 'staff' = roleRaw;

  if (!password || password.length < 6) {
    return res.status(400).json({ error: "La contrasenya ha de tenir com a mínim 6 caràcters." });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: "La confirmació de la contrasenya no coincideix." });
  }

  // 3. Supabase Admin client
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[/api/admin-user-create] SUPABASE_SERVICE_ROLE_KEY o URL absent en entorn");
    return res.status(500).json({
      error: "Error del servidor: La clau de servei de Supabase no està configurada a les variables d'entorn."
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  try {
    // 4. Create user in Supabase Auth directly (password hashed by Supabase internally)
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: nom,
        name: nom,
        role: role
      }
    });

    if (createError || !createData?.user) {
      console.error("[/api/admin-user-create] Error en createUser:", createError);
      const errMsg = createError?.message || "Error al crear l'usuari a Supabase Auth";
      if (errMsg.toLowerCase().includes("already") || errMsg.toLowerCase().includes("registered")) {
        return res.status(400).json({
          error: `El correu electrònic '${email}' ja està registrat a Supabase Auth.`
        });
      }
      return res.status(400).json({ error: errMsg });
    }

    const newUser = createData.user;
    const now = new Date().toISOString();

    // 5. Upsert corresponding record in public.profiles (WITHOUT ANY PASSWORDS)
    const { error: profileUpsertError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: newUser.id,
        role: role,
        created_at: now,
        updated_at: now
      }, { onConflict: 'id' });

    if (profileUpsertError) {
      console.error("[/api/admin-user-create] Error upserting profile:", profileUpsertError);
      return res.status(500).json({
        error: `Usuari creat a Auth, però no s'ha pogut vincular el seu rol a public.profiles: ${profileUpsertError.message}`
      });
    }

    // 6. Return sanitized user data (strictly no passwords, no tokens)
    return res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email || email,
        name: nom,
        role: role,
        created_at: now,
        updated_at: now,
        actiu: true,
        isCurrentCaller: false
      },
      message: `Usuari ${nom} (${email}) creat amb èxit amb rol '${role}'.`
    });
  } catch (err: any) {
    console.error("[/api/admin-user-create] Excepció inesperada:", err);
    return res.status(500).json({
      error: err?.message || "Error intern del servidor al donar d'alta l'usuari."
    });
  }
}
