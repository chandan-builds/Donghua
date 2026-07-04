import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'

export default function Header() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const handleSearch = (e) => {
    e.preventDefault()
    if (query.trim()) {
      navigate(`/?search=${encodeURIComponent(query.trim())}`)
    }
  }

  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="logo">
          DonghuaStream <span className="logo-sub">· 東華</span>
        </Link>

        <form className="search-box" onSubmit={handleSearch}>
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search donghua..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>

        <div className="badge-adfree">✦ Ad-Free</div>
      </div>
    </header>
  )
}
