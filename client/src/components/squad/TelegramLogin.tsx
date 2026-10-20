import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, string | number>) => void;
  }
}

interface TelegramLoginProps {
  /** Bot username (without @) registered with @BotFather; its domain must match this site. */
  bot: string;
  onAuth: (data: Record<string, string | number>) => void;
}

/** Telegram's official login button (https://core.telegram.org/widgets/login). */
export default function TelegramLogin({ bot, onAuth }: TelegramLoginProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onAuthRef = useRef(onAuth);
  onAuthRef.current = onAuth;

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    window.onTelegramAuth = (user) => onAuthRef.current(user);
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', bot);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '10');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    host.appendChild(script);
    return () => {
      host.innerHTML = '';
      delete window.onTelegramAuth;
    };
  }, [bot]);

  return <div ref={ref} className="min-h-[40px]" />;
}
