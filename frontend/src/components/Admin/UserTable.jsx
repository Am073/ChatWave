import { useState, useEffect, useCallback } from 'react';
import { getUsers, toggleUserActive, deleteUser } from '../../services/adminService';
import { cn } from '../../utils/cn';

const ROLE_BADGE = {
  student: 'bg-cw-blue/10 text-blue-300',
  faculty: 'bg-purple-500/10 text-purple-300',
  admin:   'bg-amber-500/10 text-amber-300',
};

const ROLE_AVATAR = {
  student: 'bg-cw-blue/10 text-blue-300',
  faculty: 'bg-purple-500/10 text-purple-300',
  admin:   'bg-amber-500/10 text-amber-300',
};

export default function UserTable() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const limit = 20;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUsers({ search, role: roleFilter, page, limit });
      setUsers(res.data?.users || []);
      setTotal(res.data?.total || 0);
    } catch (e) { console.error('UserTable fetch:', e); }
    finally { setLoading(false); }
  }, [search, roleFilter, page]);

  useEffect(() => {
    const t = setTimeout(fetchUsers, 300);
    return () => clearTimeout(t);
  }, [fetchUsers]);

  const handleToggle = async (id, current) => {
    try { await toggleUserActive(id, !current); fetchUsers(); }
    catch { alert('Failed to update user'); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete ${name}? Cannot be undone.`)) return;
    setDeleting(id);
    try { await deleteUser(id); fetchUsers(); }
    catch { alert('Failed to delete user'); }
    finally { setDeleting(null); }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="flex flex-col gap-3">
      {/* Search + filter row */}
      <div className="flex gap-2">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search name or ID..."
          className="cw-input flex-1"
        />
        <select
          value={roleFilter}
          onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
          className="cw-input w-36"
        >
          <option value="">All roles</option>
          <option value="student">Learner</option>
          <option value="faculty">Educator</option>
          <option value="admin">Administrator</option>
        </select>
      </div>

      {/* Table */}
      <div className="cw-card overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-white/[0.02] border-b border-white/[0.07]">
              {['User', 'Role', 'Dept', 'Status', 'Joined', 'Actions'].map(h => (
                <th key={h} className="px-3.5 py-2.5 text-left cw-section-header">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-3.5 py-3 text-center text-xs text-cw-t3">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="px-3.5 py-3 text-center text-xs text-cw-t3">No users found</td></tr>
            ) : users.map(user => (
              <tr key={user.id} className="border-b border-white/[0.04] last:border-none">
                {/* User cell */}
                <td className="px-3.5 py-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-semibold shrink-0 ${ROLE_AVATAR[user.role] ?? ROLE_AVATAR.student}`}>
                      {user.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-cw-t1">{user.name}</div>
                      <div className="text-[10px] text-cw-t3">{user.college_id}</div>
                    </div>
                  </div>
                </td>
                {/* Role */}
                <td className="px-3.5 py-3">
                  <span className={`text-[10px] font-medium px-2 py-px rounded capitalize ${ROLE_BADGE[user.role] ?? ROLE_BADGE.student}`}>
                    {user.role}
                  </span>
                </td>
                {/* Dept */}
                <td className="px-3.5 py-3 text-xs text-cw-t3">{user.department || '—'}</td>
                {/* Status */}
                <td className="px-3.5 py-3">
                  <div className={`flex items-center gap-1.5 text-[11px] ${user.is_active ? 'text-emerald-400' : 'text-cw-t3'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-emerald-400' : 'bg-cw-t3'}`} />
                    {user.is_active ? 'Active' : 'Inactive'}
                  </div>
                </td>
                {/* Joined */}
                <td className="px-3.5 py-3 text-[11px] text-cw-t3">
                  {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                </td>
                {/* Actions */}
                <td className="px-3.5 py-3">
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleToggle(user.id, user.is_active)}
                      title={user.is_active ? 'Deactivate' : 'Activate'}
                      className="w-6 h-6 rounded-md border border-white/[0.10] bg-white/[0.04] cursor-pointer flex items-center justify-center text-xs hover:bg-white/[0.08] transition-colors"
                    >{user.is_active ? '🚫' : '✓'}</button>
                    <button
                      onClick={() => handleDelete(user.id, user.name)}
                      disabled={deleting === user.id}
                      title="Delete user"
                      className="w-6 h-6 rounded-md border border-red-500/25 bg-red-500/[0.06] text-red-300 cursor-pointer flex items-center justify-center text-xs hover:bg-red-500/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >{deleting === user.id ? '…' : '🗑'}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3.5 py-2.5 border-t border-white/[0.07] bg-white/[0.01]">
            <span className="text-[11px] text-cw-t3">
              Showing {Math.min((page - 1) * limit + 1, total)}–{Math.min(page * limit, total)} of {total}
            </span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-2.5 py-1 rounded-md border border-white/[0.10] bg-white/[0.04] text-cw-t2 text-[11px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/[0.08] transition-colors">←</button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={cn("w-7 h-7 rounded-md text-[11px] cursor-pointer transition-colors",
                    p === page ? "bg-cw-blue text-white border-none" : "border border-white/[0.10] bg-white/[0.04] text-cw-t2 hover:bg-white/[0.08]"
                  )}>{p}</button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-2.5 py-1 rounded-md border border-white/[0.10] bg-white/[0.04] text-cw-t2 text-[11px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/[0.08] transition-colors">→</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
