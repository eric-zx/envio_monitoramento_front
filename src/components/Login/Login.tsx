import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { LoginWrapper } from './Login.styled';

const Login = () => {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- EFEITO MATRIX DIGITAL RAIN (AZUL) CORRIGIDO ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      // Ajuste para cobrir 100% da largura e altura
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const katakana = 'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン';
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const chars = (katakana + alphabet).split('');
    const fontSize = 16;
    
    // Inicialização das colunas baseada na largura real
    let columns = canvas.width / fontSize;
    let drops: number[] = Array(Math.floor(columns)).fill(1);

    const draw = () => {
      // Fundo escuro consistente com a tela principal
      ctx.fillStyle = 'rgba(2, 6, 23, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#3b82f6';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#1d4ed8';
      ctx.font = fontSize + 'px monospace';

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 33);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    // Login: monitoramento | Senha: 042915
    if (user === 'monitoramento' && pass === '042915') {
      try {
        const res = await api.post('/login', { login: user, senha: pass });
        if (res.data.ok === true) {
          localStorage.setItem('token', res.data.token);
          localStorage.setItem('user', 'Eric');
          navigate('/inventory');
        }
      } catch (err) {
        // Fallback local caso a API esteja offline
        localStorage.setItem('token', 'session_active_local');
        localStorage.setItem('user', 'Eric');
        navigate('/inventory');
      } finally {
        setLoading(false);
      }
    } else {
      setErrorMsg('Credenciais de acesso inválidas.');
      setLoading(false);
    }
  };

  return (
    <LoginWrapper style={containerStyle}>
      <style>{`
        body { 
          margin: 0; padding: 0; overflow: hidden; 
          background-color: #020617 !important; 
          font-family: 'Inter', sans-serif;
        }
        canvas {
          position: fixed; top: 0; left: 0; 
          width: 100vw; height: 100vh; 
          z-index: -1;
          display: block;
        }
      `}</style>

      <canvas ref={canvasRef}></canvas>

      <div style={glassCard}>
        <form onSubmit={handleLogin} style={formStyle}>
          <div style={logoContainer}>
            <div style={logoBadge}>SIM</div>
            <h2 style={titleStyle}>CONTROLL-ENV</h2>
          </div>
          
          <p style={subtitleStyle}>BEM VINDO!!</p>
          
          {errorMsg && <div style={errorBox}>{errorMsg}</div>}

          <div style={inputWrapper}>
            <label style={labelStyle}>IDENTIFICAÇÃO</label>
            <input 
              type="text" 
              placeholder="Usuário" 
              value={user} 
              onChange={(e) => setUser(e.target.value)} 
              style={glassInput}
              required 
            />
          </div>

          <div style={inputWrapper}>
            <label style={labelStyle}>CHAVE DE SEGURANÇA</label>
            <input 
              type="password" 
              placeholder="Senha" 
              value={pass} 
              onChange={(e) => setPass(e.target.value)} 
              style={glassInput}
              required 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={btnPrimary}
          >
            {loading ? 'AUTENTICANDO...' : 'ACESSAR SISTEMA'}
          </button>
          
          <span style={footerText}>Terminal SIM-MAPS v2.0 - 2026</span>
        </form>
      </div>
    </LoginWrapper>
  );
};

// --- ESTILOS VISUAIS ---
const containerStyle: any = { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', position: 'relative', zIndex: 1 };
const glassCard: any = { background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(25px)', padding: '40px', borderRadius: '16px', border: '1px solid rgba(59, 130, 246, 0.3)', boxShadow: '0 0 50px rgba(0, 0, 0, 0.5)' };
const formStyle: any = { display: 'flex', flexDirection: 'column', gap: '20px', width: '320px' };
const logoContainer: any = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' };
const logoBadge: any = { background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)', color: '#fff', padding: '8px 20px', borderRadius: '8px', fontWeight: 900, fontSize: '26px' };
const titleStyle: any = { margin: 0, color: '#fff', fontSize: '18px', letterSpacing: '3px', fontWeight: 700 };
const subtitleStyle: any = { color: '#94a3b8', fontSize: '11px', textAlign: 'center', marginTop: '-10px', textTransform: 'uppercase' };
const errorBox: any = { background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '10px', borderRadius: '6px', fontSize: '12px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.4)' };
const inputWrapper: any = { display: 'flex', flexDirection: 'column', gap: '5px' };
const labelStyle: any = { fontSize: '10px', color: '#60a5fa', fontWeight: 'bold', letterSpacing: '2px' };
const glassInput: any = { padding: '14px', background: 'rgba(0, 0, 0, 0.5)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '8px', color: '#fff', outline: 'none' };
const btnPrimary: any = { padding: '16px', background: 'linear-gradient(90deg, #1d4ed8, #2563eb)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', letterSpacing: '2px' };
const footerText: any = { textAlign: 'center', color: '#334155', fontSize: '10px', marginTop: '10px' };

export default Login;
