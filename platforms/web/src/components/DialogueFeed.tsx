import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import { Zap } from 'lucide-react';

interface DialogueFeedProps {
  messages: ChatMessage[];
  isTyping?: boolean;
}

export const DialogueFeed: React.FC<DialogueFeedProps> = ({ messages, isTyping = false }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  return (
    <div className="dialogue-viewport" role="log" aria-live="polite">
      {messages.map((msg) => {
        const isUser = msg.sender === 'user';

        if (isUser) {
          return (
            <div key={msg.id} className="message-bubble user">
              <p>{msg.text}</p>
            </div>
          );
        }

        const content =
          msg.text ||
          (msg.reflection && msg.inquiry
            ? `${msg.reflection}\n\n${msg.inquiry}`
            : msg.reflection || msg.inquiry || '');

        return (
          <div key={msg.id} className="message-bubble coach">
            {content && (
              <div className="coach-text">
                {content.split('\n\n').map((paragraph, idx) => (
                  <p key={idx} style={{ margin: idx > 0 ? '0.65rem 0 0 0' : 0 }}>
                    {paragraph}
                  </p>
                ))}
              </div>
            )}

            {msg.technique && (
              <div className="coach-metadata">
                <Zap size={12} color="#14b8a6" />
                <span className="technique-tag">{msg.technique}</span>
              </div>
            )}
          </div>
        );
      })}

      {isTyping && (
        <div className="message-bubble coach typing-indicator" aria-label="Haven is typing">
          <div className="typing-dots">
            <span />
            <span />
            <span />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
