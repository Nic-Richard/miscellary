import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import {
  Alfa_Slab_One,
  Archivo_Black,
  Bebas_Neue,
  Cabin,
  Caveat,
  Cinzel,
  EB_Garamond,
  Jost,
  Marcellus_SC,
  Oswald,
  Playfair_Display,
  Roboto_Condensed,
  Space_Mono,
  Spectral,
} from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import Nav from '@/components/Nav';
import styles from './layout.module.css';

const display = Bebas_Neue({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
});
const body = Roboto_Condensed({ subsets: ['latin'], variable: '--font-body' });

const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });
const cinzel = Cinzel({ subsets: ['latin'], variable: '--font-cinzel' });
const archivo = Archivo_Black({ subsets: ['latin'], weight: '400', variable: '--font-archivo' });
const spacemono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-spacemono',
});
const caveat = Caveat({ subsets: ['latin'], variable: '--font-caveat' });
const alfa = Alfa_Slab_One({ subsets: ['latin'], weight: '400', variable: '--font-alfa' });
const oswald = Oswald({ subsets: ['latin'], variable: '--font-oswald' });
const marcellus = Marcellus_SC({ subsets: ['latin'], weight: '400', variable: '--font-marcellus' });
const garamond = EB_Garamond({ subsets: ['latin'], variable: '--font-garamond' });
const spectral = Spectral({ subsets: ['latin'], weight: '400', variable: '--font-spectral' });
const cabin = Cabin({ subsets: ['latin'], variable: '--font-cabin' });
const jost = Jost({ subsets: ['latin'], variable: '--font-jost' });

const fonts = [
  display,
  body,
  playfair,
  cinzel,
  archivo,
  spacemono,
  caveat,
  alfa,
  oswald,
  marcellus,
  garamond,
  spectral,
  cabin,
  jost,
]
  .map((f) => f.variable)
  .join(' ');

export const metadata: Metadata = {
  title: 'Miscellary',
  description: 'Everything can be a collection.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fonts}>
      <body>
        <AuthProvider>
          <div className={styles.shell}>
            <Nav />
            <main className={styles.main}>{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
