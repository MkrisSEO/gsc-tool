export const metadata = {
  title: 'GSC Dashboard',
  description: 'Google Search Console performance dashboard'
};

import Providers from './providers';

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <style>{`
          :root {
            --color-navy: #00121F;
            --color-navy-light: #1A2532;
            --color-blue: #0071E3;
            --color-blue-light: #3B8FF3;
            --color-blue-dark: #0058B3;
            --color-gray-light: #F4F6F7;
            --color-white: #FFFFFF;
            --color-success: #10B981;
            --color-warning: #F59E0B;
            --color-error: #EF4444;
            
            /* Morningbound Theme */
            --mb-primary: #0071E3;
            --mb-dark: #00121F;
            --mb-light: #F4F6F7;
          }
          
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          
          * {
            box-sizing: border-box;
          }
          
          /* Modern Button Styles */
          .btn-primary {
            padding: 12px 24px;
            background: linear-gradient(135deg, #0071E3 0%, #0058B3 100%);
            color: #FFFFFF;
            border: none;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 4px 12px rgba(0, 113, 227, 0.2);
            letter-spacing: 0.3px;
          }
          
          .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0, 113, 227, 0.3);
            background: linear-gradient(135deg, #3B8FF3 0%, #0071E3 100%);
          }
          
          .btn-primary:active {
            transform: translateY(0);
          }
          
          .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
          }
          
          .btn-secondary {
            padding: 12px 24px;
            background: rgba(255, 255, 255, 0.08);
            color: #FFFFFF;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            backdrop-filter: blur(10px);
          }
          
          .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.12);
            border-color: rgba(0, 113, 227, 0.4);
          }
          
          .btn-outline {
            padding: 10px 20px;
            background: transparent;
            color: #0071E3;
            border: 2px solid #0071E3;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          
          .btn-outline:hover {
            background: #0071E3;
            color: #FFFFFF;
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(0, 113, 227, 0.2);
          }
          
          .btn-danger {
            padding: 10px 20px;
            background: #EF4444;
            color: #FFFFFF;
            border: none;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          
          .btn-danger:hover {
            background: #DC2626;
            transform: translateY(-2px);
          }
          
          /* Global Heading Styles - White by default for dark theme */
          h1, h2, h3, h4, h5, h6 {
            color: #FFFFFF;
          }
          
          /* Override for light backgrounds */
          .light-theme h1, .light-theme h2, .light-theme h3,
          .light-theme h4, .light-theme h5, .light-theme h6 {
            color: #1f2937;
          }
          
          /* Modern Dark Theme Scrollbars */
          * {
            scrollbar-width: thin;
            scrollbar-color: rgba(0, 113, 227, 0.5) rgba(255, 255, 255, 0.05);
          }
          
          *::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          
          *::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
          }
          
          *::-webkit-scrollbar-thumb {
            background: rgba(0, 113, 227, 0.5);
            border-radius: 4px;
            transition: background 0.3s;
          }
          
          *::-webkit-scrollbar-thumb:hover {
            background: rgba(0, 113, 227, 0.7);
          }
        `}</style>
      </head>
      <body style={{ margin: 0, fontFamily: "'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: '#f9fafb' }}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
