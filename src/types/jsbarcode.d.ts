declare module 'jsbarcode' {
  export default function JsBarcode(
    element: SVGSVGElement,
    text: string,
    options?: {
      format?: string
      width?: number
      height?: number
      displayValue?: boolean
      fontSize?: number
      margin?: number
    },
  ): void
}
