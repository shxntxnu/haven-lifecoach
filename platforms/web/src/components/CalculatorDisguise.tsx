import React, { useState } from 'react';
import { Lock } from 'lucide-react';

interface CalculatorDisguiseProps {
  onUnlock: () => void;
}

export const CalculatorDisguise: React.FC<CalculatorDisguiseProps> = ({ onUnlock }) => {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [clearOnNext, setClearOnNext] = useState(false);

  const handleNumber = (n: string) => {
    if (display === '0' || clearOnNext) {
      setDisplay(n);
      setClearOnNext(false);
    } else {
      setDisplay((prev) => (prev.length < 12 ? prev + n : prev));
    }
  };

  const handleOp = (op: string) => {
    setEquation(`${display} ${op} `);
    setClearOnNext(true);
  };

  const handleClear = () => {
    setDisplay('0');
    setEquation('');
    setClearOnNext(false);
  };

  const handleEqual = () => {
    // Secret code unlock: typing 42 or 1337 triggers return
    if (display === '42' || display === '1337') {
      onUnlock();
      return;
    }

    try {
      const fullExpr = equation + display;
      // Sanitize input to only allowed math characters
      if (/^[0-9+\-*/. ]+$/.test(fullExpr)) {
        // eslint-disable-next-line no-eval
        const result = Function(`'use strict'; return (${fullExpr})`)();
        setDisplay(String(Number(result.toFixed(6))));
        setEquation('');
        setClearOnNext(true);
      }
    } catch {
      setDisplay('Error');
      setClearOnNext(true);
    }
  };

  return (
    <div className="calculator-view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
        <span style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Standard Calculator
        </span>
        <button
          onClick={onUnlock}
          style={{
            background: 'none',
            border: 'none',
            color: '#4b5563',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.75rem'
          }}
          title="Exit Disguise Mode"
        >
          <Lock size={12} />
          <span>Stealth Exit</span>
        </button>
      </div>

      <div className="calc-display" aria-live="polite">
        {display}
      </div>

      <div className="calc-grid">
        <button className="calc-btn top" onClick={handleClear}>C</button>
        <button className="calc-btn top" onClick={() => setDisplay((prev) => String(-Number(prev)))}>±</button>
        <button className="calc-btn top" onClick={() => setDisplay((prev) => String(Number(prev) / 100))}>%</button>
        <button className="calc-btn op" onClick={() => handleOp('/')}>÷</button>

        <button className="calc-btn" onClick={() => handleNumber('7')}>7</button>
        <button className="calc-btn" onClick={() => handleNumber('8')}>8</button>
        <button className="calc-btn" onClick={() => handleNumber('9')}>9</button>
        <button className="calc-btn op" onClick={() => handleOp('*')}>×</button>

        <button className="calc-btn" onClick={() => handleNumber('4')}>4</button>
        <button className="calc-btn" onClick={() => handleNumber('5')}>5</button>
        <button className="calc-btn" onClick={() => handleNumber('6')}>6</button>
        <button className="calc-btn op" onClick={() => handleOp('-')}>−</button>

        <button className="calc-btn" onClick={() => handleNumber('1')}>1</button>
        <button className="calc-btn" onClick={() => handleNumber('2')}>2</button>
        <button className="calc-btn" onClick={() => handleNumber('3')}>3</button>
        <button className="calc-btn op" onClick={() => handleOp('+')}>+</button>

        <button className="calc-btn" style={{ gridColumn: 'span 2', borderRadius: '30px' }} onClick={() => handleNumber('0')}>0</button>
        <button className="calc-btn" onClick={() => { if (!display.includes('.')) setDisplay((p) => p + '.'); }}>.</button>
        <button className="calc-btn op" onClick={handleEqual}>=</button>
      </div>

      <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.7rem', color: '#4b5563' }}>
        Tip: Type 42 and press '=' to unlock Haven secretly.
      </div>
    </div>
  );
};
