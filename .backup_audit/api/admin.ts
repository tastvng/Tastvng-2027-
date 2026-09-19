import { createClient } from "@supabase/supabase-js";

export interface SanitizedAdminUser {
  id: string;
  email: string;
  nombre: string;
  name: string;
  rol: 'admin' | 'staff';
  role: 'admin' | 'staff';
  estado: 'actiu' | 'inactiu';
  actiu: boolean;
  fecha_creacion: string;
  created_at: string;
  updated_at?: string;
  last_sign_in_at?: string | null;
  isCurrentCaller?: boolean;
}

// In-memory rate limiting map
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
function checkRateLimit(ip: string, maxRequests = 60, windowMs = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (record.count >= maxRequests) {
    return false;
  }
  record.count++;
  return true;
}

function getClientIp(req: any): string {
  if (!req) return 'unknown';
  const xForwardedFor = req.headers?.['x-forwarded-for'] || req.headers?.['X-Forwarded-For'];
  if (typeof xForwardedFor === 'string' && xForwardedFor.trim()) {
    return xForwardedFor.split(',')[0].trim();
  }
  if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
    return String(xForwardedFor[0]).trim();
  }
  return req.headers?.['x-real-ip'] || req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';
}

/**
 * Applies self-contained CORS headers without importing relative helper files.
 */
function applyCors(req: any, res: any) {
  const origin = req?.headers?.origin || '*';
  if (res && typeof res.setHeader === 'function') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}

/**
 * Universal JSON response sender compatible with Vercel Serverless, Express, and Node http.
 * NEVER returns HTML or plain text.
 */
function sendJson(res: any, statusCode: number, payload: any) {
  try {
    const jsonStr = JSON.stringify(payload);
    if (typeof res.setHeader === 'function') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
    if (typeof res.status === 'function') {
      if (typeof res.json === 'function') {
        return res.status(statusCode).json(payload);
      }
      return res.status(statusCode).end(jsonStr);
    }
    if (typeof res.writeHead === 'function') {
      res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Content-Type-Options': 'nosniff'
      });
      return res.end(jsonStr);
    }
    return res.end ? res.end(jsonStr) : undefined;
  } catch (err) {
    console.error("[sendJson fatal error]:", err);
    try {
      res.writeHead?.(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end?.(JSON.stringify({ ok: false, error: 'ADMIN_API_ERROR', message: 'Error formatting response' }));
    } catch (_) {}
  }
}

/**
 * Safely parse incoming request body
 */
