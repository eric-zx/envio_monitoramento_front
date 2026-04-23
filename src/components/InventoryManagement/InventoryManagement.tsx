import { useState, useEffect, useRef } from 'react';
import { InventoryManagementWrapper } from './InventoryManagement.styled';
import api from '../../services/api';

const ESTADOS_CHIPS = ['DF', 'RO', 'PB', 'AP', 'TO', 'AL'];
const TAMANHOS_DISPONIVEIS = Array.from({ length: 17 }, (_, i) => `${i + 19}cm`);

const initialEnvioFinalState = ESTADOS_CHIPS.reduce((acc, est) => ({
  ...acc, 
  [est]: { tz: '0', fontes: '0', travas: '0', dpp: '0', temCinta: false, cintasPorTamanho: {} }
}), {});

const InventoryManagement = () => {
  const [activeTab, setActiveTab] = useState('criar');
  const [loading, setLoading] = useState(false);
  const [historicoChips, setHistoricoChips] = useState<any[]>([]);
  const [historicoFinal, setHistoricoFinal] = useState<any[]>([]);
  const [viewHistorico, setViewHistorico] = useState<'previsao' | 'final'>('previsao');
  const [searchDate, setSearchDate] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const today = new Date().toISOString().split('T')[0];
  const [estoqueGeral, setEstoqueGeral] = useState({ travas: 0, fontes: 0, data_atualizacao: today, observacoes: '' });
  const [envioChips, setEnvioChips] = useState<any>({ id: null, data: today, valores: ESTADOS_CHIPS.reduce((acc, est) => ({ ...acc, [est]: '' }), {}) });
  const [dataGeralEnvio, setDataGeralEnvio] = useState(today);
  const [envioFinal, setEnvioFinal] = useState<any>(initialEnvioFinalState);
  const [idEdicaoFinal, setIdEdicaoFinal] = useState<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const katakana = 'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン';
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const chars = (katakana + alphabet).split('');
    const fontSize = 16;
    const columns = canvas.width / fontSize;
    const drops: number[] = Array(Math.floor(columns)).fill(1);

    const draw = () => {
      ctx.fillStyle = 'rgba(2, 6, 23, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#3b82f6';
      ctx.font = fontSize + 'px monospace';

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 33);
    return () => { clearInterval(interval); window.removeEventListener('resize', resizeCanvas); };
  }, []);

  useEffect(() => { fetchHistorico(); fetchEstoque(); fetchHistoricoFinal(); }, []);

  const fetchHistorico = async () => { const res = await api.get('/inventory-data'); setHistoricoChips(res.data || []); };
  const fetchHistoricoFinal = async () => { const res = await api.get('/historico-envio-final'); setHistoricoFinal(res.data || []); };
  const fetchEstoque = async () => { const res = await api.get('/subitens-data'); if (res.data) setEstoqueGeral(res.data); };

  const handleLogout = () => { if (window.confirm("Deseja realmente sair?")) window.location.href = '/'; };

  const handleEditPrevisao = (item: any) => { setEnvioChips(item); setActiveTab('criar'); };
  const handleEditFinal = (item: any) => {
    setDataGeralEnvio(item.data_geral);
    setEnvioFinal(item.estados);
    setIdEdicaoFinal(item.id);
    setActiveTab('envio-final');
  };

  const salvarPrevisao = async () => {
    await api.post('/update-inventory', envioChips);
    setEnvioChips({ id: null, data: today, valores: ESTADOS_CHIPS.reduce((acc, est) => ({ ...acc, [est]: '' }), {}) });
    fetchHistorico();
    setActiveTab('historico');
  };

  const salvarEnvioFinal = async () => {
    setLoading(true);
    try {
      const payload = { id: idEdicaoFinal, data_geral: dataGeralEnvio, estados: envioFinal };
      await api.post('/save-envio-final', payload);
      
      // Só abate do estoque se for um NOVO envio (não for edição)
      if (!idEdicaoFinal) {
        let tTravas = 0, tFontes = 0;
        Object.values(envioFinal).forEach((est: any) => { 
            tTravas += Number(est.travas || 0); 
            tFontes += Number(est.fontes || 0); 
        });
        const novoEstoque = { 
            ...estoqueGeral, 
            travas: Number(estoqueGeral.travas) - tTravas, 
            fontes: Number(estoqueGeral.fontes) - tFontes, 
            data_atualizacao: today 
        };
        await api.post('/save-subitens', novoEstoque);
        setEstoqueGeral(novoEstoque);
      }
      
      setEnvioFinal(initialEnvioFinalState);
      setIdEdicaoFinal(null);
      fetchHistoricoFinal();
      setActiveTab('historico');
    } catch (e) { alert("Erro ao salvar"); } finally { setLoading(false); }
  };

  // --- LÓGICA DE EXCLUSÃO COM REPOSIÇÃO DE ESTOQUE ---
  const excluirItem = async (item: any) => {
    if (!window.confirm("Confirmar exclusão? Os itens voltarão ao estoque.")) return;

    try {
      if (viewHistorico === 'final') {
        // 1. Calcula quanto devolver
        let devolverTravas = 0;
        let devolverFontes = 0;
        
        Object.values(item.estados).forEach((est: any) => {
          devolverTravas += Number(est.travas || 0);
          devolverFontes += Number(est.fontes || 0);
        });

        // 2. Atualiza estoque no servidor
        const novoEstoque = {
          ...estoqueGeral,
          travas: Number(estoqueGeral.travas) + devolverTravas,
          fontes: Number(estoqueGeral.fontes) + devolverFontes,
          data_atualizacao: today
        };
        
        await api.post('/save-subitens', novoEstoque);
        setEstoqueGeral(novoEstoque);

        // 3. Deleta o registro
        await api.delete(`/delete-envio-final/${item.id}`);
      } else {
        await api.delete(`/delete-inventory/${item.id}`);
      }

      fetchHistorico();
      fetchHistoricoFinal();
    } catch (e) {
      alert("Erro ao processar exclusão.");
    }
  };

  const updateEnvioFinalField = (estado: string, campo: string, valor: any) => {
    setEnvioFinal((prev: any) => ({ ...prev, [estado]: { ...prev[estado], [campo]: valor } }));
  };

  const updateQtdCinta = (estado: string, tamanho: string, qtd: string) => {
    setEnvioFinal((prev: any) => ({
      ...prev, [estado]: { ...prev[estado].cintasPorTamanho, [tamanho]: Number(qtd) }
    }));
  };

  const dadosFiltrados = (viewHistorico === 'previsao' ? historicoChips : historicoFinal).filter(item => {
    const dataItem = item.data || item.data_geral;
    return !searchDate || dataItem === searchDate;
  });

  // --- ESTILOS VISUAIS ---
  const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '30px' };
  const logoBadge: any = { background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)', color: '#fff', padding: '5px 12px', borderRadius: '6px', fontWeight: 900, fontSize: '18px', boxShadow: '0 0 15px rgba(59, 130, 246, 0.4)' };
  const btnLogout: any = { background: 'rgba(220, 53, 69, 0.2)', color: '#ff4d4d', border: '1px solid rgba(220, 53, 69, 0.3)', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
  const navStyle: any = { display: 'flex', gap: '10px' };
  const tabStyle = (active: boolean): any => ({
    padding: '12px 25px', background: active ? 'rgba(30, 41, 59, 0.8)' : 'rgba(15, 23, 42, 0.3)', color: active ? '#60a5fa' : '#94a3b8',
    border: '1px solid rgba(59, 130, 246, 0.2)', borderBottom: active ? '3px solid #3b82f6' : '1px solid rgba(59, 130, 246, 0.2)',
    cursor: 'pointer', fontWeight: '600', borderRadius: '12px 12px 0 0', transition: '0.3s', backdropFilter: 'blur(10px)'
  });
  const glassBox: any = { background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(20px)', padding: '30px', borderRadius: '0 16px 16px 16px', border: '1px solid rgba(59, 130, 246, 0.2)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)', color: '#f1f5f9' };
  const fadeUp: any = { animation: 'fadeInUp 0.4s ease-out' };
  const sectionTitle: any = { fontSize: '18px', fontWeight: 600, marginBottom: '20px', color: '#60a5fa', marginTop: 0, textTransform: 'uppercase', letterSpacing: '1px' };
  const labelStyle: any = { display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '5px', fontWeight: 'bold' };
  const glassInput: any = { width: '100%', padding: '12px', background: 'rgba(0, 0, 0, 0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', marginBottom: '15px', outline: 'none', boxSizing: 'border-box' };
  const glassInputSmall: any = { ...glassInput, padding: '8px', marginBottom: '0' };
  const glassTextArea: any = { ...glassInput, height: '100px', resize: 'none' };
  const gridPrevisao: any = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '15px', marginBottom: '20px' };
  const inputGroup: any = { display: 'flex', flexDirection: 'column' };
  const gridEnvioFinal: any = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '20px' };
  const neonCard: any = { background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '12px', padding: '15px' };
  const cardHeader: any = { fontSize: '15px', fontWeight: 800, color: '#3b82f6', marginBottom: '15px', letterSpacing: '2px' };
  const innerGrid: any = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' };
  const miniLabel: any = { fontSize: '10px', color: '#64748b', fontWeight: 'bold' };
  const miniInput: any = { width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '6px', borderRadius: '4px', boxSizing: 'border-box' };
  const cintaSection: any = { marginTop: '15px', background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px' };
  const glassSelect: any = { background: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '4px', fontSize: '10px', padding: '3px' };
  const cintaScrollContainer: any = { marginTop: '10px', maxHeight: '100px', overflowY: 'auto' };
  const cintaRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' };
  const btnPrimary: any = { width: '100%', padding: '15px', background: 'linear-gradient(90deg, #1d4ed8, #3b82f6)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px', textTransform: 'uppercase', boxShadow: '0 4px 15px rgba(29, 78, 216, 0.4)' };
  const historyList: any = { display: 'flex', flexDirection: 'column', gap: '10px' };
  const historyItem: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', background: 'rgba(30, 41, 59, 0.4)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' };
  const dateBadge: any = { background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', border: '1px solid rgba(59, 130, 246, 0.3)' };
  const viewToggle = (active: boolean): any => ({ padding: '8px 20px', background: active ? '#1d4ed8' : 'transparent', color: active ? '#fff' : '#60a5fa', border: '1px solid #1d4ed8', borderRadius: '6px', cursor: 'pointer' });
  const btnEdit: any = { background: 'transparent', color: '#60a5fa', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' };
  const btnDelete: any = { background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' };

  return (
    <InventoryManagementWrapper style={{ background: 'transparent' }}>
      <style>{`
        body { background: #020617 !important; margin: 0; padding: 0; overflow-x: hidden; }
        canvas { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: -1; }
        .main-container { max-width: 1200px; margin: 0 auto; padding: 20px; position: relative; z-index: 1; }
      `}</style>
      
      <canvas ref={canvasRef}></canvas>

      <div className="main-container">
        <header style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={logoBadge}>MONITORAMENTO</div>
            <h1 style={{ color: '#fff', fontSize: '22px', letterSpacing: '1px', margin: 0 }}>MANAGEMENT SYSTEM</h1>
          </div>
          <button onClick={handleLogout} style={btnLogout}>SAIR</button>
        </header>

        <nav style={navStyle}>
          {['criar', 'estoque', 'envio-final', 'historico'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={tabStyle(activeTab === t)}>
              {t.toUpperCase()}
            </button>
          ))}
        </nav>

        <main style={glassBox}>
          {activeTab === 'criar' && (
            <div style={fadeUp}>
              <h3 style={sectionTitle}>Nova Previsão de Envio</h3>
              <input type="date" value={envioChips.data} onChange={e => setEnvioChips({...envioChips, data: e.target.value})} style={glassInput}/>
              <div style={gridPrevisao}>
                {ESTADOS_CHIPS.map(est => (
                  <div key={est} style={inputGroup}>
                    <label style={labelStyle}>{est}</label>
                    <input type="number" placeholder="0" value={envioChips.valores[est]} onChange={e => setEnvioChips({...envioChips, valores: {...envioChips.valores, [est]: e.target.value}})} style={glassInputSmall}/>
                  </div>
                ))}
              </div>
              <button onClick={salvarPrevisao} style={btnPrimary}>{envioChips.id ? 'ATUALIZAR' : 'SALVAR PREVISÃO'}</button>
            </div>
          )}

          {activeTab === 'estoque' && (
            <div style={fadeUp}>
               <h3 style={sectionTitle}>Controle de Pátio</h3>
              <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Última Troca</label>
                  <input type="date" value={estoqueGeral.data_atualizacao} onChange={e => setEstoqueGeral({...estoqueGeral, data_atualizacao: e.target.value})} style={glassInput}/>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Travas</label>
                  <input type="number" value={estoqueGeral.travas} onChange={e => setEstoqueGeral({...estoqueGeral, travas: Number(e.target.value)})} style={glassInput}/>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Fontes</label>
                  <input type="number" value={estoqueGeral.fontes} onChange={e => setEstoqueGeral({...estoqueGeral, fontes: Number(e.target.value)})} style={glassInput}/>
                </div>
              </div>
              <label style={labelStyle}>Anotações Técnicas</label>
              <textarea 
                value={estoqueGeral.observacoes} 
                onChange={e => setEstoqueGeral({...estoqueGeral, observacoes: e.target.value})} 
                style={glassTextArea} 
                placeholder="Descreva observações do lote ou manutenção..." 
              />
              <button onClick={() => api.post('/save-subitens', estoqueGeral).then(() => alert('Sincronizado'))} style={btnPrimary}>SINCRONIZAR ESTOQUE</button>
            </div>
          )}

          {activeTab === 'envio-final' && (
            <div style={fadeUp}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={sectionTitle}>ENVIO GERAL</h3>
                <input type="date" value={dataGeralEnvio} onChange={e => setDataGeralEnvio(e.target.value)} style={{...glassInput, width: '200px', marginBottom: 0}}/>
              </div>
              <div style={gridEnvioFinal}>
                {ESTADOS_CHIPS.map(estado => (
                  <div key={estado} style={neonCard}>
                    <div style={cardHeader}>{estado}</div>
                    <div style={innerGrid}>
                      <div><label style={miniLabel}>Tz</label><input type="number" value={envioFinal[estado].tz} onChange={e => updateEnvioFinalField(estado, 'tz', e.target.value)} style={miniInput}/></div>
                      <div><label style={miniLabel}>F</label><input type="number" value={envioFinal[estado].fontes} onChange={e => updateEnvioFinalField(estado, 'fontes', e.target.value)} style={miniInput}/></div>
                      <div><label style={miniLabel}>T</label><input type="number" value={envioFinal[estado].travas} onChange={e => updateEnvioFinalField(estado, 'travas', e.target.value)} style={miniInput}/></div>
                      <div><label style={miniLabel}>DPP</label><input type="number" value={envioFinal[estado].dpp} onChange={e => updateEnvioFinalField(estado, 'dpp', e.target.value)} style={miniInput}/></div>
                    </div>
                    <div style={cintaSection}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold' }}>CINTAS</span>
                        <select value={envioFinal[estado].temCinta ? "sim" : "nao"} onChange={e => updateEnvioFinalField(estado, 'temCinta', e.target.value === "sim")} style={glassSelect}>
                          <option value="nao">NÃO</option><option value="sim">SIM</option>
                        </select>
                      </div>
                      {envioFinal[estado].temCinta && (
                        <div style={cintaScrollContainer}>
                          {TAMANHOS_DISPONIVEIS.map(tam => (
                            <div key={tam} style={cintaRow}>
                              <span>{tam}</span>
                              <input type="number" value={envioFinal[estado].cintasPorTamanho[tam] || ''} onChange={e => updateQtdCinta(estado, tam, e.target.value)} style={miniInput}/>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={salvarEnvioFinal} disabled={loading} style={btnPrimary}>{loading ? 'PROCESSANDO...' : 'FINALIZAR CARREGAMENTO'}</button>
            </div>
          )}

          {activeTab === 'historico' && (
            <div style={fadeUp}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <input type="date" value={searchDate} onChange={e => setSearchDate(e.target.value)} style={{...glassInput, marginBottom: 0}}/>
                <button onClick={() => setViewHistorico('previsao')} style={viewToggle(viewHistorico === 'previsao')}>PREVISÕES</button>
                <button onClick={() => setViewHistorico('final')} style={viewToggle(viewHistorico === 'final')}>FINAIS</button>
              </div>
              <div style={historyList}>
                {dadosFiltrados.map(item => (
                  <div key={item.id} style={historyItem}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={dateBadge}>{item.data || item.data_geral}</div>
                      <span style={{ fontWeight: 500, fontSize: '13px', color: '#60a5fa' }}>REF: {String(item.id).slice(-5)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '15px' }}>
                      <button onClick={() => viewHistorico === 'previsao' ? handleEditPrevisao(item) : handleEditFinal(item)} style={btnEdit}>EDITAR</button>
                      <button onClick={() => excluirItem(item)} style={btnDelete}>EXCLUIR</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </InventoryManagementWrapper>
  );
};

export default InventoryManagement;