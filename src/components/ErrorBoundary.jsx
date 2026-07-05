import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorType: null };
  }

  static getDerivedStateFromError(error) {
    const errorStr = error.toString().toLowerCase();
    const isChunkError = 
      errorStr.includes('chunk') || 
      errorStr.includes('loading') || 
      errorStr.includes('dynamically imported') || 
      errorStr.includes('fetch') || 
      error.name === 'ChunkLoadError';

    return { 
      hasError: true, 
      errorType: isChunkError ? 'update' : 'render' 
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const lang = localStorage.getItem('vamsha_lang') || 'te';

      const title = lang === 'te' 
        ? "యాప్ అప్‌డేట్ చేయబడింది" 
        : lang === 'kn' 
          ? "ಅಪ್ಲಿಕೇಶನ್ ನವೀಕರಿಸಲಾಗಿದೆ" 
          : "Vamsha App Updated";

      const message = lang === 'te'
        ? "వంశ యాప్‌కు కొత్త మార్పులు చేయబడ్డాయి. దయచేసి సరికొత్త వెర్షన్‌ను అనుభవించడానికి క్రింది బటన్‌ను క్లిక్ చేసి రీలోడ్ చేయండి."
        : lang === 'kn'
          ? "ವಂಶ ಅಪ್ಲಿಕೇಶನ್‌ಗೆ ಹೊಸ ಬದಲಾವಣೆಗಳನ್ನು ಮಾಡಲಾಗಿದೆ. ಇತ್ತೀಚಿನ ಆವೃತ್ತಿಯನ್ನು ಪಡೆಯಲು ದಯವಿಟ್ಟು ಕೆಳಗಿನ ಬಟನ್ ಕ್ಲಿಕ್ ಮಾಡಿ ಮರುಲೋಡ್ ಮಾಡಿ."
          : "Vamsha family tree has received new updates. Please click the button below to reload and access the latest features.";

      const buttonText = lang === 'te' 
        ? "యాప్‌ను రీలోడ్ చేయండి 🔄" 
        : lang === 'kn' 
          ? "ಅಪ್ಲಿಕೇಶನ್ ಮರುಲೋಡ್ ಮಾಡಿ 🔄" 
          : "Reload Application 🔄";

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#FCFAF7',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '2.5rem 2rem',
            boxShadow: '0 8px 24px rgba(99, 19, 29, 0.08)',
            border: '1.5px solid #EADDCA',
            maxWidth: '450px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            {/* Vamsha Maskable Logo */}
            <img
              src="icons/icon-maskable-512.png"
              alt="Vamsha Logo"
              style={{
                width: '90px',
                height: '90px',
                objectFit: 'contain',
                marginBottom: '1.5rem',
                filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.06))'
              }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />

            <h2 style={{
              color: '#63131D',
              fontSize: '1.5rem',
              fontWeight: 800,
              margin: '0 0 1rem'
            }}>
              {title}
            </h2>

            <p style={{
              color: '#555',
              fontSize: '0.95rem',
              lineHeight: 1.6,
              margin: '0 0 2rem'
            }}>
              {message}
            </p>

            <button
              onClick={this.handleReload}
              style={{
                backgroundColor: '#63131D',
                color: '#D4AF37',
                border: '1.5px solid #D4AF37',
                padding: '0.85rem 1.75rem',
                borderRadius: '8px',
                fontSize: '0.95rem',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(99, 19, 29, 0.15)',
                width: '100%'
              }}
            >
              {buttonText}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