function parseBody(req: any): any {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Consolidated Admin Serverless Handler: /api/admin
 * Compatible with Vercel Serverless Functions and Express dev server.
 */
export default async function adminHandler(req: any, res: any) {
  // Always ensure JSON Content-Type from the very beginning
  applyCors(req, res);

  // Handle preflight OPTIONS request
  if ((req.method || '').toUpperCase() === 'OPTIONS') {
    if (typeof res.status === 'function') {
      return res.status(200).end();
    }
    if (typeof res.writeHead === 'function') {
      res.writeHead(200);
      return res.end();
    }
    return res.end ? res.end() : undefined;
  }

  try {
    const method = (req.method || 'GET').toUpperCase();
    const query = req.query || {};
    const body = parseBody(req);

    // Resolve target action from query parameter, body, or URL
    const urlString = String(req.url || '');
    let rawAction = String(query.action || body.action || '').trim().toLowerCase();
    if (!rawAction) {
      if (urlString.includes('action=health') || urlString.includes('admin-health')) {
        rawAction = 'health';
      } else if (urlString.includes('action=list') || urlString.includes('admin-users-list')) {
        rawAction = 'list';
      } else if (urlString.includes('action=create') || urlString.includes('admin-user-create')) {
        rawAction = 'create';
      } else if (urlString.includes('action=update') || urlString.includes('admin-user-update')) {
        rawAction = 'update';
      } else if (urlString.includes('action=delete') || urlString.includes('admin-user-delete')) {
        rawAction = 'delete';
      } else if (urlString.includes('/users') || method === 'GET') {
        rawAction = 'list';
      }
    }

    // Read environment variables safely on server
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

    const hasUrl = Boolean(supabaseUrl && supabaseUrl.startsWith('http'));
    const hasAnonKey = Boolean(supabaseAnonKey && supabaseAnonKey.length > 10);
    const hasServiceRoleKey = Boolean(serviceRoleKey && serviceRoleKey.length > 10);
    const supabaseConfigured = hasUrl && hasServiceRoleKey;

    // ==========================================
    // ACTION: health (Diagnostic Check, Public)
    // ==========================================
    if (rawAction === 'health') {
      return sendJson(res, 200, {
        ok: true,
        data: {
          route: "/api/admin?action=health",
          configured: supabaseConfigured,
          supabaseConfigured,
          hasUrl,
          hasAnonKey,
          hasServiceRoleKey,
          timestamp: new Date().toISOString()
        }
      });
    }

    // ==========================================
    // Rate limit check for mutations and queries
    // ==========================================
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp, 80, 60000)) {
      return sendJson(res, 429, {
        ok: false,
        error: "ADMIN_API_ERROR",
        message: "Massa peticions d'administració. Si us plau, espereu un moment."
      });
    }

    // Verify Supabase Server Configuration
    if (!supabaseConfigured) {
      console.error("[/api/admin] SUPABASE_SERVICE_ROLE_KEY o URL no configurada a l'entorn.");
      return sendJson(res, 500, {
        ok: false,
        error: "ADMIN_API_ERROR",
        message: "Error del servidor: SUPABASE_SERVICE_ROLE_KEY o URL de Supabase no estan configurades a l'entorn de producció."
      });
    }

    // Initialize Supabase Admin client with service_role key
    // NOTE: This client is only executed on the server, never exposed to the client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // ==========================================
    // Authentication & Role Check
    // ==========================================
    const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';

    if (!token) {
      return sendJson(res, 401, {
        ok: false,
        error: "ADMIN_API_ERROR",
        message: "Accés no autoritzat (401): Cal una sessió d'administrador activa amb capçalera Authorization: Bearer <token>."
      });
    }

    // Verify token with Supabase Auth
    const authClient = createClient(supabaseUrl, supabaseAnonKey || serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      return sendJson(res, 401, {
        ok: false,
        error: "ADMIN_API_ERROR",
        message: "Sessió no vàlida o caducada. Si us plau, torneu a iniciar sessió a l'administració."
      });
    }

    const callerUserId = userData.user.id;

    // Check caller role in public.profiles table
    const { data: callerProfile, error: callerProfileErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', callerUserId)
      .maybeSingle();

    if (callerProfileErr) {
      console.warn("[/api/admin] Warning checking caller profile:", callerProfileErr.message);
    }

    const callerRole = callerProfile?.role || userData.user.user_metadata?.role;
    if (callerRole !== 'admin') {
      return sendJson(res, 403, {
        ok: false,
        error: "ADMIN_API_ERROR",
        message: "Accés denegat (403): Només els usuaris amb el rol 'admin' a public.profiles poden gestionar el personal."
      });
    }

    // Helper to resolve target user ID
    const getTargetUserId = (): string => {
      if (body.id) return String(body.id).trim();
      if (query.id) return String(query.id).trim();
      if (req.params?.id) return String(req.params.id).trim();
      const match = urlString.match(/\/api\/admin\/(?:users\/)?([^?\/]+)/);
      return match ? match[1].trim() : '';
    };

    // ==========================================
    // ACTION: list (GET or action=list / users)
    // ==========================================
    if (rawAction === 'list' || rawAction === 'users' || (method === 'GET' && !rawAction)) {
      try {
        const { data: authUsersData, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers({
          perPage: 500
        });

        if (authUsersError) {
          console.error("[/api/admin list] authUsersError:", authUsersError);
          return sendJson(res, 500, {
            ok: false,
            error: "ADMIN_API_ERROR",
            message: `Error en consultar usuaris a Supabase Auth: ${authUsersError.message}`
          });
        }

        const { data: profilesData, error: profilesError } = await supabaseAdmin
          .from('profiles')
          .select('id, role, created_at, updated_at');

        if (profilesError) {
          console.warn("[/api/admin list] profilesError warning:", profilesError.message);
        }

        const profileMap = new Map<string, { role: string; created_at?: string; updated_at?: string }>();
        if (profilesData && Array.isArray(profilesData)) {
          for (const p of profilesData) {
            profileMap.set(p.id, p);
          }
        }

        const users: SanitizedAdminUser[] = (authUsersData.users || []).map((u) => {
          const p = profileMap.get(u.id);
          const resolvedRole: 'admin' | 'staff' = p?.role === 'admin'
            ? 'admin'
            : (p?.role === 'staff' ? 'staff' : (u.user_metadata?.role === 'admin' ? 'admin' : 'staff'));
          
          const fullName = String(u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'Usuari').trim();
          const isBanned = Boolean(u.banned_until && new Date(u.banned_until).getTime() > Date.now());
          const actiu = !isBanned;
          const estado: 'actiu' | 'inactiu' = actiu ? 'actiu' : 'inactiu';
          const createdAt = p?.created_at || u.created_at || new Date().toISOString();

          return {
            id: u.id,
            email: u.email || '',
            nombre: fullName,
            name: fullName,
            rol: resolvedRole,
            role: resolvedRole,
            estado,
            actiu,
            fecha_creacion: createdAt,
            created_at: createdAt,
            updated_at: p?.updated_at || u.updated_at,
            last_sign_in_at: u.last_sign_in_at || null,
            isCurrentCaller: u.id === callerUserId
          };
        });

        // Sort: Current caller first, then admins, then alphabetical by email
        users.sort((a, b) => {
          if (a.isCurrentCaller) return -1;
          if (b.isCurrentCaller) return 1;
          if (a.role === 'admin' && b.role !== 'admin') return -1;
          if (a.role !== 'admin' && b.role === 'admin') return 1;
          return a.email.localeCompare(b.email);
        });

        return sendJson(res, 200, {
          ok: true,
          data: {
            users,
            count: users.length
          },
          users // Direct property for client backwards-compatibility
        });
      } catch (listErr: any) {
        console.error("[/api/admin list] Exception:", listErr);
        return sendJson(res, 500, {
          ok: false,
          error: "ADMIN_API_ERROR",
          message: `Error intern en llistar administradors: ${listErr?.message || 'Error desconegut'}`
        });
      }
    }

    // ==========================================
    // ACTION: create (POST with action=create or password in body)
    // ==========================================
    if (rawAction === 'create' || (method === 'POST' && (body.password || body.nom || body.name))) {
      try {
        const nom = String(body.nom || body.name || body.nombre || '').trim();
        const email = String(body.email || '').trim().toLowerCase();
        const roleRaw = String(body.role || body.rol || 'staff').trim().toLowerCase();
        const password = String(body.password || '');
        const confirmPassword = String(body.confirmPassword || '');

        if (!nom) {
          return sendJson(res, 400, {
            ok: false,
            error: "ADMIN_API_ERROR",
            message: "Cal introduir el nom complet del membre de l'equip."
          });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return sendJson(res, 400, {
            ok: false,
            error: "ADMIN_API_ERROR",
            message: "L'adreça de correu electrònic no té un format vàlid."
          });
        }

        if (roleRaw !== 'admin' && roleRaw !== 'staff') {
          return sendJson(res, 400, {
            ok: false,
            error: "ADMIN_API_ERROR",
            message: "El rol ha de ser estrictament 'admin' o 'staff'."
          });
        }
        const role: 'admin' | 'staff' = roleRaw;

        if (!password || password.length < 6) {
          return sendJson(res, 400, {
            ok: false,
            error: "ADMIN_API_ERROR",
            message: "La contrasenya ha de tenir com a mínim 6 caràcters."
          });
        }

        if (confirmPassword && password !== confirmPassword) {
          return sendJson(res, 400, {
            ok: false,
            error: "ADMIN_API_ERROR",
            message: "La confirmació de la contrasenya no coincideix."
          });
        }

        // Create user in Supabase Auth via Admin API
        const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: nom,
            name: nom,
            role
          }
        });

        if (createError || !createData?.user) {
          console.error("[/api/admin create] Error:", createError);
          const errMsg = createError?.message || "Error al crear l'usuari a Supabase Auth";
          if (errMsg.toLowerCase().includes("already") || errMsg.toLowerCase().includes("registered")) {
            return sendJson(res, 400, {
              ok: false,
              error: "ADMIN_API_ERROR",
              message: `El correu electrònic '${email}' ja està registrat a Supabase Auth.`
            });
          }
          return sendJson(res, 400, {
            ok: false,
            error: "ADMIN_API_ERROR",
            message: errMsg
          });
        }

        const newUser = createData.user;
        const now = new Date().toISOString();

        // Save or update role in public.profiles table (profiles_role_check enforces 'admin' or 'user')
        const dbRole = role === 'admin' ? 'admin' : 'user';
        const { error: profileUpsertError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: newUser.id,
            role: dbRole,
            created_at: now,
            updated_at: now
          }, { onConflict: 'id' });

        if (profileUpsertError) {
          console.error("[/api/admin create profile upsert] Error:", profileUpsertError);
          return sendJson(res, 500, {
            ok: false,
            error: "ADMIN_API_ERROR",
            message: `Usuari creat a Auth, però no s'ha pogut vincular a public.profiles: ${profileUpsertError.message}`
          });
        }

        const createdUserRecord: SanitizedAdminUser = {
          id: newUser.id,
          email: newUser.email || email,
          nombre: nom,
          name: nom,
          rol: role,
          role,
          estado: 'actiu',
          actiu: true,
          fecha_creacion: now,
          created_at: now,
          updated_at: now,
          isCurrentCaller: false
        };

        return sendJson(res, 201, {
          ok: true,
          data: {
            user: createdUserRecord,
            message: `Usuari ${nom} (${email}) creat amb èxit amb rol '${role}'.`
          },
          user: createdUserRecord // Direct property for client backwards-compatibility
        });
      } catch (createErr: any) {
        console.error("[/api/admin create] Exception:", createErr);
        return sendJson(res, 500, {
          ok: false,
          error: "ADMIN_API_ERROR",
          message: `Error intern en crear l'usuari: ${createErr?.message || 'Error desconegut'}`
        });
      }
    }

    // ==========================================
    // ACTION: update (PATCH or POST with action=update or role/actiu)
    // ==========================================
    if (rawAction === 'update' || method === 'PATCH' || (method === 'POST' && (body.role !== undefined || body.rol !== undefined || body.actiu !== undefined || body.estado !== undefined))) {
      try {
        const targetId = getTargetUserId();
        if (!targetId) {
          return sendJson(res, 400, {
            ok: false,
            error: "ADMIN_API_ERROR",
            message: "Cal especificar l'identificador (id) de l'usuari a modificar."
          });
        }

        const roleRaw = body.role !== undefined ? body.role : body.rol;
        let actiuRaw = body.actiu;
        if (actiuRaw === undefined && body.estado !== undefined) {
          actiuRaw = body.estado === 'actiu' || body.estado === 'activo' || body.estado === true;
        }

        // 1. Update role if specified
        if (roleRaw !== undefined) {
          const role = String(roleRaw).trim().toLowerCase();
          if (role !== 'admin' && role !== 'staff') {
            return sendJson(res, 400, {
              ok: false,
              error: "ADMIN_API_ERROR",
              message: "El rol ha de ser estrictament 'admin' o 'staff'."
            });
          }

          if (targetId === callerUserId && role !== 'admin') {
            return sendJson(res, 400, {
              ok: false,
              error: "ADMIN_API_ERROR",
              message: "Mesura de seguretat: No podeu rebaixar el vostre propi rol d'administrador mentre teniu la sessió iniciada."
            });
          }

          const now = new Date().toISOString();
          const dbRole = role === 'admin' ? 'admin' : 'user';
          const { error: profUpdateErr } = await supabaseAdmin
            .from('profiles')
            .upsert({
              id: targetId,
              role: dbRole,
              updated_at: now
            }, { onConflict: 'id' });

          if (profUpdateErr) {
            console.error("[/api/admin update profile] Error:", profUpdateErr);
            return sendJson(res, 500, {
              ok: false,
              error: "ADMIN_API_ERROR",
              message: `Error actualitzant rol a public.profiles: ${profUpdateErr.message}`
            });
          }

          await supabaseAdmin.auth.admin.updateUserById(targetId, {
            user_metadata: { role }
          });
        }

        // 2. Update active / banned status if specified
        if (typeof actiuRaw === 'boolean') {
          if (targetId === callerUserId && !actiuRaw) {
            return sendJson(res, 400, {
              ok: false,
              error: "ADMIN_API_ERROR",
              message: "Mesura de seguretat: No podeu desactivar el vostre propi compte d'administrador."
            });
          }

          const banDuration = actiuRaw ? 'none' : '876000h';
          const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(targetId, {
            ban_duration: banDuration
          });

          if (banErr) {
            console.error("[/api/admin update ban] Error:", banErr);
            return sendJson(res, 500, {
              ok: false,
              error: "ADMIN_API_ERROR",
              message: `Error actualitzant estat d'accés a Auth: ${banErr.message}`
            });
          }
        }

        return sendJson(res, 200, {
          ok: true,
          data: {
            message: "Usuari actualitzat correctament a Supabase Auth i public.profiles."
          }
        });
      } catch (updateErr: any) {
        console.error("[/api/admin update] Exception:", updateErr);
        return sendJson(res, 500, {
          ok: false,
          error: "ADMIN_API_ERROR",
          message: `Error intern en actualitzar l'usuari: ${updateErr?.message || 'Error desconegut'}`
        });
      }
    }

    // ==========================================
    // ACTION: delete (DELETE or POST with action=delete)
    // ==========================================
    if (rawAction === 'delete' || method === 'DELETE') {
      try {
        const targetId = getTargetUserId();
        if (!targetId) {
          return sendJson(res, 400, {
            ok: false,
            error: "ADMIN_API_ERROR",
            message: "Cal especificar l'identificador (id) de l'usuari a eliminar."
          });
        }

        if (targetId === callerUserId) {
          return sendJson(res, 400, {
            ok: false,
            error: "ADMIN_API_ERROR",
            message: "Mesura de seguretat: No podeu eliminar el vostre propi compte d'administrador mentre esteu autenticat."
          });
        }

        const { error: delAuthError } = await supabaseAdmin.auth.admin.deleteUser(targetId);
        if (delAuthError) {
          console.error("[/api/admin deleteUser] Error:", delAuthError);
          return sendJson(res, 500, {
            ok: false,
            error: "ADMIN_API_ERROR",
            message: `Error eliminant l'usuari de Supabase Auth: ${delAuthError.message}`
          });
        }

        const { error: delProfileError } = await supabaseAdmin
          .from('profiles')
          .delete()
          .eq('id', targetId);

        if (delProfileError) {
          console.warn("[/api/admin delete profile] Warning:", delProfileError.message);
        }

        return sendJson(res, 200, {
          ok: true,
          data: {
            message: "L'usuari ha estat eliminat correctament de Supabase Auth i de la llista de personal."
          }
        });
      } catch (delErr: any) {
        console.error("[/api/admin delete] Exception:", delErr);
        return sendJson(res, 500, {
          ok: false,
          error: "ADMIN_API_ERROR",
          message: `Error intern en eliminar l'usuari: ${delErr?.message || 'Error desconegut'}`
        });
      }
    }

    // Default error for unknown action
    return sendJson(res, 400, {
      ok: false,
      error: "ADMIN_API_ERROR",
      message: `Acció no vàlida o no especificada a /api/admin: ${rawAction || method}`
    });

  } catch (globalErr: any) {
    console.error("[/api/admin global exception]:", globalErr);
    return sendJson(res, 500, {
      ok: false,
      error: "ADMIN_API_ERROR",
      message: globalErr?.message || "S'ha produït un error intern al servidor."
    });
  }
}
