import { useAccess } from '../app/AccessContext'
import { demoServices, liveServices } from './index'
export function useServices() {
  const { demo } = useAccess()
  return demo ? demoServices : liveServices
}
