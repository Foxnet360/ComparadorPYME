import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Send, X } from 'lucide-react';

interface FeedbackCollectorProps {
  feature: string;
  onSubmit?: () => void;
}

export const FeedbackCollector: React.FC<FeedbackCollectorProps> = ({ feature, onSubmit }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;

    try {
      await fetch('/api/monitoring/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature,
          rating,
          comment: comment || undefined
        })
      });

      setIsSubmitted(true);
      setTimeout(() => {
        setIsOpen(false);
        setIsSubmitted(false);
        setRating(0);
        setComment('');
        onSubmit?.();
      }, 2000);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 bg-indigo-600 text-white p-3 rounded-full shadow-lg hover:bg-indigo-700 transition-colors z-40"
        title="Dar feedback"
      >
        <ThumbsUp size={20} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 bg-white rounded-xl shadow-xl border border-slate-200 p-4 w-80 z-50">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-semibold text-slate-800">¿Qué te parece esta función?</h4>
        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
          <X size={16} />
        </button>
      </div>

      {isSubmitted ? (
        <div className="text-center py-4">
          <div className="text-green-600 text-4xl mb-2">✓</div>
          <p className="text-slate-700">¡Gracias por tu feedback!</p>
        </div>
      ) : (
        <>
          <div className="flex justify-center gap-2 mb-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className={`text-2xl transition-colors ${
                  star <= rating ? 'text-yellow-400' : 'text-slate-300'
                }`}
              >
                ★
              </button>
            ))}
          </div>

          <textarea
            placeholder="¿Tienes algún comentario? (opcional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 mb-3 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            rows={3}
          />

          <button
            onClick={handleSubmit}
            disabled={rating === 0}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <Send size={16} />
            Enviar feedback
          </button>
        </>
      )}
    </div>
  );
};