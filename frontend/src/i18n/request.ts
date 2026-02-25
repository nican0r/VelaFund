import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export type Locale = 'pt-BR' | 'en';

const SUPPORTED_LOCALES: Locale[] = ['pt-BR', 'en'];
const DEFAULT_LOCALE: Locale = 'pt-BR';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get('navia-locale')?.value;
  const locale: Locale =
    rawLocale && SUPPORTED_LOCALES.includes(rawLocale as Locale)
      ? (rawLocale as Locale)
      : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
