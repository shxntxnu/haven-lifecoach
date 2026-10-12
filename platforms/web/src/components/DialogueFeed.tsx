import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import { Zap } from 'lucide-react';

interface DialogueFeedProps {
  messages: ChatMessage[];
}

export const DialogueFeed: React.FC<DialogueFeedProps> = ({ messages }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

        return (
          <div key={msg.id} className="message-bubble coach">
            {msg.reflection && (
              <div className="coach-reflection-card">
                <div className="coach-reflection-label">I Hear You</div>
                <p>"{msg.reflection}"</p>
              </div>
            )}

            {msg.inquiry && (
              <div className="coach-inquiry">
                <p>{msg.inquiry}</p>
              </div>
            )}

            {msg.technique && (
              <div className="coach-metadata">
                <Zap size={13} color="#14b8a6" />
                <span>Gentle Care:</span>
                <span className="technique-tag">{msg.technique}</span>
              </div>
            )}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
};
