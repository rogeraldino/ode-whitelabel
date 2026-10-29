import React from 'react';
import ProfileHeader from '../components/ProfileHeader';

export default function TestHeaderPage() {
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '100px 20px 20px 20px'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '20px',
        padding: '40px',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: '700',
          color: '#021D40',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          Header Melhorado - Demonstração
        </h1>
        
        <p style={{
          fontSize: '1.1rem',
          color: '#6B7280',
          textAlign: 'center',
          marginBottom: '40px',
          lineHeight: '1.6'
        }}>
          Esta página demonstra as melhorias aplicadas ao header da aplicação.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '30px',
          marginTop: '40px'
        }}>
          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '15px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
            border: '1px solid #E5E7EB'
          }}>
            <h3 style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              color: '#021D40',
              marginBottom: '15px'
            }}>
              ✨ Design Moderno
            </h3>
            <ul style={{
              listStyle: 'none',
              padding: 0,
              color: '#6B7280',
              lineHeight: '1.8'
            }}>
              <li>• Backdrop filter com blur</li>
              <li>• Gradientes suaves</li>
              <li>• Sombras elegantes</li>
              <li>• Animações fluidas</li>
            </ul>
          </div>

          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '15px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
            border: '1px solid #E5E7EB'
          }}>
            <h3 style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              color: '#021D40',
              marginBottom: '15px'
            }}>
              🔍 Funcionalidades
            </h3>
            <ul style={{
              listStyle: 'none',
              padding: 0,
              color: '#6B7280',
              lineHeight: '1.8'
            }}>
              <li>• Busca global</li>
              <li>• Notificações</li>
              <li>• Menu de perfil expandido</li>
              <li>• Saudação dinâmica</li>
            </ul>
          </div>

          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '15px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
            border: '1px solid #E5E7EB'
          }}>
            <h3 style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              color: '#021D40',
              marginBottom: '15px'
            }}>
              📱 Responsividade
            </h3>
            <ul style={{
              listStyle: 'none',
              padding: 0,
              color: '#6B7280',
              lineHeight: '1.8'
            }}>
              <li>• Adaptação mobile</li>
              <li>• Breakpoints otimizados</li>
              <li>• Touch-friendly</li>
              <li>• Acessibilidade</li>
            </ul>
          </div>
        </div>

        <div style={{
          marginTop: '50px',
          padding: '30px',
          background: 'linear-gradient(135deg, #F69543 0%, #E88533 100%)',
          borderRadius: '15px',
          color: 'white',
          textAlign: 'center'
        }}>
          <h2 style={{
            fontSize: '2rem',
            fontWeight: '600',
            marginBottom: '15px'
          }}>
            Melhorias Implementadas
          </h2>
          <p style={{
            fontSize: '1.1rem',
            opacity: 0.9,
            lineHeight: '1.6'
          }}>
            O header agora oferece uma experiência mais moderna, intuitiva e acessível, 
            mantendo a identidade visual da plataforma.
          </p>
        </div>
      </div>
    </div>
  );
} 