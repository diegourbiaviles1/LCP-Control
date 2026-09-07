import type { UserRole } from './domain'
export type Capability =
  | 'inventory.read'
  | 'scanner.use'
  | 'sale.create'
  | 'product.manage'
  | 'product.edit_cost'
  | 'inventory.create_entry'
  | 'inventory.create_exit'
  | 'inventory.create_damage'
  | 'inventory.adjust'
  | 'finance.read'
const common: Capability[] = [
  'inventory.read',
  'scanner.use',
  'sale.create',
  'inventory.create_exit',
  'inventory.create_damage',
]
const permissions: Record<UserRole, readonly Capability[]> = {
  admin: [
    ...common,
    'product.manage',
    'product.edit_cost',
    'inventory.create_entry',
    'inventory.adjust',
    'finance.read',
  ],
  operator: common,
}
export function can(
  role: UserRole | null | undefined,
  capability: Capability,
): boolean {
  return !!role && permissions[role].includes(capability)
}
// Missing / invalid roles fail closed. Never authorize from user_metadata.
export function parseRole(value: unknown): UserRole | null {
  return value === 'admin' || value === 'operator' ? value : null
}
