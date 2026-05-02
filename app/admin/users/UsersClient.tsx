'use client'

import { useState } from 'react'
import { updateUserRole } from '@/app/actions/admin'
import { useRouter } from 'next/navigation'

type User = {
  user_id: string
  email: string | undefined
  role: string
  created_at: string
  confirmed: boolean
  marketing_consent: boolean | null
}

type UsersClientProps = {
  initialUsers: User[]
}

export function UsersClient({ initialUsers }: UsersClientProps) {
  const router = useRouter()
  const [users, setUsers] = useState(initialUsers)
  const [searchTerm, setSearchTerm] = useState('')
  const [updatingUser, setUpdatingUser] = useState<string | null>(null)

  const filteredUsers = users.filter(user =>
    user.user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleRoleChange = async (userId: string, newRole: 'user' | 'admin') => {
    setUpdatingUser(userId)

    const result = await updateUserRole({ userId, role: newRole })

    if (result.error) {
      alert('Error updating role: ' + result.error)
    } else {
      // Update local state
      setUsers(users.map(u =>
        u.user_id === userId ? { ...u, role: newRole } : u
      ))
      router.refresh()
    }

    setUpdatingUser(null)
  }

  return (
    <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg">
      {/* Search */}
      <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
        <input
          type="text"
          placeholder="Search by email or user ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 bg-white dark:bg-[#0F0F0F] border border-zinc-200 dark:border-zinc-800 rounded-lg text-[#1A1A1A] dark:text-[#E8E8E8] placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#3D7A5F] dark:focus:ring-[#4E9A78]"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Joined
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Consent
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-zinc-500 dark:text-zinc-400">
                  No users found
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.user_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                  <td className="px-6 py-4 text-sm text-[#1A1A1A] dark:text-[#E8E8E8]">
                    {user.email || 'No email'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                      user.confirmed
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                        : 'bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200'
                    }`}>
                      {user.confirmed ? '✅ Confirmed' : '⏳ Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                    {new Date(user.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      user.role === 'admin'
                        ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200'
                        : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {user.marketing_consent === null ? (
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                        No record
                      </span>
                    ) : user.marketing_consent ? (
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200">
                        ✓ Marketing
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200">
                        Terms only
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {user.role === 'admin' ? (
                      <button
                        onClick={() => handleRoleChange(user.user_id, 'user')}
                        disabled={updatingUser === user.user_id}
                        className="px-3 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                      >
                        Demote
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRoleChange(user.user_id, 'admin')}
                        disabled={updatingUser === user.user_id}
                        className="px-3 py-1 text-xs font-medium text-[#3D7A5F] dark:text-[#4E9A78] hover:bg-[#3D7A5F]/10 dark:hover:bg-[#4E9A78]/10 rounded transition-colors disabled:opacity-50"
                      >
                        Promote to Admin
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 text-sm text-zinc-500 dark:text-zinc-400">
        Showing {filteredUsers.length} of {users.length} users
      </div>
    </div>
  )
}
