import React from 'react';
import { CheckSquare, BookOpen, Lock, Plus } from 'lucide-react';

interface DecoyVaultViewProps {
  onRelock: () => void;
}

export const DecoyVaultView: React.FC<DecoyVaultViewProps> = ({ onRelock }) => {
  return (
    <div className="haven-app" style={{ maxWidth: 700 }}>
      <header className="haven-header" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
        <div className="brand-section">
          <div className="brand-logo" style={{ background: '#3b82f6', color: '#ffffff' }}>
            <BookOpen size={20} />
          </div>
          <div className="brand-info">
            <h1 style={{ fontSize: '1.1rem' }}>Personal Planner & Notes</h1>
          </div>
        </div>

        <button
          className="icon-btn"
          onClick={onRelock}
          title="Lock Planner"
          aria-label="Lock Planner"
        >
          <Lock size={18} />
        </button>
      </header>

      <div style={{ display: 'grid', gap: '1rem', marginTop: '0.5rem' }}>
        <div className="glass" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: '#f1f5f9' }}>
              <CheckSquare size={18} color="#3b82f6" />
              <span>Routine Checklist</span>
            </div>
            <button
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#cbd5e1',
                borderRadius: '6px',
                padding: '0.2rem 0.5rem',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                cursor: 'pointer',
              }}
            >
              <Plus size={13} /> Add Item
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {[
              { text: 'Pick up groceries (oat milk, spinach, olive oil)', done: true },
              { text: 'Return library book: "Thinking in Systems"', done: true },
              { text: 'Schedule annual dentist cleaning', done: false },
              { text: 'Weekly bike maintenance & tire pressure check', done: false },
            ].map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  fontSize: '0.88rem',
                  color: item.done ? '#64748b' : '#e2e8f0',
                  textDecoration: item.done ? 'line-through' : 'none',
                }}
              >
                <input type="checkbox" defaultChecked={item.done} style={{ accentColor: '#3b82f6' }} />
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass" style={{ padding: '1.25rem' }}>
          <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: '0.65rem' }}>
            Study & Project Notes
          </div>
          <div style={{ background: 'rgba(0, 0, 0, 0.25)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.5 }}>
            <p style={{ marginBottom: '0.5rem' }}>
              <strong>Topic: Discrete Mathematics & Algorithms</strong>
            </p>
            <p>
              Reviewed graph traversal techniques (BFS vs DFS). Time complexity $O(V + E)$ when implemented with adjacency lists.
              Remember to review topological sort before Friday's problem set.
            </p>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.75rem', color: '#64748b' }}>
        Plausible Deniability Decoy Vault Active. Lock to return to PIN authentication.
      </div>
    </div>
  );
};
