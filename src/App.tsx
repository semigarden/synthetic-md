import SyntheticText from './components/SyntheticText'
import { useState, useCallback, useEffect, useRef } from 'react'
import useStore from './hooks/useStore'
import { type SyntheticTextRef } from './hooks/useSynthController'

function App() {
  const { loadText, saveText } = useStore();
  const editorRef = useRef<SyntheticTextRef>(null);
  const [initialValue, setInitialValue] = useState<string | null>(null);

  useEffect(() => {
    loadText().then(setInitialValue);
  }, []);

  const onChange = useCallback((text: string) => {
    saveText(text).catch(console.error);
  }, []);

  if (initialValue === null) {
    return null;
  }

  return (
    <SyntheticText
      ref={editorRef}
      initialValue={initialValue}
      onChange={onChange}
    />
  );
}

export default App
