/* eslint-disable @typescript-eslint/consistent-indexed-object-style -- host shape is Reanimated's */
import { createJSReanimatedModule } from 'react-native-reanimated/lib/module/ReanimatedModule/js-reanimated/JSReanimated.js'
import {
  createReactDOMStyle,
  createTextShadowValue,
  createTransformValue,
} from './reanimated-web-utils'

export { createJSReanimatedModule }

interface StyleProps {
  [key: string]: unknown
}
interface Host {
  getAnimatableRef?: () => Host
  setNativeProps?: (style: StyleProps) => void
  style?: StyleProps | CSSStyleDeclaration
  props?: Record<string, unknown>
  previousStyle?: StyleProps
  _touchableNode?: { setAttribute: (key: string, value: unknown) => void }
  nodeName?: string
  value?: unknown
  setAttribute?: (key: string, value: unknown) => void
  className?: string
}

export const _updatePropsJS = (
  updates: StyleProps,
  viewRef: Host | null | undefined,
  isAnimatedProps?: boolean,
): void => {
  if (viewRef == null) return
  const component = viewRef.getAnimatableRef ? viewRef.getAnimatableRef() : viewRef
  if (component == null) return

  const rawStyles = Object.fromEntries(
    Object.entries(updates).filter(([, value]) => typeof value !== 'function'),
  )

  if (typeof component.setNativeProps === 'function') {
    setNativeProps(component, rawStyles, isAnimatedProps)
    return
  }
  if (createReactDOMStyle !== undefined && component.style !== undefined) {
    updatePropsDOM(component, rawStyles, isAnimatedProps)
    return
  }
  if (component.props !== undefined && Object.keys(component.props).length > 0) {
    Object.keys(component.props).forEach((key) => {
      const value = rawStyles[key]
      if (value === undefined || component._touchableNode === undefined) return
      const dashedKey = key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
      component._touchableNode.setAttribute(dashedKey, value)
    })
  }
}

function setNativeProps(component: Host, newProps: StyleProps, isAnimatedProps?: boolean): void {
  if (isAnimatedProps === true) component.setNativeProps?.(newProps)
  const currentStyle = { ...component.previousStyle, ...newProps }
  component.previousStyle = currentStyle
  component.setNativeProps?.({ style: currentStyle })
}

function updatePropsDOM(component: Host, style: StyleProps, isAnimatedProps?: boolean): void {
  const currentStyle = { ...component.previousStyle, ...style }
  component.previousStyle = currentStyle
  const domStyle = createReactDOMStyle(currentStyle) as StyleProps
  if (Array.isArray(domStyle['transform']) && createTransformValue !== undefined) {
    domStyle['transform'] = createTransformValue(domStyle['transform'])
  }
  if (
    createTextShadowValue !== undefined &&
    (domStyle['textShadowColor'] !== undefined ||
      domStyle['textShadowRadius'] !== undefined ||
      domStyle['textShadowOffset'] !== undefined)
  ) {
    domStyle['textShadow'] = createTextShadowValue({
      textShadowColor: domStyle['textShadowColor'],
      textShadowOffset: domStyle['textShadowOffset'],
      textShadowRadius: domStyle['textShadowRadius'],
    })
  }
  for (const key in domStyle) {
    if (isAnimatedProps === true) {
      if (component.nodeName === 'INPUT' && key === 'text') {
        component.value = domStyle[key]
      } else {
        component.setAttribute?.(key, domStyle[key])
      }
    } else if (component.style !== undefined) {
      ;(component.style as StyleProps)[key] = domStyle[key]
    }
  }
}
