import { getAllUsers } from '@/app/actions/admin'
import { UsersClient } from './UsersClient'

export default async function AdminUsersPage() {
  const { users, error } = await getAllUsers()

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
          User Management
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Manage user roles and permissions
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-200 text-sm">
            Error loading users: {error}
          </p>
        </div>
      )}

      <UsersClient initialUsers={users} />
    </div>
  )
}
