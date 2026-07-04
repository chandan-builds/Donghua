import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Home from './pages/Home'
import Series from './pages/Series'
import Watch from './pages/Watch'

export default function App() {
  return (
    <>
      <div className="ambient-glow" />
      <Header />
      <main className="page-container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/series/:slug" element={<Series />} />
          <Route path="/watch/:slug/:episode" element={<Watch />} />
        </Routes>
      </main>
      <footer className="footer">
        <p>DonghuaStream — Built for donghua fans. No ads, no popups, just content.</p>
        <p style={{ marginTop: 4 }}>Videos are embedded from third-party hosts. We do not host any content.</p>
      </footer>
    </>
  )
}
