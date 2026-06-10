declare module 'react-simple-maps' {
  import type { ReactNode, CSSProperties } from 'react'

  export interface ComposableMapProps {
    projection?: string
    projectionConfig?: {
      scale?: number
      center?: [number, number]
      rotate?: [number, number, number]
    }
    style?: CSSProperties
    width?: number
    height?: number
    children?: ReactNode
  }

  export interface GeographiesProps {
    geography: string | object
    children: (props: { geographies: GeoType[] }) => ReactNode
  }

  export interface GeoType {
    rsmKey: string
    type: string
    properties: Record<string, unknown>
    geometry: object
  }

  export interface GeographyProps {
    geography: GeoType
    fill?: string
    fillOpacity?: number
    stroke?: string
    strokeWidth?: number
    strokeOpacity?: number
    style?: {
      default?: CSSProperties
      hover?: CSSProperties
      pressed?: CSSProperties
    }
  }

  export interface MarkerProps {
    coordinates: [number, number]
    children?: ReactNode
  }

  export function ComposableMap(props: ComposableMapProps): JSX.Element
  export function Geographies(props: GeographiesProps): JSX.Element
  export function Geography(props: GeographyProps): JSX.Element
  export function Marker(props: MarkerProps): JSX.Element
}
