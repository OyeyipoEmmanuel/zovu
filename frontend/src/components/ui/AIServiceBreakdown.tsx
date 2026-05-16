import { useState } from 'react'
import { getServiceBreakdown, type ServiceBreakdownInput } from '../../lib/gemini'


interface Props {
  service: ServiceBreakdownInput
}

export const AIServiceBreakdown = ({ service }: Props) => {
  const [breakdown, setBreakdown] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)

  const handleExplain = async () => {
    if (breakdown) {
      setOpen(true)
      return
    }
    setLoading(true)
    setError(false)
    setOpen(true)
    try {
      const result = await getServiceBreakdown(service)
      setBreakdown(result)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginTop: '12px' }}>
      {/* Trigger button */}
      <button
        onClick={handleExplain}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'transparent',
          border: '1px solid #2A2A2A',
          borderRadius: '6px',
          padding: '7px 14px',
          color: '#F4A11D',
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'DM Sans, sans-serif',
          transition: 'border-color 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = '#F4A11D')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = '#2A2A2A')}
      >
        <span>✦</span>
        Help me understand this
      </button>

      {/* Breakdown panel */}
      {open && (
        <div
          style={{
            marginTop: '10px',
            background: '#161616',
            border: '1px solid #2A2A2A',
            borderLeft: '3px solid #F4A11D',
            borderRadius: '8px',
            padding: '16px',
            position: 'relative',
          }}
        >
          {/* Close */}
          <button
            onClick={() => setOpen(false)}
            style={{
              position: 'absolute',
              top: '10px',
              right: '12px',
              background: 'transparent',
              border: 'none',
              color: '#A0A0A0',
              cursor: 'pointer',
              fontSize: '18px',
              lineHeight: 1,
            }}
          >
            ×
          </button>

          {/* Label */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '12px',
            }}
          >
            <span style={{ color: '#F4A11D', fontSize: '13px' }}>✦</span>
            <span
              style={{
                fontSize: '10px',
                color: '#F4A11D',
                fontWeight: 700,
                letterSpacing: '0.08em',
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              ZOVU AI — PLAIN ENGLISH BREAKDOWN
            </span>
          </div>

          {/* Loading */}
          {loading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#A0A0A0',
                fontSize: '13px',
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              <div
                style={{
                  width: '14px',
                  height: '14px',
                  border: '2px solid #2A2A2A',
                  borderTop: '2px solid #F4A11D',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  flexShrink: 0,
                }}
              />
              Breaking it down for you...
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div
              style={{
                fontSize: '13px',
                color: '#EF4444',
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              Something went wrong. Check your API key.{' '}
              <button
                onClick={() => {
                  setBreakdown(null)
                  handleExplain()
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#F4A11D',
                  cursor: 'pointer',
                  fontSize: '12px',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                Try again
              </button>
            </div>
          )}

          {/* Breakdown text */}
          {breakdown && !loading && (
            <p
              style={{
                fontSize: '13px',
                color: '#F5F5F5',
                lineHeight: 1.8,
                margin: 0,
                fontFamily: 'DM Sans, sans-serif',
                whiteSpace: 'pre-wrap',
              }}
            >
              {breakdown}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
