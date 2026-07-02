import api from '../api/api'

export type OnboardOperatorPayload = {
  name: string
  email: string
  password: string
  water_system_ids: string[]
}

export type OperatorWaterSystemAssignment = {
  id: string
  unique_identifier: string
  tehsil: string
  village: string
  settlement?: string | null
}

export type ListedUser = {
  id: string
  name: string
  email: string
  role: string
  is_active: boolean
  tehsils: string[]
  review_tehsils?: string[]
  water_system_ids: string[]
  water_systems?: OperatorWaterSystemAssignment[]
  created_at?: string | null
}

export type AssignableRole = {
  code: string
  display_name: string
  hierarchy_rank: number
}

export type WaterSystemCatalogItem = {
  id: string
  unique_identifier: string
  tehsil: string
  village: string
}

export type CreatePortalUserPayload = {
  name: string
  email: string
  password: string
  role_code: string
  tehsils?: string[]
  water_system_ids?: string[]
}

export type UpdatePortalUserPayload = {
  name?: string
  role_code?: string
  tehsils?: string[]
  water_system_ids?: string[]
  is_active?: boolean
}

export const listUsers = async () => {
  const response = await api.get<{ users: ListedUser[] }>('/users/')
  return response.data
}

export const listAssignableRoles = async () => {
  const response = await api.get<{ roles: AssignableRole[] }>('/users/roles')
  return response.data
}

export const listWaterSystemsCatalog = async () => {
  const response = await api.get<{ water_systems: WaterSystemCatalogItem[] }>(
    '/users/water-systems',
  )
  return response.data
}

export const createPortalUser = async (payload: CreatePortalUserPayload) => {
  const response = await api.post('/users/', payload)
  return response.data as { message: string; user: ListedUser }
}

export const updatePortalUser = async (
  userId: string,
  payload: UpdatePortalUserPayload,
) => {
  const response = await api.patch(`/users/${userId}`, payload)
  return response.data as { message: string; user: ListedUser }
}

export const adminResetPassword = async (
  userId: string,
  new_password: string,
) => {
  const response = await api.post(`/users/${userId}/reset-password`, {
    new_password,
  })
  return response.data as { message: string }
}

export const onboardOperator = async (payload: OnboardOperatorPayload) => {
  const response = await api.post('/users/onboard-operator', payload)
  return response.data as { message: string; user: ListedUser }
}
