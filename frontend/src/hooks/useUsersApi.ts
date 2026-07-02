import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  adminResetPassword,
  createPortalUser,
  listAssignableRoles,
  listUsers,
  listWaterSystemsCatalog,
  onboardOperator,
  updatePortalUser,
  type CreatePortalUserPayload,
  type OnboardOperatorPayload,
  type UpdatePortalUserPayload,
} from '../services/usersService'

export function useUsersApi() {
  const qc = useQueryClient()

  const usersQuery = useQuery({
    queryKey: ['users', 'list'],
    queryFn: () => listUsers(),
  })

  const rolesQuery = useQuery({
    queryKey: ['users', 'roles'],
    queryFn: () => listAssignableRoles(),
  })

  const waterSystemsQuery = useQuery({
    queryKey: ['users', 'water-systems'],
    queryFn: () => listWaterSystemsCatalog(),
  })

  const createMutation = useMutation({
    mutationFn: (payload: CreatePortalUserPayload) => createPortalUser(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users', 'list'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({
      userId,
      payload,
    }: {
      userId: string
      payload: UpdatePortalUserPayload
    }) => updatePortalUser(userId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users', 'list'] })
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: ({
      userId,
      new_password,
    }: {
      userId: string
      new_password: string
    }) => adminResetPassword(userId, new_password),
  })

  const onboardMutation = useMutation({
    mutationFn: (payload: OnboardOperatorPayload) => onboardOperator(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users', 'list'] })
    },
  })

  return {
    users: usersQuery.data?.users,
    usersLoading: usersQuery.isLoading,
    roles: rolesQuery.data?.roles,
    rolesLoading: rolesQuery.isLoading,
    waterSystems: waterSystemsQuery.data?.water_systems,
    waterSystemsLoading: waterSystemsQuery.isLoading,
    refetchUsers: () => usersQuery.refetch(),
    createUser: createMutation.mutateAsync,
    createLoading: createMutation.isPending,
    updateUser: updateMutation.mutateAsync,
    updateLoading: updateMutation.isPending,
    resetPassword: resetPasswordMutation.mutateAsync,
    resetLoading: resetPasswordMutation.isPending,
    onboardOperator: onboardMutation.mutateAsync,
    onboardLoading: onboardMutation.isPending,
  }
}
