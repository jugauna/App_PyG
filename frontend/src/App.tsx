import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { Layout } from './components/Layout'
import { WellsProvider } from './context/WellsContext'
import { MapPage } from './pages/MapPage'
import { WellDetailPage } from './pages/WellDetailPage'

export default function App() {
  return (
    <BrowserRouter>
      <WellsProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<MapPage />} />
            <Route path="/pozo/:sigla" element={<WellDetailPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </WellsProvider>
    </BrowserRouter>
  )
}
