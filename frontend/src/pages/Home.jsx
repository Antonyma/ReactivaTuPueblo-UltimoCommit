import { useFetch } from '../hooks/useFetch.js'

export default function Home() {
  const { data, loading, error } = useFetch('/health')

  return (
    <main style={{ padding: '2rem 1.5rem' }}>
      <h1>ReactivaTuPueblo</h1>
      {loading && <p>Conectando con el servidor...</p>}
      {error && <p>Sin conexión con la API ({error})</p>}
      {data && <p>Estado API: {data.status}</p>}
    </main>
  )
}

