import React, { useState, useEffect } from 'react';
import { 
  UserCheck, 
  ShieldCheck, 
  Shield, 
  UserPlus, 
  RefreshCw, 
  Trash2, 
  KeyRound, 
  Eye, 
  EyeOff, 
  Mail, 
  User, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Lock,
  Calendar,
  Clock
} from 'lucide-react';
import { 
  fetchAdminUsers, 
  createAdminUser, 
  updateAdminUserRole, 
  toggleAdminUserActive, 
  deleteAdminUser, 
  AdminUserRecord 
} from '../supabaseClient';
import { useLanguage } from '../LanguageContext';

interface AdminStaffManagementProps {
  onClose?: () => void;
  onUserCountChange?: (count: number) => void;
  onAddLog?: (msg: string) => void;
}

export const AdminStaffManagement: React.FC<AdminStaffManagementProps> = ({
  onClose,
  onUserCountChange,
  onAddLog
}) => {
  const { language } = useLanguage();

  // Directory state
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form state for creating new user
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'staff'>('staff');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Action states
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Load real administrators from Auth + profiles
  const loadUsers = async () => {
    setIsLoading(true);
    setFetchError(null);
    setActionError(null);
    const res = await fetchAdminUsers();
    if (res.error) {
      setFetchError(res.error);
    } else {
      setUsers(res.users);
      if (onUserCountChange) {
        onUserCountChange(res.users.length);
      }
      // Broadcast event for navbar counter
      window.dispatchEvent(new CustomEvent('staffChanged', { detail: { count: res.users.length } }));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadUsers();
    // Clear any obsolete localStorage fake keys
    try {
      localStorage.removeItem('tast_staff_2026');
    } catch {
      // ignore
    }
  }, []);

  // Handle User Creation
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    // Client validations
    if (!nom.trim()) {
      setFormError(language === 'ca' ? 'Cal introduir el nom complet.' : 'Debe introducir el nombre completo.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setFormError(language === 'ca' ? 'El format del correu electrònic no és vàlid.' : 'El formato del correo electrónico no es válido.');
      return;
    }

    if (!password || password.length < 6) {
      setFormError(language === 'ca' ? 'La contrasenya ha de tenir com a mínim 6 caràcters.' : 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError(language === 'ca' ? 'Les contrasenyes no coincideixen.' : 'Las contraseñas no coinciden.');
      return;
    }

    setIsSubmitting(true);
    const res = await createAdminUser({
      nom: nom.trim(),
      email: email.trim().toLowerCase(),
      role,
      password,
      confirmPassword
    });

    setIsSubmitting(false);

    if (!res.success) {
      setFormError(res.error || (language === 'ca' ? 'Error al crear el compte.' : 'Error al crear la cuenta.'));
      return;
    }

    setFormSuccess(
      language === 'ca'
        ? `✓ Compte de ${nom} (${email}) creat amb èxit amb rol '${role}'.`
        : `✓ Cuenta de ${nom} (${email}) creada con éxito con rol '${role}'.`
    );

    if (onAddLog) {
      onAddLog(`Alta de nou usuari d'administració: ${email} (Rol: ${role})`);
    }

    // Reset inputs
    setNom('');
    setEmail('');
    setRole('staff');
    setPassword('');
    setConfirmPassword('');

    // Refresh real users list
    await loadUsers();

    setTimeout(() => {
      setFormSuccess(null);
    }, 4000);
  };

  // Handle Role Change
  const handleRoleChange = async (userId: string, newRole: 'admin' | 'staff', userEmail: string) => {
    setUpdatingId(userId);
    setActionError(null);
    setActionSuccess(null);

    const res = await updateAdminUserRole(userId, newRole);
    setUpdatingId(null);

    if (!res.success) {
      setActionError(res.error || (language === 'ca' ? 'Error canviant el rol.' : 'Error cambiando el rol.'));
      return;
    }

    setActionSuccess(
      language === 'ca'
        ? `✓ Rol de ${userEmail} canviat a '${newRole}'.`
        : `✓ Rol de ${userEmail} cambiado a '${newRole}'.`
    );

    if (onAddLog) {
      onAddLog(`Canvi de rol per a l'usuari ${userEmail}: ara és ${newRole}`);
    }

    await loadUsers();

    setTimeout(() => {
      setActionSuccess(null);
    }, 3500);
  };

  // Handle Toggle Active
  const handleToggleActive = async (userId: string, currentActiu: boolean, userEmail: string) => {
    setUpdatingId(userId);
    setActionError(null);
    setActionSuccess(null);

    const res = await toggleAdminUserActive(userId, !currentActiu);
    setUpdatingId(null);

    if (!res.success) {
      setActionError(res.error || (language === 'ca' ? "Error modificant l'estat d'accés." : "Error modificando el estado de acceso."));
      return;
    }

    setActionSuccess(
      language === 'ca'
        ? `✓ Estat d'accés de ${userEmail} modificat a ${!currentActiu ? 'Actiu' : 'Inactiu'}.`
        : `✓ Estado de acceso de ${userEmail} modificado a ${!currentActiu ? 'Activo' : 'Inactivo'}.`
    );

    await loadUsers();

    setTimeout(() => {
      setActionSuccess(null);
    }, 3000);
  };

  // Handle Delete User
  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (deleteConfirmId !== userId) {
      setDeleteConfirmId(userId);
      return;
    }

    setUpdatingId(userId);
    setActionError(null);
    setActionSuccess(null);

    const res = await deleteAdminUser(userId);
    setUpdatingId(null);
    setDeleteConfirmId(null);

    if (!res.success) {
      setActionError(res.error || (language === 'ca' ? "Error eliminant l'usuari." : "Error eliminando el usuario."));
      return;
    }

    setActionSuccess(
      language === 'ca'
        ? `✓ L'usuari ${userEmail} ha estat retirat de Supabase Auth i de la llista de personal.`
        : `✓ El usuario ${userEmail} ha sido retirado de Supabase Auth y de la lista de personal.`
    );

    if (onAddLog) {
      onAddLog(`Eliminació de l'usuari de personal: ${userEmail}`);
    }

    await loadUsers();

    setTimeout(() => {
      setActionSuccess(null);
    }, 4000);
  };

  return (
    <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl overflow-hidden flex flex-col max-w-5xl w-full mx-auto animate-fade-in" id="staff-management-container">
      {/* Header */}
      <div className="p-5 sm:p-6 bg-zinc-950 text-white flex justify-between items-center border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-fuchsia-600/90 text-white rounded-2xl shadow-sm">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-sans font-black text-base text-white tracking-tight">
                {language === 'ca' ? "Gestió Oficial d'Administradors i Staff" : "Gestión Oficial de Administradores y Staff"}
              </h3>
              <span className="text-[10px] font-mono font-bold bg-zinc-800 text-fuchsia-400 px-2 py-0.5 rounded-md border border-zinc-700">
                Supabase Auth + Profiles
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-sans mt-0.5">
              {language === 'ca'
                ? "Font de dades oficial integrada amb auth.users i public.profiles. Sense contrasenyes públiques ni memòria local."
                : "Fuente de datos oficial integrada con auth.users y public.profiles. Sin contraseñas públicas ni memoria local."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadUsers}
            disabled={isLoading}
            className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-xl transition cursor-pointer disabled:opacity-50"
            title={language === 'ca' ? 'Refrescar llista' : 'Refrescar lista'}
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin text-fuchsia-400' : ''} />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 rounded-xl transition cursor-pointer"
              aria-label="Tancar"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Global Notifications */}
      {actionError && (
        <div className="bg-red-50 border-b border-red-200 text-red-750 p-3.5 px-6 text-xs font-bold flex items-center gap-2">
          <AlertCircle size={16} className="text-red-550 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-800 p-3.5 px-6 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Main Container: 2-column layout */}
      <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-zinc-50 max-h-[80vh]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column: Form Alta de superadministradors | Staff */}
          <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-zinc-200 shadow-sm space-y-4" id="alta-staff-form-card">
            <div className="border-b border-zinc-100 pb-3">
              <h4 className="font-sans font-extrabold text-xs text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                <UserPlus size={16} className="text-[#ff0090]" />
                {language === 'ca' ? "Alta d'Administradors | Staff" : "Alta de Administradores | Staff"}
              </h4>
              <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                {language === 'ca'
                  ? "Crea un compte d'accés segur a Supabase Auth amb assignació directa de rol a public.profiles."
                  : "Crea una cuenta de acceso seguro en Supabase Auth con asignación directa de rol en public.profiles."}
              </p>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold flex items-start gap-2">
                <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-start gap-2">
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3">
              {/* Nom complet */}
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase font-mono font-bold mb-1">
                  {language === 'ca' ? "Nom Complet *" : "Nombre Completo *"}
                </label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-2.5 text-zinc-400" />
                  <input
                    type="text"
                    required
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    placeholder={language === 'ca' ? "Ex. Joan Garcia" : "Ej. Juan García"}
                    className="w-full bg-zinc-50 text-zinc-900 border border-zinc-200 focus:border-[#ff0090] focus:bg-white rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Email d'accés */}
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase font-mono font-bold mb-1">
                  {language === 'ca' ? "Email d'accés *" : "Email de acceso *"}
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-2.5 text-zinc-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuari@eltast.cat"
                    className="w-full bg-zinc-50 text-zinc-900 border border-zinc-200 focus:border-[#ff0090] focus:bg-white rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Rol: admin o staff */}
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase font-mono font-bold mb-1">
                  {language === 'ca' ? "Rol d'accés *" : "Rol de acceso *"}
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'admin' | 'staff')}
                  className="w-full bg-zinc-50 text-zinc-900 border border-zinc-200 focus:border-[#ff0090] focus:bg-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none cursor-pointer"
                >
                  <option value="admin">👑 Admin (Accés i Control Total a public.profiles)</option>
                  <option value="staff">👥 Staff (Personal d'Entrega i Taules)</option>
                </select>
              </div>

              {/* Contrasenya inicial */}
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase font-mono font-bold mb-1">
                  {language === 'ca' ? "Contrasenya inicial (mín. 6 caràcters) *" : "Contraseña inicial (mín. 6 caracteres) *"}
                </label>
                <div className="relative">
                  <KeyRound size={14} className="absolute left-3 top-2.5 text-zinc-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-zinc-50 text-zinc-900 border border-zinc-200 focus:border-[#ff0090] focus:bg-white rounded-xl pl-9 pr-9 py-2 text-xs focus:outline-none transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                    title={showPassword ? 'Ocultar' : 'Mostrar'}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Confirmació de contrasenya */}
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase font-mono font-bold mb-1">
                  {language === 'ca' ? "Confirmació de contrasenya *" : "Confirmación de contraseña *"}
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-2.5 text-zinc-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full bg-zinc-50 text-zinc-900 border rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none transition-all font-mono ${
                      confirmPassword && confirmPassword !== password 
                        ? 'border-red-400 bg-red-50/40' 
                        : 'border-zinc-200 focus:border-[#ff0090] focus:bg-white'
                    }`}
                  />
                </div>
                {confirmPassword && confirmPassword !== password && (
                  <p className="text-[10px] text-red-500 font-semibold mt-1">
                    {language === 'ca' ? 'Les contrasenyes no coincideixen' : 'Las contraseñas no coinciden'}
                  </p>
                )}
              </div>

              {/* Security notice */}
              <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-[10px] text-zinc-500 leading-relaxed space-y-1">
                <div className="flex items-center gap-1 font-bold text-zinc-700">
                  <Shield size={12} className="text-[#ff0090]" />
                  <span>{language === 'ca' ? 'Directiva de seguretat estricta' : 'Directiva de seguridad estricta'}</span>
                </div>
                <p>
                  {language === 'ca'
                    ? "La contrasenya s'envia xifrada directament a Supabase Auth. Mai s'emmagatzema a taules públiques, settings o memòria local."
                    : "La contraseña se envía cifrada directamente a Supabase Auth. Nunca se almacena en tablas públicas, settings o memoria local."}
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-2.5 bg-zinc-950 text-white hover:bg-black font-bold rounded-xl transition text-xs flex items-center justify-center gap-2 shadow-sm uppercase tracking-wider cursor-pointer font-sans disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin text-[#ff0090]" />
                    <span>{language === 'ca' ? 'Creant usuari segur...' : 'Creando usuario seguro...'}</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={14} className="text-[#ff0090]" />
                    <span>{language === 'ca' ? "Donar d'Alta Membre" : "Dar de Alta Miembro"}</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Column: Real Staff & Admin Directory (auth.users + profiles) */}
          <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-zinc-200 shadow-sm space-y-4" id="llista-personal-card">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
              <div>
                <h4 className="font-sans font-extrabold text-xs text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                  <UserCheck size={16} className="text-[#ff0090]" />
                  {language === 'ca' ? "Llistat de Personal i Administradors Reals" : "Listado de Personal y Administradores Reales"}
                  <span className="text-[10px] font-mono font-bold bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-full border border-zinc-200">
                    {users.length}
                  </span>
                </h4>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {language === 'ca'
                    ? "Sincronitzat en temps real des de Supabase Auth i public.profiles."
                    : "Sincronizado en tiempo real desde Supabase Auth y public.profiles."}
                </p>
              </div>

              <button
                type="button"
                onClick={loadUsers}
                disabled={isLoading}
                className="text-[11px] font-bold text-zinc-600 hover:text-zinc-900 flex items-center gap-1 cursor-pointer bg-zinc-100 hover:bg-zinc-200 px-2.5 py-1 rounded-lg transition"
              >
                <RefreshCw size={11} className={isLoading ? 'animate-spin' : ''} />
                <span>{language === 'ca' ? 'Actualitzar' : 'Actualizar'}</span>
              </button>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-zinc-400 font-sans text-xs flex flex-col items-center justify-center gap-2">
                <RefreshCw size={20} className="animate-spin text-[#ff0090]" />
                <span>{language === 'ca' ? "Carregant administradors des de Supabase Auth..." : "Cargando administradores desde Supabase Auth..."}</span>
              </div>
            ) : fetchError ? (
              <div className="py-8 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-850 text-xs text-center space-y-2">
                <AlertCircle size={20} className="text-amber-600 mx-auto" />
                <p className="font-bold">{language === 'ca' ? "No s'ha pogut obtenir la llista de personal:" : "No se ha podido obtener la lista de personal:"}</p>
                <p className="text-[11px] font-mono text-zinc-600">{fetchError}</p>
                <button
                  onClick={loadUsers}
                  className="mt-2 text-xs font-bold bg-zinc-900 text-white px-3 py-1.5 rounded-xl cursor-pointer hover:bg-black transition"
                >
                  {language === 'ca' ? 'Reintentar connexió' : 'Reintentar conexión'}
                </button>
              </div>
            ) : users.length === 0 ? (
              <div className="py-12 text-center text-zinc-400 font-sans text-xs">
                {language === 'ca'
                  ? "No s'ha trobat cap usuari registrat a Supabase Auth."
                  : "No se ha encontrado ningún usuario registrado en Supabase Auth."}
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {users.map((u) => {
                  const isUpdating = updatingId === u.id;
                  const isConfirmingDelete = deleteConfirmId === u.id;

                  return (
                    <div
                      key={u.id}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                        u.actiu
                          ? 'bg-white border-zinc-200 hover:border-zinc-300 hover:shadow-xs'
                          : 'bg-zinc-50 border-zinc-200 opacity-60'
                      }`}
                    >
                      {/* User Info */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-zinc-900 leading-none truncate">
                            {u.name || u.email.split('@')[0]}
                          </span>

                          {/* Role Badge */}
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-md font-mono uppercase tracking-wider flex items-center gap-1 ${
                            u.role === 'admin'
                              ? 'bg-red-50 text-red-600 border border-red-200'
                              : 'bg-blue-50 text-blue-600 border border-blue-200'
                          }`}>
                            {u.role === 'admin' ? '👑 Admin' : '👥 Staff'}
                          </span>

                          {/* Current Session indicator */}
                          {u.isCurrentCaller && (
                            <span className="text-[9px] font-bold bg-fuchsia-50 text-[#ff0090] border border-fuchsia-200 px-1.5 py-0.5 rounded-md">
                              {language === 'ca' ? 'La teva sessió' : 'Tu sesión'}
                            </span>
                          )}

                          {/* Status */}
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                            u.actiu
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-zinc-200 text-zinc-600 border border-zinc-300'
                          }`}>
                            {u.actiu ? (language === 'ca' ? 'Actiu' : 'Activo') : (language === 'ca' ? 'Inactiu' : 'Inactivo')}
                          </span>
                        </div>

                        {/* Email & Date details */}
                        <div className="flex items-center gap-4 text-[11px] text-zinc-500 font-mono flex-wrap">
                          <span className="flex items-center gap-1 text-zinc-800 font-semibold truncate">
                            <Mail size={12} className="text-zinc-400 shrink-0" />
                            {u.email}
                          </span>
                          {u.created_at && (
                            <span className="flex items-center gap-1 text-zinc-400 text-[10px]">
                              <Calendar size={11} className="shrink-0" />
                              {new Date(u.created_at).toLocaleDateString('ca-ES')}
                            </span>
                          )}
                          {u.last_sign_in_at && (
                            <span className="flex items-center gap-1 text-zinc-400 text-[10px] hidden sm:inline-flex">
                              <Clock size={11} className="shrink-0" />
                              {new Date(u.last_sign_in_at).toLocaleDateString('ca-ES')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* User Actions */}
                      <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-zinc-100">
                        {/* Role Selector dropdown */}
                        <div className="relative">
                          <select
                            disabled={isUpdating}
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value as 'admin' | 'staff', u.email)}
                            className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold rounded-xl px-2.5 py-1.5 border border-zinc-300 focus:outline-none cursor-pointer disabled:opacity-50 transition"
                            title={language === 'ca' ? 'Canviar rol de perfil a public.profiles' : 'Cambiar rol de perfil en public.profiles'}
                          >
                            <option value="admin">Admin</option>
                            <option value="staff">Staff</option>
                          </select>
                        </div>

                        {/* Active / Inactive Toggle */}
                        <button
                          type="button"
                          disabled={isUpdating || u.isCurrentCaller}
                          onClick={() => handleToggleActive(u.id, u.actiu, u.email)}
                          className={`text-xs font-bold px-2.5 py-1.5 rounded-xl transition cursor-pointer disabled:opacity-40 ${
                            u.actiu
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-zinc-100 text-zinc-500 border border-zinc-200 hover:bg-zinc-200 hover:text-zinc-800'
                          }`}
                          title={u.isCurrentCaller ? (language === 'ca' ? 'No pots desactivar el teu compte' : 'No puedes desactivar tu cuenta') : (language === 'ca' ? "Habilitar/Deshabilitar accés" : "Habilitar/Deshabilitar acceso")}
                        >
                          {u.actiu ? (language === 'ca' ? 'Actiu' : 'Activo') : (language === 'ca' ? 'Inactiu' : 'Inactivo')}
                        </button>

                        {/* Delete User Button with Confirmation */}
                        <button
                          type="button"
                          disabled={isUpdating || u.isCurrentCaller}
                          onClick={() => handleDeleteUser(u.id, u.email)}
                          className={`px-2.5 py-1.5 transition rounded-xl cursor-pointer text-xs font-bold flex items-center gap-1 disabled:opacity-30 ${
                            isConfirmingDelete
                              ? 'bg-red-600 text-white animate-pulse'
                              : 'text-zinc-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200'
                          }`}
                          title={
                            u.isCurrentCaller
                              ? (language === 'ca' ? "No pots eliminar el teu compte actiu" : "No puedes eliminar tu cuenta activa")
                              : (isConfirmingDelete ? (language === 'ca' ? "Clica per confirmar eliminació" : "Clica para confirmar eliminación") : (language === 'ca' ? "Retirar d'Auth i personal" : "Retirar de Auth y personal"))
                          }
                        >
                          {isConfirmingDelete ? (
                            <span className="text-[10px] px-1 font-black uppercase">
                              {language === 'ca' ? 'Confirmar?' : '¿Confirmar?'}
                            </span>
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
