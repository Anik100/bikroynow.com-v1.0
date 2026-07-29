import './globals.css';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { LanguageProvider } from '../context/LanguageContext';
import PageTransition from '../components/PageTransition';
import AiSupportWidget from '../components/AiSupportWidget';

export const metadata = {
  title: 'BikroyNow - Buy & Sell Anything',
  description: 'The largest marketplace in Bangladesh to buy and sell electronics, cars, properties, and more.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <Navbar />
          <main style={{ minHeight: 'calc(100vh - 200px)' }}>
            <PageTransition>
              {children}
            </PageTransition>
          </main>
          <Footer />
          <AiSupportWidget />
        </LanguageProvider>
      </body>
    </html>
  );
}
