import { useEffect, useId, useRef, useState } from 'react'
import { Camera, ScanLine, ShoppingBag, X } from 'lucide-react'
import {
  Button,
  Card,
  ErrorState,
  Input,
  LoadingState,
} from '../../components/ui'
import { createHtml5Adapter } from '../scanner/html5Adapter'
import { ScannerSession, type ScanState } from '../scanner/ScannerSession'
import { productService, inventoryService } from '../../services'
import { useAccess } from '../../app/AccessContext'

export function SalesPage() {
  const id = useId().replaceAll(':', '')
  const elementId = `camera-${id}`
  const controller = useRef<ScannerSession | null>(null)
  const [state, setState] = useState<ScanState>({ status: 'idle' })
  const [saleItems, setSaleItems] = useState<{product: any, quantity: number}[]>([])
  const [total, setTotal] = useState(0)
  const { hasAccess } = useAccess()

  useEffect(() => {
    let active = true
    const session = new ScannerSession(
      createHtml5Adapter(elementId),
      productService.findByBarcode,
      (state) => {
        if (active) setState(state)
      },
    )
    controller.current = session
    return () => {
      active = false
      void session.stop()
    }
  }, [elementId])

  const handleScanSuccess = async (product: any, code: string) => {
    // Verificar si el producto ya está en la venta actual
    const existingItemIndex = saleItems.findIndex(item => item.product.barcode === code)
    
    if (existingItemIndex >= 0) {
      // Si ya existe, incrementamos la cantidad
      const updatedItems = [...saleItems]
      updatedItems[existingItemIndex] = {
        ...updatedItems[existingItemIndex],
        quantity: updatedItems[existingItemIndex].quantity + 1
      }
      setSaleItems(updatedItems)
    } else {
      // Si es nuevo, lo agregamos con cantidad 1
      setSaleItems([...saleItems, { product, quantity: 1 }])
    }
    
    // Actualizar total
    const newTotal = saleItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0)
    setTotal(newTotal + product.price)
  }

  const removeItem = (index: number) => {
    const removedItem = saleItems[index]
    const updatedItems = saleItems.filter((_, i) => i !== index)
    setSaleItems(updatedItems)
    
    // Actualizar total
    const newTotal = updatedItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0)
    setTotal(newTotal)
  }

  const handlePayment = async () => {
    if (saleItems.length === 0) return
    
    try {
      // Aquí se registraría la venta en la base de datos
      // Primero actualizamos el inventario reduciendo las cantidades
      
      for (const item of saleItems) {
        await inventoryService.updateStock(item.product.id, -item.quantity)
      }
      
      alert('Venta registrada exitosamente')
      setSaleItems([])
      setTotal(0)
    } catch (error) {
      console.error('Error al registrar la venta:', error)
      alert('Error al registrar la venta. Por favor inténtelo de nuevo.')
    }
  }

  const startScan = async () => {
    try {
      setState({ status: 'starting' })
      await controller.current?.start()
      setState({ status: 'scanning' })
    } catch (error) {
      console.error('Error al iniciar la cámara:', error)
      setState({ 
        status: 'error', 
        message: errorMessage(error, cameraMessage) 
      })
    }
  }

  const stopScan = async () => {
    await controller.current?.stop()
    setState({ status: 'idle' })
  }

  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <span className="eyebrow">PUNTO DE VENTA</span>
          <h1>Nueva venta</h1>
          <p className="muted">Escanea los productos para registrar una venta</p>
        </div>
      </div>

      <Card className="space-y-4">
        {state.status === 'idle' && (
          <div className="text-center space-y-4">
            <Button onClick={startScan} variant="primary" size="lg">
              <Camera size={20} />
              Iniciar escaneo
            </Button>
            <p className="muted">Haz clic en el botón para activar la cámara</p>
          </div>
        )}

        {(state.status === 'starting' || state.status === 'scanning') && (
          <div className="space-y-4">
            <div className="aspect-video border rounded-lg overflow-hidden relative bg-gray-900">
              <div id={elementId} className="w-full h-full" />
              {state.status === 'scanning' && (
                <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm flex items-center gap-2">
                  <ScanLine size={16} />
                  Escaneando...
                </div>
              )}
            </div>
            
            <Button onClick={stopScan} variant="secondary" className="w-full">
              <X size={20} />
              Detener escaneo
            </Button>
          </div>
        )}

        {state.status === 'found' && (
          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="font-bold text-lg">{state.product.name}</h3>
              <p className="text-gray-600">Código: {state.product.barcode}</p>
              <p className="text-xl font-bold">${state.product.price}</p>
            </Card>
            
            <Button 
              onClick={() => handleScanSuccess(state.product, state.code)}
              variant="primary"
              size="lg"
              className="w-full"
            >
              Agregar a la venta
            </Button>
          </div>
        )}

        {state.status === 'unknown' && (
          <Card className="p-4">
            <h3 className="font-bold text-lg">Producto no encontrado</h3>
            <p className="text-gray-600">Código escaneado: {state.code}</p>
            <Button 
              onClick={() => setState({ status: 'idle' })}
              variant="primary"
              size="lg"
              className="w-full mt-2"
            >
              Volver al escaneo
            </Button>
          </Card>
        )}

        {(state.status === 'error') && (
          <ErrorState 
            message={state.message} 
            onRetry={startScan}
          />
        )}
      </Card>

      {/* Panel de productos en la venta actual */}
      {saleItems.length > 0 && (
        <Card className="space-y-4">
          <h2 className="font-bold text-xl">Productos en la venta</h2>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {saleItems.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <h3 className="font-medium">{item.product.name}</h3>
                  <p className="text-sm text-gray-600">Cantidad: {item.quantity}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">${(item.product.price * item.quantity).toFixed(2)}</p>
                  <Button 
                    onClick={() => removeItem(index)}
                    variant="secondary"
                    size="sm"
                    className="mt-1"
                  >
                    Quitar
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center text-xl font-bold">
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
            
            <Button 
              onClick={handlePayment}
              variant="primary"
              size="lg"
              className="w-full mt-4"
            >
              Finalizar venta
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}