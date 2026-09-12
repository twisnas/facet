import './App.css'
import { formatUsd } from './pricing'

const metals = [
  { name: 'Gold', symbol: 'XAU', price: 2345.12, change: '+1.24%', tone: 'up' },
  { name: 'Silver', symbol: 'XAG', price: 27.41, change: '+0.68%', tone: 'up' },
  { name: 'Platinum', symbol: 'XPT', price: 1012.55, change: '-0.31%', tone: 'down' },
]

function App() {
  return (
    <main className="shell">
      <nav className="nav">
        <a className="brand" href="/" aria-label="Facet home">
          <span className="brand-mark">F</span>
          <span>Facet</span>
        </a>
        <span className="environment"><span className="status-dot" /> Demo environment</span>
      </nav>

      <header className="intro">
        <p className="eyebrow">Live metals desk</p>
        <h1>Know the metal.<br /><em>Set your price.</em></h1>
        <p className="lede">A clear starting point for turning live spot prices into the numbers your business actually uses.</p>
      </header>

      <section className="workspace" aria-labelledby="market-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Market snapshot</p>
            <h2 id="market-heading">Latest spot prices</h2>
          </div>
          <span className="timestamp">Updated just now</span>
        </div>
        <div className="price-grid">
          {metals.map((metal) => (
            <article className="price-card" key={metal.symbol}>
              <div className="card-topline"><span>{metal.symbol}</span><span className={`change ${metal.tone}`}>{metal.change}</span></div>
              <h3>{metal.name}</h3>
              <p className="price">{formatUsd(metal.price)}</p>
              <p className="unit">USD / troy ounce</p>
            </article>
          ))}
        </div>
      </section>

      <section className="formula-panel" aria-labelledby="formula-heading">
        <div>
          <p className="eyebrow">Your pricing logic</p>
          <h2 id="formula-heading">Build a custom quote</h2>
          <p className="panel-copy">Combine live market data with your own fees, margins, and quantities.</p>
        </div>
        <div className="formula-preview" aria-label="Formula preview">
          <span className="formula-label">Example formula</span>
          <code>gold × quantity + fabrication_fee</code>
          <button type="button">Open quote builder <span aria-hidden="true">↗</span></button>
        </div>
      </section>

      <footer><span>Facet</span><span>Prices shown for demonstration</span></footer>
    </main>
  )
}

export default App
