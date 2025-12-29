export {}

declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'synthetic-text': {
        ref?: any
        value?: string
        onChange?: (e: {
            nativeEvent: CustomEvent<{ value: string }>
        }) => void
        children?: any
        [key: string]: any
      }
    }
  }
}
