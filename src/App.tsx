import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login/Login';
import InventoryManagement from './components/InventoryManagement/InventoryManagement';

function App() {
  return (
    <Router>
      <Routes>
        {/* Rota inicial: Login */}
        <Route path="/" element={<Login />} />
        
        {/* Rota do Painel: Gestão Quantitativa */}
        <Route path="/inventory" element={<InventoryManagement />} />
        
        {/* Redirecionamento de segurança para rotas inexistentes */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;