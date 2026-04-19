import { useState, useCallback } from 'react';

export function useToast() {
  const [msg, setMsg] = useState('');
  const [visible, setVisible] = useState(false);
  let timer;

  const show = useCallback((text) => {
    clearTimeout(timer);
    setMsg(text);
    setVisible(true);
    timer = setTimeout(() => setVisible(false), 2300);
  }, []);

  return { msg, visible, show };
}
